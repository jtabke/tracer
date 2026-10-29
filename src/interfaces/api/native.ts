import type { ExactConfigurationInput } from "../../core/configuration.ts";
import { configurationComparison } from "./configuration-comparison.ts";
import { configurationReceiptComparison } from "./configuration-applicability.ts";
import { exactConfigurationInputFields } from "./configuration-input.ts";
import { canonical } from "../../core/evidence.ts";
import { viewDefinition } from "../../core/presentation.ts";
import {
  baseline,
  changeset,
  changesetResult,
  comparison,
  configuration,
  delta,
  entity,
  external,
  observation,
  pin,
  receipt,
  relationship,
  review,
  revision,
  savedView,
  schema,
} from "../api-models.ts";
import {
  array,
  boolean,
  integer,
  literal,
  nullable,
  number,
  object,
  optional,
  page,
  text,
  union,
} from "../decode.ts";
import { read, write } from "./definition.ts";
import { inputSchema, operation, strictObject } from "./input.ts";
import * as q from "./query.ts";
export const nativeReads = {
  "/api/configuration-receipt-comparison": read({
    features: ["configuration-input-comparison"],
    query: q.query({ configurationId: q.textParam, receiptId: q.textParam }),
    response: configurationReceiptComparison,
    handle: ({ tracer }, input) => tracer.configurations.compareReceipt(input),
  }),
  "/api/configuration-comparison": read({
    features: ["configuration-comparison"],
    query: q.query({ beforeId: q.textParam, afterId: q.textParam }),
    response: configurationComparison,
    handle: ({ tracer }, input) => tracer.configurations.compare(input),
  }),
  "/api/configuration-capture-context": read({
    features: ["exact-configuration-captures"],
    query: q.query({}, { empty: "Configuration capture context accepts no filters" }),
    response: object({ schema, projectRevision: integer(1), evidenceRevision: integer() }),
    handle: ({ tracer }) => tracer.configurations.captureContext(),
  }),
  "/api/reference": read({
    features: ["qualified-references"],
    query: q.query({ id: q.textParam }),
    response: object({
      relationship,
      resource: entity,
      selectedObservation: nullable(observation),
      latestObservation: nullable(observation),
      nativeVersion: number,
      sourceChanged: nullable(boolean),
      availability: literal("available", "unknown"),
      contentRetention: text,
      passage: text,
    }),
    handle: ({ tracer }, input) => tracer.getReference(input.id),
  }),
  "/api/changeset-outcome": read({
    query: q.query({ commandId: q.textParam }),
    response: nullable(changesetResult),
    handle: ({ tracer }, input) => tracer.getChangesetOutcome(input.commandId),
  }),
  "/api/project-export": read({
    query: q.query({}, { empty: "Project export accepts no filters" }),
    response: object({
      format: literal("tracer-project-export"),
      formatVersion: literal(1),
      scope: object({
        nativeHistory: literal("all-recorded"),
        evidence: literal("all-recorded"),
        externalContent: literal("references-only"),
      }),
      projectRevision: integer(),
      evidenceRevision: integer(),
      current: object({
        schema: nullable(schema),
        entities: array(entity),
        relationships: array(relationship),
      }),
      provenance: object({ changesets: array(changeset), revisions: array(revision) }),
      evidence: object({
        external: array(external),
        observations: array(observation),
        receipts: array(receipt),
        reviews: array(review),
      }),
      configurations: array(configuration),
      baselines: array(baseline),
      savedViews: array(savedView),
    }),
    handle: ({ tracer }) => tracer.exportProject(),
  }),
  "/api/project-snapshot": read({
    query: q.query({}, { empty: "Project snapshot accepts no filters" }),
    response: object({
      schema: nullable(schema),
      projectRevision: integer(),
      entities: array(entity),
      relationships: array(relationship),
    }),
    handle: ({ tracer }) => tracer.getProjectSnapshot(),
  }),
  "/api/baselines": read({
    query: q.query(q.pageParams),
    response: page(baseline),
    handle: ({ tracer }, q) => tracer.baselines.list(q),
  }),
  "/api/baseline": read({
    query: q.query(
      { id: q.textParam },
      { exact: { code: "validation", message: "Baseline requires id" } },
    ),
    response: baseline,
    handle: ({ tracer }, q) => tracer.baselines.get(q.id),
  }),
  "/api/baseline-contents": read({
    query: q.query({
      ...q.pageParams,
      baselineId: q.textParam,
      kind: q.choice("entity", "relationship"),
    }),
    response: object({
      baseline,
      schema,
      objects: page(union(relationship, entity)),
    }),
    handle: ({ tracer }, q) => tracer.baselines.contents(q),
  }),
  "/api/schema": read({
    query: q.query({}, { empty: "Schema accepts no filters" }),
    response: nullable(schema),
    handle: async ({ tracer }) => (await tracer.getSchema()) ?? null,
  }),
  "/api/saved-views": read({
    query: q.query({}, { empty: "Saved views accept no filters" }),
    response: array(savedView),
    handle: ({ tracer }) => tracer.savedViews.list(),
  }),
  "/api/configurations": read({
    query: q.query(q.evidencePage),
    response: page(configuration),
    handle: ({ tracer }, q) => tracer.configurations.list(q),
  }),
  "/api/configuration": read({
    query: q.query(
      { id: q.textParam },
      { exact: { code: "validation", message: "Configuration requires id" } },
    ),
    response: (value, query) => {
      const captured = configuration(value);
      if (captured.id !== query.id)
        throw new Error("Configuration does not match requested identity");
      return captured;
    },
    handle: ({ tracer }, q) => tracer.configurations.get(q.id),
  }),
  "/api/native-pin": read({
    query: q.query(
      { id: q.textParam, version: q.positive },
      {
        exact: {
          code: "validation",
          message: "Native revision requires an id and positive exact version",
        },
        invalid: {
          code: "validation",
          message: "Native revision requires an id and positive exact version",
        },
      },
    ),
    response: pin,
    handle: ({ tracer }, q) => tracer.getNativePin(q.id, q.version),
  }),
  "/api/entities": read({
    query: q.query({
      ...q.pageParams,
      type: q.optionalParam(q.textParam),
      key: q.optionalParam(q.textParam),
      search: q.optionalParam(q.textParam),
    }),
    response: page(entity),
    handle: ({ tracer }, q) => tracer.queryEntities(q),
  }),
  "/api/relationships": read({
    query: q.query({
      ...q.pageParams,
      type: q.optionalParam(q.textParam),
      source: q.optionalParam(q.textParam),
      target: q.optionalParam(q.textParam),
      incident: q.optionalParam(q.textParam),
    }),
    response: page(relationship),
    handle: ({ tracer }, q) => tracer.queryRelationships(q),
  }),
  "/api/history": read({
    query: q.query({
      ...q.pageParams,
      kind: q.optionalParam(q.choice("schema", "entity", "relationship")),
      id: q.optionalParam(q.textParam),
    }),
    response: page(revision),
    handle: ({ tracer }, q) => tracer.history(q),
  }),
  "/api/timeline": read({
    query: q.query(
      { before: q.optionalParam(q.integerParam) },
      { unknown: { code: "usage", message: "Invalid timeline query" } },
    ),
    response: object({ head: number, items: array(changeset), nextBefore: optional(number) }),
    handle: ({ tracer }, q) => tracer.timeline(q.before),
  }),
  "/api/table": read({
    query: q.query({ ...q.pageParams, type: q.textParam, focusId: q.optionalParam(q.textParam) }),
    response: object({ schema, entities: page(entity) }),
    handle: ({ tracer }, q) => tracer.getTable(q),
  }),
  "/api/matrix": read({
    query: q.query({
      sourceType: q.textParam,
      targetType: q.textParam,
      relationshipType: q.textParam,
      sourceFocus: q.optionalParam(q.textParam),
      targetFocus: q.optionalParam(q.textParam),
      sourceAfter: q.optionalParam(q.textParam),
      targetAfter: q.optionalParam(q.textParam),
      limit: q.optionalParam(q.integerParam),
    }),
    response: object({
      schema,
      sources: page(entity),
      targets: page(entity),
      links: array(relationship),
      missingSourceIds: array(text),
    }),
    handle: ({ tracer }, q) => tracer.getMatrix(q),
  }),
  "/api/graph": read({
    query: q.query({
      rootId: q.textParam,
      expanded: q.optionalParam(q.csv),
      depth: q.optionalParam(q.integerParam),
      atRevision: q.optionalParam(q.integerParam),
      compareRevision: q.optionalParam(q.integerParam),
    }),
    response: object({
      schema,
      rootId: text,
      expanded: array(text),
      trace: optional(object({ depth: number, frontier: array(text) })),
      nodes: array(entity),
      links: array(relationship),
      evaluations: array(object({ receipt, comparison })),
      external: array(object({ identity: external, observation: nullable(observation) })),
      temporal: optional(object({ at: changeset, before: optional(changeset) })),
      differences: optional(
        object({ nodes: array(delta(entity)), links: array(delta(relationship)) }),
      ),
    }),
    handle: ({ tracer }, q) => tracer.getGraph(q),
  }),
  "/api/work": read({
    query: q.query({
      ...q.pageParams,
      type: q.optionalParam(q.textParam),
      key: q.optionalParam(q.textParam),
      search: q.optionalParam(q.textParam),
      field: q.optionalParam(q.textParam),
      value: q.optionalParam(q.textParam),
      without: q.optionalParam(q.textParam),
      targetType: q.optionalParam(q.textParam),
    }),
    response: object({
      schema,
      entities: page(entity),
      total: number,
      types: array(object({ type: text, count: number })),
    }),
    handle: ({ tracer }, q) => tracer.getWorkingSet(q),
  }),
  "/api/family": read({
    query: q.query({
      ...q.pageParams,
      rootId: q.textParam,
      relationshipType: q.optionalParam(q.textParam),
      direction: q.optionalParam(q.choice("incoming", "outgoing")),
    }),
    response: object({
      schema,
      projectRevision: number,
      root: entity,
      members: array(entity),
      membership: array(relationship),
      nextAfter: optional(text),
      connections: array(object({ entityId: text, total: number, loaded: number })),
      nodes: array(entity),
      links: array(relationship),
    }),
    handle: ({ tracer }, q) => tracer.getFamily(q),
  }),
  "/api/connections": read({
    query: q.query({ ...q.pageParams, id: q.textParam, type: q.optionalParam(q.textParam) }),
    response: object({
      schema,
      entity,
      total: number,
      nextAfter: optional(text),
      items: array(object({ relationship, source: entity, target: entity })),
    }),
    handle: ({ tracer }, q) => tracer.getConnections(q),
  }),
  "/api/chain": read({
    query: q.query({
      ...q.pageParams,
      type: q.textParam,
      steps: q.jsonParam(
        array(
          strictObject({
            type: text,
            relationshipType: text,
            direction: optional(literal("incoming", "outgoing")),
          }),
        ),
        "Invalid chain steps JSON",
        "Chain needs column steps",
      ),
      search: q.optionalParam(q.textParam),
    }),
    response: object({
      schema,
      roots: page(entity),
      rows: array(object({ cells: array(nullable(entity)), links: array(nullable(relationship)) })),
    }),
    handle: ({ tracer }, q) => tracer.getChain(q),
  }),
  "/api/model-connections": read({
    query: q.query({ ...q.pageParams, type: q.textParam }),
    response: object({
      schema,
      relationships: page(relationship),
      endpoints: array(
        object({ id: text, type: text, key: optional(text), title: optional(text) }),
      ),
    }),
    handle: ({ tracer }, q) => tracer.getRecordedConnections(q),
  }),
};
export const nativeWrites = {
  "/api/baselines": write(
    {
      id: optional(text),
      name: text,
      expectedProjectRevision: number,
      projectRevision: optional(number),
    },
    baseline,
  )(({ tracer, provenance }, input) => tracer.baselines.capture(input, provenance)),
  "/api/schema": write(
    {
      schema: inputSchema,
      expectedVersion: number,
      initialViews: optional(array(strictObject({ name: text, definition: viewDefinition }))),
    },
    schema,
  )(({ tracer, provenance }, input) => {
    return tracer.setSchema({
      ...input,
      provenance: { reason: "Define project schema", ...provenance },
    });
  }),
  "/api/changesets": write(
    {
      commandId: optional(text),
      expectedSchemaVersion: number,
      expectedProjectRevision: optional(number),
      operations: array(operation),
    },
    changesetResult,
    { features: ["changeset-command-recovery", "native-resources", "qualified-references"] },
  )(({ tracer, provenance }, input) =>
    tracer.applyChangeset(input, { reason: "Interactive edit", ...provenance }),
  ),
  "/api/configuration-captures": write(
    exactConfigurationInputFields,
    (value: unknown, input?: ExactConfigurationInput) => {
      const captured = configuration(value);
      if (!captured.capture || (input && canonical(captured.capture.intent) !== canonical(input)))
        throw new Error("Configuration result does not match original intent");
      return captured;
    },
    { features: ["exact-configuration-captures", "evidence-revision-guards"] },
  )(({ tracer, provenance }, input) => tracer.configurations.captureExact(input, provenance)),
  "/api/configurations": write(
    {
      name: text,
      subjectId: text,
      expectedSubjectVersion: number,
      members: array(strictObject({ entityId: text, version: number })),
      relationships: optional(array(strictObject({ relationshipId: text, version: number }))),
    },
    configuration,
  )(({ tracer, provenance }, input) => tracer.configurations.capture(input, provenance)),
  "/api/saved-views": write(
    {
      id: optional(text),
      name: text,
      definition: viewDefinition,
      expectedVersion: number,
      expectedSchemaVersion: number,
    },
    savedView,
  )(({ tracer }, input) => tracer.savedViews.save(input)),
  "/api/saved-views/remove": write(
    { id: text, expectedVersion: number },
    object({ removed: literal(true) }),
  )(async ({ tracer }, input) => {
    await tracer.savedViews.remove(input.id, input.expectedVersion);
    return { removed: true as const };
  }),
};
