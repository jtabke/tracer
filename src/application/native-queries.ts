import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure, json, record } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject, ObjectQuery } from "../core/model.ts";
import type { Repository } from "./ports/repository.ts";
import type { EvidenceService } from "./evidence.ts";
import type {
  GraphQuery,
  TableQuery,
  MatrixQuery,
  ChainQuery,
  FamilyQuery,
  RecordedConnectionsQuery,
  ConnectionsQuery,
} from "./views.ts";
import { chainTable } from "./chain.ts";
import { familyWorkspace } from "./family.ts";
import { graphNeighborhood } from "./graph.ts";
import { recordedConnections } from "./recorded-connections.ts";
import { focusedAfter, temporalGraph } from "./temporal.ts";
import {
  projectSchema,
  validateObjectQuery,
  validatePageLimit,
  queryShape,
} from "./native-query-support.ts";

/** Internal projection owner; Tracer retains the public return contracts and each task reads one snapshot. */
export class NativeQueries {
  private repository: Repository;
  private evidence: EvidenceService;
  constructor(repository: Repository, evidence: EvidenceService) {
    this.repository = repository;
    this.evidence = evidence;
  }
  getGraph(query: GraphQuery) {
    ensure(record(query), "validation", "Invalid graph query");
    const compare = Object.getOwnPropertyDescriptor(query, "compareRevision"),
      at = Object.getOwnPropertyDescriptor(query, "atRevision");
    ensure(
      compare?.value === undefined || at?.value !== undefined,
      "validation",
      "Comparison requires a target revision",
    );
    try {
      query = snapshotInput(query);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.repository.transaction(async (tx) => {
      if (query.atRevision !== undefined) return temporalGraph(tx, query);
      const schema = await projectSchema(tx);
      const neighborhood = await graphNeighborhood(tx, query);
      const evidence = await this.evidence.graphEvidence(
        tx,
        neighborhood.nodes.map((node) => node.id),
      );
      return { schema, ...neighborhood, ...evidence };
    });
  }
  async getTable(query: TableQuery) {
    query = snapshotInput(query);
    ensure(record(query), "validation", "Query must be an object");
    const { focusId, ...filters } = query;
    validateObjectQuery(filters, "entity");
    ensure(typeof query.type === "string", "validation", "Table needs an entity type");
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      ensure(Object.hasOwn(schema.entityTypes, query.type), "validation", "Unknown entity type");
      return {
        schema,
        entities: (await tx.query("entity", {
          ...filters,
          after: await focusedAfter(tx, query.type, focusId, query.after),
        })) as import("../core/model.ts").Page<Entity>,
      };
    });
  }
  async getMatrix(query: MatrixQuery) {
    query = snapshotInput(query);
    queryShape(
      query,
      [
        "sourceType",
        "targetType",
        "relationshipType",
        "sourceAfter",
        "targetAfter",
        "sourceFocus",
        "targetFocus",
        "limit",
      ],
      "Invalid matrix query",
    );
    const limit = query.limit ?? 20;
    validatePageLimit(limit, 25, "Matrix page limit must be 1–25 per axis");
    ensure(
      [query.sourceType, query.targetType, query.relationshipType].every(
        (value) => typeof value === "string",
      ) &&
        [query.sourceAfter, query.targetAfter, query.sourceFocus, query.targetFocus].every(
          (value) => value === undefined || typeof value === "string",
        ),
      "validation",
      "Matrix filters must be text",
    );
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      ensure(
        Object.hasOwn(schema.entityTypes, query.sourceType) &&
          Object.hasOwn(schema.entityTypes, query.targetType) &&
          Object.hasOwn(schema.relationshipTypes, query.relationshipType),
        "validation",
        "Unknown matrix type",
      );
      const definition = schema.relationshipTypes[query.relationshipType];
      ensure(
        (!definition.source || definition.source.includes(query.sourceType)) &&
          (!definition.target || definition.target.includes(query.targetType)),
        "validation",
        "Matrix types violate endpoint constraints",
      );
      const sources = (await tx.query("entity", {
        type: query.sourceType,
        after: await focusedAfter(tx, query.sourceType, query.sourceFocus, query.sourceAfter),
        limit,
      })) as import("../core/model.ts").Page<Entity>;
      const targets = (await tx.query("entity", {
        type: query.targetType,
        after: await focusedAfter(tx, query.targetType, query.targetFocus, query.targetAfter),
        limit,
      })) as import("../core/model.ts").Page<Entity>;
      const projection = await tx.traceability(
        sources.items.map((item) => item.id),
        targets.items.map((item) => item.id),
        query.targetType,
        query.relationshipType,
      );
      return { schema, sources, targets, ...projection };
    });
  }
  getChain(query: ChainQuery) {
    query = snapshotInput(query);
    queryShape(query, ["type", "steps", "search", "after", "limit"], "Invalid chain query");
    ensure(typeof query.type === "string", "validation", "Invalid chain query");
    validateObjectQuery(
      { type: query.type, search: query.search, after: query.after, limit: query.limit },
      "entity",
    );
    ensure((query.limit ?? 20) <= 20, "validation", "Show at most 20 chain roots per page");
    return this.repository.transaction(async (tx) =>
      chainTable(tx, await projectSchema(tx), query),
    );
  }
  getWorkingSet(query: ObjectQuery = {}) {
    query = snapshotInput(query);
    ensure(record(query), "validation", "Working set needs filters");
    const { field, value, without, targetType, ...filters } = query;
    validateObjectQuery(filters, "entity");
    ensure(
      [field, value, without, targetType].every(
        (item) => item === undefined || (typeof item === "string" && json(item)),
      ),
      "validation",
      "Working filters must be text",
    );
    ensure(
      (field === undefined) === (value === undefined) &&
        (without === undefined) === (targetType === undefined),
      "validation",
      "Choose a field/value pair or relationship/target pair",
    );
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      this.validateWorkingFields(schema, query);
      this.validateWorkingCoverage(schema, query);
      return { schema, ...(await tx.workingSet(query)) };
    });
  }
  private validateWorkingFields(schema: SchemaObject, query: ObjectQuery) {
    ensure(
      query.type === undefined || Object.hasOwn(schema.entityTypes, query.type),
      "validation",
      "Unknown working type",
    );
    if (query.field !== undefined)
      ensure(
        query.type &&
          Object.hasOwn(schema.entityTypes[query.type].fields, query.field) &&
          schema.entityTypes[query.type].fields[query.field].type === "string",
        "validation",
        "Choose a text field in the selected type",
      );
  }
  private validateWorkingCoverage(schema: SchemaObject, query: ObjectQuery) {
    if (query.without !== undefined) {
      const definition = Object.hasOwn(schema.relationshipTypes, query.without)
        ? schema.relationshipTypes[query.without]
        : undefined;
      ensure(
        query.type &&
          definition &&
          Object.hasOwn(schema.entityTypes, query.targetType!) &&
          (!definition.source || definition.source.includes(query.type)) &&
          (!definition.target || definition.target.includes(query.targetType!)),
        "validation",
        "Coverage needs compatible source, relationship and target types",
      );
    }
  }
  getRecordedConnections(query: RecordedConnectionsQuery) {
    query = snapshotInput(query);
    queryShape(query, ["type", "after", "limit"], "Recorded connections need a relationship type");
    ensure(
      typeof query.type === "string",
      "validation",
      "Recorded connections need a relationship type",
    );
    validateObjectQuery(query, "relationship");
    ensure((query.limit ?? 25) <= 25, "validation", "Show at most 25 recorded connections");
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      ensure(
        Object.hasOwn(schema.relationshipTypes, query.type),
        "validation",
        "Unknown relationship type",
      );
      return recordedConnections(tx, schema, query);
    });
  }
  async getFamily(query: FamilyQuery) {
    query = snapshotInput(query);
    return this.repository.transaction(async (tx) =>
      familyWorkspace(tx, await projectSchema(tx), query),
    );
  }
  getConnections(query: ConnectionsQuery) {
    query = snapshotInput(query);
    queryShape(query, ["id", "type", "after", "limit"], "Connections need an item ID");
    ensure(typeof query.id === "string", "validation", "Connections need an item ID");
    validateObjectQuery(
      { type: query.type, after: query.after, limit: query.limit },
      "relationship",
    );
    ensure((query.limit ?? 25) <= 50, "validation", "Show at most 50 connections at a time");
    return this.repository.transaction(async (tx) => {
      const schema = await projectSchema(tx);
      ensure(
        query.type === undefined || Object.hasOwn(schema.relationshipTypes, query.type),
        "validation",
        "Unknown relationship type",
      );
      const entity = await tx.get("entity", query.id);
      ensure(entity, "not_found", "Item no longer exists");
      const page = await tx.query("relationship", {
        type: query.type,
        after: query.after,
        incident: query.id,
        limit: query.limit ?? 25,
      });
      const items = [];
      for (const relationship of page.items as Relationship[]) {
        const source = (await tx.get("entity", relationship.source)) as Entity;
        const target = (await tx.get("entity", relationship.target)) as Entity;
        items.push({ relationship, source, target });
      }
      return {
        schema,
        entity,
        items,
        nextAfter: page.nextAfter,
        total: await tx.connectionCount(query.id, query.type),
      };
    });
  }
}
