import type { ErrorCode, ErrorDetails } from "../core/model.ts";
import type { WorkingContext, WorkingContextQuery } from "../core/working-context.ts";
import type { ChangeImpact, ChangeImpactQuery } from "../core/impact.ts";
import type {
  Schema,
  SchemaObject,
  Entity,
  Relationship,
  Page,
  EntityQuery,
  RelationshipQuery,
  WorkingSetQuery,
  HistoryQuery,
  Revision,
  Changeset,
} from "../core/model.ts";
import type {
  Evidence,
  EvidenceKind,
  EvidenceQuery,
  ExternalIdentity,
  Observation,
  Receipt,
  Review,
  Locator,
  ReceiptInput,
  ReviewInput,
  Comparison,
} from "../core/evidence.ts";
import type { Configuration, ConfigurationInput, PinnedEntity } from "../core/configuration.ts";
import type {
  Baseline,
  BaselineInput,
  BaselineQuery,
  BaselineContentsQuery,
  BaselineContents,
} from "../core/baseline.ts";
import type { SavedView } from "../core/presentation.ts";
import type {
  CoverageSet,
  CoverageListQuery,
  CoverageEvaluationQuery,
  CoverageCatalogue,
  CoverageEvaluation,
} from "../core/coverage.ts";
import type { ChangesetInput, Deletion } from "../application/commands.ts";
import type { ViewSave } from "../application/saved-views.ts";
import type {
  Table,
  TableQuery,
  Matrix,
  MatrixQuery,
  Graph,
  GraphQuery,
  FamilyWorkspace,
  FamilyQuery,
  WorkingSet,
  Connections,
  ConnectionsQuery,
  ChainTable,
  ChainQuery,
  RecordedConnections,
  RecordedConnectionsQuery,
} from "../application/views.ts";
import type { DemoGuide } from "./demo-guide.ts";

/** The local wire contract. Callers select an endpoint, never a response type. */
export type ReadApi = {
  "/api/next-work": {
    query: import("../core/next-work.ts").NextWorkQuery;
    response: import("../core/next-work.ts").NextWork;
  };
  "/api/project-export": {
    query: Record<string, never>;
    response: import("../core/project-export.ts").ProjectExport;
  };
  "/api/projects": { query: Record<string, never>; response: { id: string; title: string }[] };
  "/api/project-snapshot": {
    query: Record<string, never>;
    response: import("../core/project-snapshot.ts").ProjectSnapshot;
  };
  "/api/working-context": { query: WorkingContextQuery; response: WorkingContext };
  "/api/impact": { query: ChangeImpactQuery; response: ChangeImpact };
  "/api/coverage-expectations": { query: CoverageListQuery; response: CoverageCatalogue };
  "/api/coverage": { query: CoverageEvaluationQuery; response: CoverageEvaluation };
  "/api/baselines": { query: BaselineQuery; response: Page<Baseline> };
  "/api/baseline": { query: { id: string }; response: Baseline };
  "/api/baseline-contents": { query: BaselineContentsQuery; response: BaselineContents };
  "/api/session": { query: Record<string, never>; response: { token: string } };
  "/api/schema": { query: Record<string, never>; response: SchemaObject | null };
  "/api/demo-guide": { query: Record<string, never>; response: DemoGuide | null };
  "/api/saved-views": { query: Record<string, never>; response: SavedView[] };
  "/api/configurations": { query: EvidenceQuery; response: Page<Configuration> };
  "/api/configuration": { query: { id: string }; response: Configuration };
  "/api/native-pin": { query: { id: string; version: number }; response: PinnedEntity };
  "/api/entities": { query: EntityQuery; response: Page<Entity> };
  "/api/relationships": { query: RelationshipQuery; response: Page<Relationship> };
  "/api/history": { query: HistoryQuery; response: Page<Revision> };
  "/api/timeline": {
    query: { before?: number };
    response: { head: number; items: Changeset[]; nextBefore?: number };
  };
  "/api/evidence": { query: EvidenceQuery & { kind: EvidenceKind }; response: Page<Evidence> };
  "/api/receipt": { query: { receiptId: string }; response: Receipt };
  "/api/comparison": { query: { receiptId: string }; response: Comparison };
  "/api/table": { query: TableQuery; response: Table };
  "/api/matrix": { query: MatrixQuery; response: Matrix };
  "/api/graph": { query: GraphQuery; response: Graph };
  "/api/work": { query: WorkingSetQuery; response: WorkingSet };
  "/api/family": { query: FamilyQuery; response: FamilyWorkspace };
  "/api/connections": { query: ConnectionsQuery; response: Connections };
  "/api/chain": { query: ChainQuery; response: ChainTable };
  "/api/model-connections": { query: RecordedConnectionsQuery; response: RecordedConnections };
};
export type WriteApi = {
  "/api/coverage-expectations": { input: CoverageSet; response: SchemaObject };
  "/api/baselines": { input: BaselineInput; response: Baseline };
  "/api/schema": {
    input: {
      schema: Schema;
      expectedVersion: number;
      initialViews?: import("../core/presentation.ts").InitialView[];
    };
    response: SchemaObject;
  };
  "/api/changesets": {
    input: ChangesetInput;
    response: { changeset: Changeset; results: (Entity | Relationship | Deletion)[] };
  };
  "/api/configurations": { input: ConfigurationInput; response: Configuration };
  "/api/saved-views": { input: ViewSave; response: SavedView };
  "/api/saved-views/remove": {
    input: { id: string; expectedVersion: number };
    response: { removed: true };
  };
  "/api/external": {
    input: { entityId: string; system: "git" | "file"; externalId: string; ownership: "external" };
    response: ExternalIdentity;
  };
  "/api/observations": { input: { entityId: string; locator: Locator }; response: Observation };
  "/api/receipts": { input: ReceiptInput; response: Receipt };
  "/api/reviews": { input: ReviewInput; response: Review };
};
export type ReadPath = keyof ReadApi;
export type ReadQuery<K extends ReadPath> = ReadApi[K]["query"];
export type ReadResponse<K extends ReadPath> = ReadApi[K]["response"];
export type WritePath = keyof WriteApi;
export type WriteInput<K extends WritePath> = WriteApi[K]["input"];
export type WriteResponse<K extends WritePath> = WriteApi[K]["response"];
export type EvidenceByKind = {
  external: ExternalIdentity;
  observation: Observation;
  receipt: Receipt;
  review: Review;
};

export class ApiError extends Error {
  code: ErrorCode | "read_failed" | "outcome_unknown";
  readonly details?: ErrorDetails;
  constructor(code: ApiError["code"], message: string, details?: ErrorDetails) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
