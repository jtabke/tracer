import { validateSchema } from "../core/model.ts";
import type { SchemaObject, Entity, Relationship, Revision, Changeset } from "../core/model.ts";
import { viewDefinition } from "../core/presentation.ts";
import type { SavedView } from "../core/presentation.ts";
import type { Configuration, PinnedEntity } from "../core/configuration.ts";
import type { Baseline } from "../core/baseline.ts";
import type {
  ExternalIdentity,
  Observation,
  CapturedInput,
  Receipt,
  ComparedState,
  Review,
  Comparison,
} from "../core/evidence.ts";
import type {
  ReadPath,
  ReadQuery,
  ReadResponse,
  WritePath,
  WriteResponse,
  EvidenceByKind,
} from "./api-contract.ts";
import type { Decoder } from "./decode.ts";
import { coverageDecoders } from "./coverage-decoders.ts";
import { workingContextDecoder, validateWorkingContextScope } from "./working-context-decoders.ts";
import {
  text,
  number,
  integer,
  boolean,
  fields,
  literal,
  optional,
  nullable,
  array,
  object,
  union,
  page,
} from "./decode.ts";

const schema: Decoder<SchemaObject> = (value) => {
  validateSchema(value);
  object({ id: literal("project"), version: number })(value);
  return value as SchemaObject;
};
const entity: Decoder<Entity> = object({
  id: text,
  version: number,
  type: text,
  key: optional(text),
  fields,
});
const relationship: Decoder<Relationship> = object({
  id: text,
  version: number,
  type: text,
  source: text,
  target: text,
  fields,
});
const stored = union(schema, union(relationship, entity));
const changeset: Decoder<Changeset> = object({
  id: text,
  at: text,
  actor: text,
  reason: optional(text),
  projectRevision: number,
  schemaVersion: number,
});
const revision: Decoder<Revision> = object({
  revisionId: text,
  changesetId: text,
  projectRevision: number,
  ordinal: number,
  schemaVersion: number,
  kind: literal("schema", "entity", "relationship"),
  id: text,
  version: number,
  snapshot: nullable(stored),
});
const pin: Decoder<PinnedEntity> = object({
  entity,
  revisionId: text,
  changesetId: text,
  projectRevision: number,
  schema,
});
const configuration: Decoder<Configuration> = object({
  id: text,
  at: text,
  actor: text,
  reason: optional(text),
  name: text,
  subject: entity,
  members: array(pin),
  relationships: optional(
    array(
      object({
        relationship,
        revisionId: text,
        changesetId: text,
        projectRevision: number,
        schema,
      }),
    ),
  ),
});
const baseline: Decoder<Baseline> = object({
  id: text,
  name: text,
  at: text,
  actor: text,
  reason: optional(text),
  projectRevision: number,
  changesetId: text,
  schemaVersion: number,
  capturedAtProjectRevision: number,
});
const savedView: Decoder<SavedView> = object({
  id: text,
  name: text,
  version: number,
  definition: viewDefinition,
});
const coverage = coverageDecoders(entity, relationship, baseline);
const external: Decoder<ExternalIdentity> = object({
  id: text,
  at: text,
  actor: text,
  system: literal("git", "file"),
  externalId: text,
  ownership: literal("external"),
});
const locator = union(
  object({ system: literal("git"), repository: text, path: text, ref: text }),
  object({ system: literal("file"), path: text }),
);
const observation: Decoder<Observation> = object({
  id: text,
  entityId: text,
  at: text,
  actor: text,
  reason: optional(text),
  locator,
  availability: literal("available", "unknown"),
  commit: optional(text),
  hash: optional(text),
});
const capturedInput: Decoder<CapturedInput> = object({
  entityId: text,
  expectedVersion: optional(number),
  revision: optional(number),
  observationId: optional(text),
  fields: optional(array(text)),
  path: optional(array(text)),
  entity,
  observation: optional(observation),
  links: array(relationship),
  pin: optional(pin),
});
const receipt: Decoder<Receipt> = object({
  id: text,
  at: text,
  actor: text,
  reason: optional(text),
  output: entity,
  schema,
  outcome: text,
  inputs: array(capturedInput),
  supersedes: optional(text),
  configuration: optional(object({ id: text, name: text, subject: entity })),
});
const compared = {
  receiptId: text,
  state: literal("current", "changed", "unknown"),
  hasChanged: boolean,
  hasUnknown: boolean,
  inputs: array(
    object({
      entityId: text,
      dependencyPath: array(text),
      state: literal("current", "changed", "unknown"),
      hasChanged: boolean,
      hasUnknown: boolean,
      reasons: array(text),
      recorded: capturedInput,
      current: object({
        entity: nullable(entity),
        observation: nullable(observation),
        links: array(nullable(relationship)),
      }),
    }),
  ),
};
const comparedState: Decoder<ComparedState> = object(compared);
const review: Decoder<Review> = object({
  id: text,
  at: text,
  actor: text,
  reason: optional(text),
  receiptId: text,
  decision: literal("accepted", "acknowledged", "needs_reevaluation"),
  rationale: text,
  comparison: comparedState,
  token: text,
});
const reviewState = object({
  state: literal("unreviewed", "accepted", "acknowledged", "needs_reevaluation"),
  decision: optional(review),
  previous: optional(review),
});
const workingComparison = object({ ...compared, token: text, review: reviewState });
const comparison: Decoder<Comparison> = object({
  ...compared,
  token: text,
  review: reviewState,
  supersededBy: array(text),
});
const evidence: { [K in keyof EvidenceByKind]: Decoder<EvidenceByKind[K]> } = {
  external,
  observation,
  receipt,
  review,
};
const direction = literal("incoming", "outgoing");
const column = object({ relationshipType: text, targetType: text, direction });
const chainQuery = object({
  type: text,
  steps: array(object({ type: text, relationshipType: text, direction: optional(direction) })),
  search: optional(text),
  after: optional(text),
  limit: optional(number),
});
const guide = object({
  title: text,
  description: text,
  tasks: array(
    object({
      title: text,
      root: text,
      rootId: text,
      relationship: text,
      direction,
      explanation: text,
      presentation: optional(object({ layout: literal("trace"), columns: array(column) })),
    }),
  ),
  chains: array(object({ title: text, query: chainQuery })),
});
function delta<T>(value: Decoder<T>) {
  return object({
    id: text,
    state: literal("added", "removed", "modified", "unchanged"),
    before: nullable(value),
    after: nullable(value),
  });
}
const reads: { [K in ReadPath]: Decoder<ReadResponse<K>> } = {
  "/api/working-context": workingContextDecoder(schema, entity, relationship, workingComparison),
  "/api/impact": object({
    context: object({
      baseline,
      beforeSchema: schema,
      afterSchema: schema,
      projectRevision: integer(1),
      evidenceRevision: integer(),
    }),
    scope: object({
      rootId: text,
      direction: literal("incoming", "outgoing", "both"),
      relationshipTypes: array(text),
      depth: integer(1),
    }),
    native: object({
      entities: array(delta(entity)),
      relationships: array(delta(relationship)),
      before: reachability(),
      after: reachability(),
    }),
    evaluations: page(
      object({
        receipt,
        comparison: comparedState,
        scope: object({
          inputIds: array(text),
          relationshipIds: array(text),
          state: literal("current", "changed", "unknown"),
          hasChanged: boolean,
          hasUnknown: boolean,
        }),
        supersession: object({ count: integer(), ids: array(text) }),
      }),
    ),
    summary: object({
      scope: literal("page"),
      evaluated: integer(),
      current: integer(),
      changed: integer(),
      unknown: integer(),
    }),
  }),
  "/api/coverage-expectations": coverage.catalogue,
  "/api/coverage": coverage.evaluation,
  "/api/baselines": page(baseline),
  "/api/baseline": baseline,
  "/api/baseline-contents": object({
    baseline,
    schema,
    objects: page(union(relationship, entity)),
  }),
  "/api/session": object({ token: text }),
  "/api/projects": array(object({ id: text, title: text })),
  "/api/schema": nullable(schema),
  "/api/project-snapshot": object({
    schema: nullable(schema),
    projectRevision: integer(),
    entities: array(entity),
    relationships: array(relationship),
  }),
  "/api/demo-guide": nullable(guide),
  "/api/saved-views": array(savedView),
  "/api/configurations": page(configuration),
  "/api/configuration": configuration,
  "/api/native-pin": pin,
  "/api/entities": page(entity),
  "/api/relationships": page(relationship),
  "/api/history": page(revision),
  "/api/timeline": object({ head: number, items: array(changeset), nextBefore: optional(number) }),
  "/api/evidence": page(union(external, union(observation, union(receipt, review)))),
  "/api/comparison": comparison,
  "/api/receipt": receipt,
  "/api/table": object({ schema, entities: page(entity) }),
  "/api/matrix": object({
    schema,
    sources: page(entity),
    targets: page(entity),
    links: array(relationship),
    missingSourceIds: array(text),
  }),
  "/api/graph": object({
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
  "/api/work": object({
    schema,
    entities: page(entity),
    total: number,
    types: array(object({ type: text, count: number })),
  }),
  "/api/family": object({
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
  "/api/connections": object({
    schema,
    entity,
    total: number,
    nextAfter: optional(text),
    items: array(object({ relationship, source: entity, target: entity })),
  }),
  "/api/chain": object({
    schema,
    roots: page(entity),
    rows: array(object({ cells: array(nullable(entity)), links: array(nullable(relationship)) })),
  }),
  "/api/model-connections": object({
    schema,
    relationships: page(relationship),
    endpoints: array(object({ id: text, type: text, key: optional(text), title: optional(text) })),
  }),
};
function reachability() {
  return object({
    paths: array(object({ entityId: text, depth: integer(), relationshipIds: array(text) })),
    expandedIds: array(text),
    frontierIds: array(text),
  });
}
const writes: { [K in WritePath]: Decoder<WriteResponse<K>> } = {
  "/api/coverage-expectations": schema,
  "/api/baselines": baseline,
  "/api/schema": schema,
  "/api/changesets": object({
    changeset,
    results: array(
      union(
        relationship,
        union(entity, object({ id: text, version: number, deleted: literal(true) })),
      ),
    ),
  }),
  "/api/configurations": configuration,
  "/api/saved-views": savedView,
  "/api/saved-views/remove": object({ removed: literal(true) }),
  "/api/external": external,
  "/api/observations": observation,
  "/api/receipts": receipt,
  "/api/reviews": review,
};
export function decodeRead<K extends ReadPath>(
  path: K,
  query: ReadQuery<K>,
  value: unknown,
): ReadResponse<K> {
  if (path === "/api/working-context") {
    const result = reads["/api/working-context"](value);
    validateWorkingContextScope(result, query as ReadQuery<"/api/working-context">);
    return result as ReadResponse<K>;
  }
  if (path === "/api/evidence" && "kind" in query) {
    const kind = literal("external", "observation", "receipt", "review")(query.kind);
    return page<ReadResponse<"/api/evidence">["items"][number]>(evidence[kind])(
      value,
    ) as ReadResponse<K>;
  }
  return reads[path](value);
}
export function decodeWrite<K extends WritePath>(path: K, value: unknown): WriteResponse<K> {
  return writes[path](value);
}
