import { ChangeAssessments } from "./change-assessments.ts";
import { Verification } from "./verification.ts";
import { ApplicationModels } from "./application-models.ts";
import { EvaluationExecutor } from "./evaluation-executor.ts";
import { Evaluations } from "./evaluations.ts";
import { referenceContext } from "./reference-query.ts";
import { createReference, checkResourceIdentity } from "./reference-command.ts";
import { changesetLimits } from "../core/command-limits.ts";
import { changesetCommandId, changesetIntent } from "./changeset-command.ts";
import { validateNativeEntity, validateNativeRelationship } from "./native-validation.ts";
import { previewSchema } from "./schema-preview.ts";
import type { SchemaPreviewInput } from "../core/schema-preview.ts";
import { captureCommand } from "./native-command.ts";
import { expectProjectRevision, expectVersion } from "./version-guard.ts";
import { readNative } from "./native-read.ts";
import type {
  CreateEntityCommand,
  UpdateEntityCommand,
  RemoveEntityCommand,
  CreateRelationshipCommand,
  UpdateRelationshipCommand,
  RemoveRelationshipCommand,
  SetSchemaCommand,
  ChangesetCommand,
  ChangesetResult,
} from "./commands.ts";
import type { EntityQuery, RelationshipQuery, WorkingSetQuery } from "../core/model.ts";
import { projectSnapshot } from "./project-snapshot.ts";
import { projectExport } from "./project-export.ts";
import { nextWork } from "./next-work.ts";
import type { NextWorkQuery } from "../core/next-work.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { NativeQueries } from "./native-queries.ts";
import { WorkingContextService } from "./working-context.ts";
import type { WorkingContext, WorkingContextQuery } from "../core/working-context.ts";
import {
  projectSchema,
  nativeObjects,
  validateObjectQuery,
  validatePageLimit,
  queryShape,
} from "./native-query-support.ts";
import {
  ensure,
  record,
  validateProvenance,
  validateSchema,
  type Entity,
  type HistoryQuery,
  type Provenance,
  type Relationship,
  type Schema,
  type SchemaObject,
} from "../core/model.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import type {
  ChangesetInput,
  Deletion,
  EntityEdit,
  EntityInput,
  Operation,
  RelationshipInput,
} from "./commands.ts";
import { EvidenceService, type Observer } from "./evidence.ts";
import { pinEntity } from "./native-pins.ts";
import { nativeTimeline } from "./temporal.ts";
import type {
  Connections,
  ConnectionsQuery,
  Graph,
  GraphQuery,
  Matrix,
  MatrixQuery,
  Table,
  TableQuery,
  WorkingSet,
  ChainQuery,
  ChainTable,
  FamilyQuery,
  FamilyWorkspace,
  RecordedConnections,
  RecordedConnectionsQuery,
} from "./views.ts";

import { Configurations } from "./configurations.ts";
import { SavedViews, initializeViews } from "./saved-views.ts";
import { Baselines } from "./baselines.ts";
import { Coverage } from "./coverage.ts";
import { ChangeImpactService } from "./impact.ts";
import type { ChangeImpact, ChangeImpactQuery } from "../core/impact.ts";

