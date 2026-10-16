import type {
  Kind,
  Stored,
  Revision,
  Changeset,
  Provenance,
  Page,
  ObjectQuery,
  HistoryQuery,
} from "../core/model.ts";
import type { Evidence, EvidenceKind, EvidenceQuery } from "../core/evidence.ts";
import type { SavedView } from "../core/presentation.ts";
import type { Configuration } from "../core/configuration.ts";
import type { Baseline, BaselineQuery } from "../core/baseline.ts";
import type { CoverageNativeQuery, CoverageNativeRow } from "../core/coverage.ts";
import type { ImpactIncidentQuery, ImpactReceiptQuery } from "../core/impact.ts";
export type WorkingRouteNativeQuery = {
  focusId: string;
  steps: { type: string; relationshipType: string; direction?: "incoming" | "outgoing" }[];
  after?: string;
  limit: number;
};
export type WorkingPathNative = {
  entity: import("../core/model.ts").Entity;
  nodes: import("../core/model.ts").Entity[];
  links: import("../core/model.ts").Relationship[];
};
export type WorkingReceiptNativeQuery = {
  outputIds: string[];
  inputIds: string[];
  relationshipIds: string[];
  after?: string;
  limit: number;
};
export type WorkingReceiptCandidate = {
  receipt: import("../core/working-context.ts").WorkingReceipt["receipt"];
  inputCount: number;
  inputs: { entityId: string; capturedVersion: number }[];
};
export interface Transaction {
  workingRouteIds(
    query: WorkingRouteNativeQuery,
  ): Promise<{ total: number; ids: string[]; nextAfter?: string }>;
  workingMembership(query: {
    focusId: string;
    step: WorkingRouteNativeQuery["steps"][number];
    memberIds: string[];
    limit: number;
  }): Promise<Page<import("../core/model.ts").Relationship>>;
  workingRoute(
    query: WorkingRouteNativeQuery,
  ): Promise<Page<WorkingPathNative> & { total: number }>;
  workingReceipts(
    query: WorkingReceiptNativeQuery,
  ): Promise<Page<WorkingReceiptCandidate> & { total: number }>;
  impactIncident(
    query: ImpactIncidentQuery,
  ): Promise<Page<import("../core/model.ts").Relationship>>;
  impactReceipts(query: ImpactReceiptQuery): Promise<Page<import("../core/evidence.ts").Receipt>>;
  impactEvidenceRevision(): Promise<number>;
  latestEvidence(kind: "observation" | "review", subject: string): Promise<Evidence | undefined>;
  impactSupersession(receiptId: string): Promise<{ count: number; ids: string[] }>;
  supersedingReceiptIds(receiptId: string): Promise<string[]>;
  coveragePage(query: CoverageNativeQuery): Promise<Page<CoverageNativeRow>>;
  getBaseline(id: string): Promise<Baseline | undefined>;
  baselines(query: BaselineQuery): Promise<Page<Baseline>>;
  appendBaseline(value: Baseline): Promise<void>;
  queryAt(
    kind: "entity" | "relationship",
    revision: number,
    query: { after?: string; limit?: number },
  ): Promise<Page<Stored>>;
  getConfiguration(id: string): Promise<Configuration | undefined>;
  configurations(query: EvidenceQuery): Promise<Page<Configuration>>;
  appendConfiguration(value: Configuration): Promise<void>;
  getRevision(kind: Kind, id: string, version: number): Promise<Revision | undefined>;
  getView(id: string): Promise<SavedView | undefined>;
  listViews(): Promise<SavedView[]>;
  saveView(view: SavedView, expectedVersion: number): Promise<void>;
  removeView(id: string, expectedVersion: number): Promise<void>;
  getEvidence(kind: EvidenceKind, id: string): Promise<Evidence | undefined>;
  evidence(kind: EvidenceKind, query: EvidenceQuery): Promise<Page<Evidence>>;
  appendEvidence(kind: EvidenceKind, subject: string, value: Evidence): Promise<void>;
  get(kind: Kind, id: string): Promise<Stored | undefined>;
  headRevision(): Promise<number>;
  getAt(kind: Kind, id: string, revision: number): Promise<Stored | undefined>;
  incidentAt(id: string, revision: number, limit: number): Promise<Page<Stored>>;
  entityPredecessor(id: string, type: string): Promise<string | undefined>;
  query(kind: "entity" | "relationship", query: ObjectQuery): Promise<Page<Stored>>;
  workingSet(query: ObjectQuery): Promise<{
    entities: Page<import("../core/model.ts").Entity>;
    total: number;
    types: { type: string; count: number }[];
  }>;
  connectionCount(id: string, type?: string): Promise<number>;
  traceability(
    sourceIds: string[],
    targetIds: string[],
    targetType: string,
    relationshipType: string,
  ): Promise<{ links: import("../core/model.ts").Relationship[]; missingSourceIds: string[] }>;
  beginChangeset(id: string, schemaVersion: number, provenance: Provenance): Promise<Changeset>;
  save(kind: Kind, object: Stored, expectedVersion: number): Promise<void>;
  remove(kind: "entity" | "relationship", id: string, expectedVersion: number): Promise<void>;
  history(query: HistoryQuery): Promise<Page<Revision>>;
  changesets(afterRevision: number, limit: number): Promise<Changeset[]>;
}
export interface Repository {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): void;
}