export type Runtime = { newId(): string };
export class Tracer {
  readonly evidence: EvidenceService;
  readonly evaluations: Evaluations;
  readonly applicationModels: ApplicationModels;
  readonly changeAssessments: ChangeAssessments;
  readonly verification: Verification;
  readonly savedViews: SavedViews;
  readonly configurations: Configurations;
  readonly baselines: Baselines;
  readonly coverage: Coverage;
  private queries: NativeQueries;
  private workingContext: WorkingContextService;
  private impact: ChangeImpactService;
  private repository: Repository;
  private runtime: Runtime;
  constructor(
    repository: Repository,
    runtime: Runtime = { newId: () => globalThis.crypto.randomUUID() },
    observer?: Observer,
  ) {
    this.repository = repository;
    this.runtime = runtime;
    this.applicationModels = new ApplicationModels(repository);
    this.verification = new Verification(repository);
    this.evidence = new EvidenceService(repository, () => this.runtime.newId(), observer);
    const evaluations = new EvaluationExecutor(
      repository,
      (tx, schema, operations, actor) => this.nativeBatch(tx, schema, operations, actor),
      () => this.runtime.newId(),
    );
    this.evaluations = new Evaluations(evaluations);
    this.changeAssessments = new ChangeAssessments(repository, evaluations);
    this.queries = new NativeQueries(repository, this.evidence);
    this.workingContext = new WorkingContextService(repository);
    this.savedViews = new SavedViews(repository, () => this.runtime.newId());
    this.configurations = new Configurations(repository, () => this.runtime.newId());
    this.baselines = new Baselines(repository, () => this.runtime.newId());
    this.coverage = new Coverage(repository, () => this.runtime.newId());
    this.impact = new ChangeImpactService(repository);
  }
  /** Read an exact native revision and its historical schema without creating a capture. */
  getReference(id: string) {
    return referenceContext(this.repository, id);
  }
  getNativePin(id: string, version: number) {
    return this.repository.transaction((tx) => pinEntity(tx, id, version));
  }
  /** Export current native state and all recorded provenance/evidence in one read snapshot. */
  exportProject() {
    return projectExport(this.repository);
  }
  getNextWork(query: NextWorkQuery = {}) {
    return nextWork(this.repository, query);
  }
  setSchema(command: SetSchemaCommand): Promise<SchemaObject>;
  setSchema(schema: Schema, expectedVersion: number, provenance: Provenance): Promise<SchemaObject>;
  async setSchema(value: Schema | SetSchemaCommand, version?: number, provenance?: Provenance) {
    const request =
      version === undefined
        ? captureCommand(value as SetSchemaCommand)
        : { schema: value as Schema, expectedVersion: version, provenance: provenance! };
    const origin = validateProvenance(request.provenance);
    const initialViews =
      "initialViews" in request ? snapshotInput(request.initialViews) : undefined;
    ensure(
      initialViews === undefined || request.expectedVersion === 0,
      "validation",
      "Initial views can only be installed with a new project model",
    );
    const schema = snapshotInput(request.schema);
    const expectedVersion = request.expectedVersion;
    validateSchema(schema);
    return this.repository.transaction(async (tx) => {
      const current = await tx.get("schema", "project");
      expectVersion(current?.version ?? 0, expectedVersion, true, {
        kind: "schema",
        id: "project",
      });
      for (const entity of await nativeObjects(tx, "entity"))
        validateNativeEntity(schema, entity as Entity);
      for (const link of await nativeObjects(tx, "relationship"))
        await validateNativeRelationship(tx, schema, link as Relationship);
      const result: SchemaObject = {
        entityTypes: schema.entityTypes,
        relationshipTypes: schema.relationshipTypes,
        ...(schema.coverageExpectations === undefined
          ? {}
          : { coverageExpectations: schema.coverageExpectations }),
        id: "project",
        version: expectedVersion + 1,
      };
      await tx.beginChangeset(this.runtime.newId(), result.version, origin);
      await tx.save("schema", result, expectedVersion);
      await initializeViews(tx, result, initialViews, () => this.runtime.newId());
      return result;
    });
  }
  applyChangeset(command: ChangesetCommand): Promise<ChangesetResult>;
  applyChangeset(input: ChangesetInput, provenance: Provenance): Promise<ChangesetResult>;
  async applyChangeset(input: ChangesetInput | ChangesetCommand, provenance?: Provenance) {
    const origin = validateProvenance(
      provenance === undefined ? captureCommand(input as ChangesetCommand).provenance : provenance,
    );
    input = snapshotInput(input);
    ensure(
      record(input) &&
        Number.isSafeInteger(input.expectedSchemaVersion) &&
        input.expectedSchemaVersion > 0 &&
        Array.isArray(input.operations) &&
        input.operations.length > 0 &&
        input.operations.length <= changesetLimits.maxOperations,
      "validation",
      "Changeset needs an expected schema version and 1–1000 operations",
    );
    if (input.commandId !== undefined) changesetCommandId(input.commandId);
    const intent = input.commandId === undefined ? undefined : changesetIntent(input, origin);
    return this.repository.transaction(async (tx) => {
      if (input.commandId !== undefined) {
        const previous = await tx.getChangesetCommand(input.commandId);
        if (previous) {
          ensure(
            previous.intent === intent,
            "conflict",
            "Command ID already belongs to a different changeset command",
            { path: ["commandId"] },
          );
          return previous.result;
        }
      }
      const schema = await projectSchema(tx, input.expectedSchemaVersion);
      if (input.expectedProjectRevision !== undefined)
        expectProjectRevision(await tx.headRevision(), input.expectedProjectRevision);
      const result = await this.nativeBatch(tx, schema, input.operations, origin);
      if (input.commandId !== undefined)
        await tx.appendChangesetCommand(input.commandId, intent!, result);
      return result;
    });
  }
  /** Read a committed command result; null means no success was visible in this snapshot.
   * It does not prove an in-flight command failed. No new revision is allocated.
   */
  async getChangesetOutcome(commandId: string): Promise<ChangesetResult | null> {
    changesetCommandId(commandId);
    return this.repository.transaction(
      async (tx) => (await tx.getChangesetCommand(commandId))?.result ?? null,
    );
  }
  private async nativeBatch(
    tx: Transaction,
    schema: SchemaObject,
    operations: Operation[],
    origin: Provenance,
  ): Promise<ChangesetResult> {
    const changeset = await tx.beginChangeset(this.runtime.newId(), schema.version, origin);
    const results: (Entity | Relationship | Deletion)[] = [];
    for (const operation of operations) results.push(await this.apply(tx, schema, operation));
    return { changeset, results };
  }
  private async apply(
    tx: Transaction,
    schema: SchemaObject,
    operation: Operation,
  ): Promise<Entity | Relationship | Deletion> {
    ensure(record(operation), "validation", "Invalid operation");
    if (operation.op === "reference.create")
      return createReference(tx, schema, operation, () => this.runtime.newId());
    if (operation.op === "entity.create" || operation.op === "relationship.create") {
      return this.createObject(tx, schema, operation);
    }
    ensure(
      ["entity.update", "entity.remove", "relationship.update", "relationship.remove"].includes(
        operation.op,
      ),
      "validation",
      "Unknown operation",
    );
    ensure(typeof operation.id === "string", "validation", "Object ID is required");
    const kind = operation.op.startsWith("entity.") ? "entity" : "relationship";
    const current = (await tx.get(kind, operation.id)) as Entity | Relationship | undefined;
    ensure(current, "not_found", "Object not found", { kind, id: operation.id });
    expectVersion(current.version, operation.expectedVersion, false, { kind, id: current.id });
    if (operation.op === "entity.update") {
      ensure(record(operation.input), "validation", "Object input is required");
      return this.updateNativeEntity(tx, schema, current as Entity, operation.input);
    }
    if (operation.op === "relationship.update") {
      ensure(record(operation.input), "validation", "Object input is required");
      const value: Relationship = {
        id: current.id,
        type: operation.input.type,
        source: operation.input.source,
        target: operation.input.target,
        fields: operation.input.fields,
        ...(operation.input.reference === undefined
          ? {}
          : { reference: operation.input.reference }),
        version: current.version + 1,
      };
      await validateNativeRelationship(tx, schema, value);
      await tx.save("relationship", value, current.version);
      return value;
    }
    if (operation.op === "entity.remove") {
      await this.removeIncidentConnections(tx, current.id, operation.cascade);
    }
    await tx.remove(kind, current.id, current.version);
    return { id: current.id, version: current.version + 1, deleted: true };
  }
  private async updateNativeEntity(
    tx: Transaction,
    schema: SchemaObject,
    current: Entity,
    input: EntityEdit,
  ): Promise<Entity> {
    ensure(
      input.type === undefined || input.type === current.type || current.type === "@resource",
      "validation",
      "Only resource-only identities can be promoted through this edit",
    );
    const value: Entity = {
      ...(current as Entity),
      fields: input.fields,
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.resource === undefined ? {} : { resource: input.resource }),
      ...(input.key === undefined ? {} : { key: input.key }),
      version: current.version + 1,
    };
    validateNativeEntity(schema, value);
    const previousResource = (current as Entity).resource;
    ensure(
      !previousResource ||
        (previousResource.source?.system === value.resource?.source?.system &&
          previousResource.source?.externalId === value.resource?.source?.externalId),
      "validation",
      "Resource source identity is immutable",
    );
    await checkResourceIdentity(tx, value);
    await tx.save("entity", value, current.version);
    for (const link of await nativeObjects(tx, "relationship", { incident: value.id }))
      await validateNativeRelationship(tx, schema, link as Relationship);
    return value;
  }
  private async createObject(
    tx: Transaction,
    schema: SchemaObject,
    operation: Extract<Operation, { op: "entity.create" | "relationship.create" }>,
  ): Promise<Entity | Relationship> {
    ensure(record(operation.input), "validation", "Object input is required");
    const id = operation.id ?? this.runtime.newId();
    ensure(
      typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id),
      "validation",
      "Identity must be a UUID",
    );
    if (operation.op === "entity.create") {
      const value: Entity = {
        id,
        version: 1,
        type: operation.input.type,
        fields: operation.input.fields,
        ...(operation.input.resource === undefined ? {} : { resource: operation.input.resource }),
        ...(operation.input.key === undefined ? {} : { key: operation.input.key }),
      };
      validateNativeEntity(schema, value);
      await checkResourceIdentity(tx, value);
      await tx.save("entity", value, 0);
      return value;
    }
    const value: Relationship = {
      id,
      version: 1,
      type: operation.input.type,
      source: operation.input.source,
      target: operation.input.target,
      fields: operation.input.fields,
      ...(operation.input.reference === undefined ? {} : { reference: operation.input.reference }),
    };
    await validateNativeRelationship(tx, schema, value);
    await this.checkConnectionCapture(tx, value, operation);
    await tx.save("relationship", value, 0);
    return value;
  }
  private async checkConnectionCapture(
    tx: Transaction,
    value: Relationship,
    operation: Extract<Operation, { op: "relationship.create" }>,
  ) {
    if (operation.expectedEndpoints !== undefined) {
      ensure(record(operation.expectedEndpoints), "validation", "Endpoint versions are required");
      const source = (await tx.get("entity", value.source)) as Entity;
      const target = (await tx.get("entity", value.target)) as Entity;
      expectVersion(source.version, operation.expectedEndpoints.sourceVersion, false, {
        kind: "entity",
        id: source.id,
      });
      expectVersion(target.version, operation.expectedEndpoints.targetVersion, false, {
        kind: "entity",
        id: target.id,
      });
    }
    ensure(
      operation.rejectExisting === undefined || typeof operation.rejectExisting === "boolean",
      "validation",
      "rejectExisting must be boolean",
    );
    if (operation.rejectExisting) {
      const existing = await tx.query("relationship", {
        source: value.source,
        target: value.target,
        type: value.type,
        limit: 1,
      });
      ensure(!existing.items.length, "conflict", "This connection already exists");
    }
  }
  private async removeIncidentConnections(
    tx: Transaction,
    id: string,
    cascade: boolean | undefined,
  ) {
    ensure(
      cascade === undefined || typeof cascade === "boolean",
      "validation",
      "Cascade must be boolean",
    );
    const links = (await nativeObjects(tx, "relationship", {
      incident: id,
    })) as Relationship[];
    ensure(
      cascade || links.length === 0,
      "referential_integrity",
      "Remove connected relationships first or explicitly request cascade",
    );
    for (const link of links) await tx.remove("relationship", link.id, link.version);
  }
  private async one(operation: Operation, expectedSchemaVersion: number, provenance: Provenance) {
    return (
      await this.applyChangeset({ expectedSchemaVersion, operations: [operation] }, provenance)
    ).results[0];
  }
  createEntity(command: CreateEntityCommand): Promise<Entity>;
  createEntity(
    input: EntityInput,
    expectedSchemaVersion: number,
    provenance: Provenance,
  ): Promise<Entity>;
  async createEntity(
    input: EntityInput | CreateEntityCommand,
    version?: number,
    provenance?: Provenance,
  ): Promise<Entity> {
    if (version === undefined) {
      const {
        expectedSchemaVersion,
        provenance: origin,
        id,
        ...value
      } = captureCommand(input as CreateEntityCommand);
      return this.one(
        { op: "entity.create", id, input: value },
        expectedSchemaVersion,
        origin,
      ) as Promise<Entity>;
    }
    return this.one({ op: "entity.create", input }, version, provenance!) as Promise<Entity>;
  }
  updateEntity(command: UpdateEntityCommand): Promise<Entity>;
  updateEntity(
    id: string,
    expectedVersion: number,
    input: EntityEdit,
    expectedSchemaVersion: number,
    provenance: Provenance,
  ): Promise<Entity>;
  async updateEntity(
    value: string | UpdateEntityCommand,
    expectedVersion?: number,
    input?: EntityEdit,
    version?: number,
    provenance?: Provenance,
  ): Promise<Entity> {
    if (typeof value !== "string") {
      const {
        id,
        expectedVersion: expected,
        expectedSchemaVersion,
        provenance: origin,
        ...fields
      } = captureCommand(value);
      return this.one(
        { op: "entity.update", id, expectedVersion: expected, input: fields },
        expectedSchemaVersion,
        origin,
      ) as Promise<Entity>;
    }
    return this.one(
      { op: "entity.update", id: value, expectedVersion: expectedVersion!, input: input! },
      version!,
      provenance!,
    ) as Promise<Entity>;
  }
  removeEntity(command: RemoveEntityCommand): Promise<Deletion>;
  removeEntity(
    id: string,
    expectedVersion: number,
    expectedSchemaVersion: number,
    provenance: Provenance,
    cascade?: boolean,
  ): Promise<Deletion>;
  async removeEntity(
    value: string | RemoveEntityCommand,
    expectedVersion?: number,
    version?: number,
    provenance?: Provenance,
    cascade = false,
  ): Promise<Deletion> {
    if (typeof value !== "string") {
      const {
        id,
        expectedVersion: expected,
        expectedSchemaVersion,
        provenance: origin,
        cascade,
      } = captureCommand(value);
      return this.one(
        { op: "entity.remove", id, expectedVersion: expected, cascade },
        expectedSchemaVersion,
        origin,
      ) as Promise<Deletion>;
    }
    return this.one(
      { op: "entity.remove", id: value, expectedVersion: expectedVersion!, cascade },
      version!,
      provenance!,
    ) as Promise<Deletion>;
  }
  createRelationship(command: CreateRelationshipCommand): Promise<Relationship>;
  createRelationship(
    input: RelationshipInput,
    expectedSchemaVersion: number,
    provenance: Provenance,
  ): Promise<Relationship>;
  async createRelationship(
    input: RelationshipInput | CreateRelationshipCommand,
    version?: number,
    provenance?: Provenance,
  ): Promise<Relationship> {
    if (version === undefined) {
      const {
        expectedSchemaVersion,
        provenance: origin,
        id,
        expectedEndpoints,
        rejectExisting,
        ...value
      } = captureCommand(input as CreateRelationshipCommand);
      return this.one(
        { op: "relationship.create", id, expectedEndpoints, rejectExisting, input: value },
        expectedSchemaVersion,
        origin,
      ) as Promise<Relationship>;
    }
    return this.one(
      { op: "relationship.create", input },
      version,
      provenance!,
    ) as Promise<Relationship>;
  }
  updateRelationship(command: UpdateRelationshipCommand): Promise<Relationship>;
  updateRelationship(
    id: string,
    expectedVersion: number,
    input: RelationshipInput,
    expectedSchemaVersion: number,
    provenance: Provenance,
  ): Promise<Relationship>;
  async updateRelationship(
    value: string | UpdateRelationshipCommand,
    expectedVersion?: number,
    input?: RelationshipInput,
    version?: number,
    provenance?: Provenance,
  ): Promise<Relationship> {
    if (typeof value !== "string") {
      const {
        id,
        expectedVersion: expected,
        expectedSchemaVersion,
        provenance: origin,
        ...fields
      } = captureCommand(value);
      return this.one(
        { op: "relationship.update", id, expectedVersion: expected, input: fields },
        expectedSchemaVersion,
        origin,
      ) as Promise<Relationship>;
    }
    return this.one(
      { op: "relationship.update", id: value, expectedVersion: expectedVersion!, input: input! },
      version!,
      provenance!,
    ) as Promise<Relationship>;
  }
  removeRelationship(command: RemoveRelationshipCommand): Promise<Deletion>;
  removeRelationship(
    id: string,
    expectedVersion: number,
    expectedSchemaVersion: number,
    provenance: Provenance,
  ): Promise<Deletion>;
  async removeRelationship(
    value: string | RemoveRelationshipCommand,
    expectedVersion?: number,
    version?: number,
    provenance?: Provenance,
  ): Promise<Deletion> {
    if (typeof value !== "string") {
      const {
        id,
        expectedVersion: expected,
        expectedSchemaVersion,
        provenance: origin,
      } = captureCommand(value);
      return this.one(
        { op: "relationship.remove", id, expectedVersion: expected },
        expectedSchemaVersion,
        origin,
      ) as Promise<Deletion>;
    }
    return this.one(
      { op: "relationship.remove", id: value, expectedVersion: expectedVersion! },
      version!,
      provenance!,
    ) as Promise<Deletion>;
  }
  /** Explicit whole-field replacement; omitted fields are removed, not merged. */
  replaceEntityFields(command: UpdateEntityCommand): Promise<Entity> {
    return this.updateEntity(command);
  }
  getEntity(id: string): Promise<Entity> {
    return readNative(this.repository, "entity", id);
  }
  getRelationship(id: string): Promise<Relationship> {
    return readNative(this.repository, "relationship", id);
  }
  previewSchema(input: SchemaPreviewInput) {
    return previewSchema(this.repository, input);
  }
  getSchema() {
    return this.repository.transaction((tx) => tx.get("schema", "project"));
  }
  timeline(before?: number) {
    return this.repository.transaction((tx) => nativeTimeline(tx, before));
  }
  getGraph(query: GraphQuery): Promise<Graph> {
    return this.queries.getGraph(query);
  }
  getChangeImpact(query: ChangeImpactQuery): Promise<ChangeImpact> {
    return this.impact.get(query);
  }
  async getTable(query: TableQuery): Promise<Table> {
    return this.queries.getTable(query);
  }
  async getMatrix(query: MatrixQuery): Promise<Matrix> {
    return this.queries.getMatrix(query);
  }
  getChain(query: ChainQuery): Promise<ChainTable> {
    return this.queries.getChain(query);
  }
  getWorkingSet(query: WorkingSetQuery = {}): Promise<WorkingSet> {
    return this.queries.getWorkingSet(query);
  }
  getRecordedConnections(query: RecordedConnectionsQuery): Promise<RecordedConnections> {
    return this.queries.getRecordedConnections(query);
  }
  getFamily(query: FamilyQuery): Promise<FamilyWorkspace> {
    return this.queries.getFamily(query);
  }
  getWorkingContext(query: WorkingContextQuery): Promise<WorkingContext> {
    return this.workingContext.get(query);
  }
  getConnections(query: ConnectionsQuery): Promise<Connections> {
    return this.queries.getConnections(query);
  }
  getProjectSnapshot() {
    return this.repository.transaction(projectSnapshot);
  }
  async queryEntities(query: EntityQuery = {}) {
    query = snapshotInput(query);
    validateObjectQuery(query, "entity");
    return this.repository.transaction((tx) => tx.query("entity", query)) as Promise<
      import("../core/model.ts").Page<Entity>
    >;
  }
  async queryRelationships(query: RelationshipQuery = {}) {
    query = snapshotInput(query);
    validateObjectQuery(query, "relationship");
    return this.repository.transaction((tx) => tx.query("relationship", query)) as Promise<
      import("../core/model.ts").Page<Relationship>
    >;
  }
  async history(query: HistoryQuery = {}) {
    query = snapshotInput(query);
    queryShape(query, ["kind", "id", "after", "limit"], "Invalid history query");
    validatePageLimit(query.limit);
    ensure(
      query.kind === undefined || ["schema", "entity", "relationship"].includes(query.kind),
      "validation",
      "Invalid history kind",
    );
    ensure(
      query.id === undefined || typeof query.id === "string",
      "validation",
      "Invalid history ID",
    );
    ensure(
      query.after === undefined ||
        (typeof query.after === "string" &&
          /^\d+:\d+$/.test(query.after) &&
          query.after.split(":").every((value) => Number.isSafeInteger(Number(value)))),
      "validation",
      "Invalid history cursor",
    );
    return this.repository.transaction((tx) => tx.history(query));
  }
  async changesets(afterRevision = 0, limit = 100) {
    validatePageLimit(limit);
    ensure(
      Number.isSafeInteger(afterRevision) && afterRevision >= 0,
      "validation",
      "Invalid project revision",
    );
    return this.repository.transaction((tx) => tx.changesets(afterRevision, limit));
  }
  async traverse(
    id: string,
    options: {
      direction?: "forward" | "reverse" | "both";
      type?: string;
      maxDepth?: number;
      maxNodes?: number;
    } = {},
  ) {
    options = snapshotInput(options);
    const { direction, maxDepth, maxNodes } = traversalOptions(id, options);
    return this.repository.transaction(async (tx) => {
      ensure(await tx.get("entity", id), "not_found", "Entity not found");
      const visited = new Set([id]),
        queue = [{ id, depth: 0 }];
      function visit(next: string, depth: number) {
        if (!visited.has(next)) {
          ensure(
            queue.length - 1 < maxNodes,
            "validation",
            "Traversal node limit exceeded; narrow the query",
          );
          visited.add(next);
          const item = { id: next, depth: depth + 1 };
          queue.push(item);
        }
      }
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (current.depth >= maxDepth) continue;
        const endpoint =
          direction === "forward"
            ? { source: current.id }
            : direction === "reverse"
              ? { target: current.id }
              : { incident: current.id };
        for (const link of (await nativeObjects(tx, "relationship", {
          ...endpoint,
          type: options.type,
        })) as Relationship[]) {
          const next =
            link.source === current.id && direction !== "reverse" ? link.target : link.source;
          visit(next, current.depth);
        }
      }
      return queue.slice(1);
    });
  }
}

function traversalOptions(
  id: string,
  options: {
    direction?: "forward" | "reverse" | "both";
    type?: string;
    maxDepth?: number;
    maxNodes?: number;
  },
) {
  const direction = options.direction ?? "forward",
    maxDepth = options.maxDepth ?? Number.MAX_SAFE_INTEGER,
    maxNodes = options.maxNodes ?? 10000;
  ensure(
    typeof id === "string" &&
      ["forward", "reverse", "both"].includes(direction) &&
      validTraversalBounds(maxDepth, maxNodes) &&
      (options.type === undefined || typeof options.type === "string"),
    "validation",
    "Invalid traversal options",
  );
  return { direction, maxDepth, maxNodes };
}

function validTraversalBounds(depth: number, nodes: number) {
  return (
    Number.isSafeInteger(depth) &&
    depth >= 0 &&
    Number.isSafeInteger(nodes) &&
    nodes > 0 &&
    nodes <= 10000
  );
}
