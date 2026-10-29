import type { Entity, Relationship, SchemaObject, Provenance, Json } from "./model.ts";
import type { PinnedEntity, Configuration } from "./configuration.ts";

export type ExternalIdentity = {
  id: string; // Same stable Tracer UUID as the annotated entity; never a path.
  system: "git" | "file";
  externalId: string;
  ownership: "external";
  at: string;
  actor: string;
};
export type Locator =
  | { system: "git"; repository: string; path: string; ref: string }
  | { system: "file"; path: string };
export type ObservedState = {
  availability: "available" | "unknown";
  commit?: string;
  hash?: string;
  reason?: string;
};
export type Observation = ObservedState &
  Provenance & {
    id: string;
    entityId: string;
    locator: Locator;
    at: string;
  };
export type InputDeclaration = {
  /** Explicit qualifying use, captured in this receipt's direct relationship inputs. */
  referenceId?: string;
  facet?: "native" | "content";
  role?: string;
  entityId: string;
  expectedVersion?: number;
  // Exact historical native version; distinct from the current concurrency guard.
  revision?: number;
  observationId?: string;
  fields?: string[];
  // Explicit forward relationship path from output to input. Omit for a direct declaration.
  path?: string[];
  // Optional concurrency guards aligned with a deliberately selected live path.
  expectedPathVersions?: number[];
};
export type CapturedInput = InputDeclaration & {
  contentRetention?: "native-history" | "external-content-not-retained";
  entity: Entity;
  observation?: Observation;
  links: Relationship[];
  pin?: PinnedEntity;
};
export type RelationshipDeclaration = {
  id: string;
  expectedVersion?: number;
  revision?: number;
  role?: string;
};
export type CapturedRelationship = import("./configuration.ts").PinnedRelationship & {
  source: Entity;
  target: Entity;
  role?: string;
};
export type RelationshipComparison = {
  id: string;
  recorded: CapturedRelationship;
  current: Relationship | null;
  hasChanged: boolean;
  hasUnknown: boolean;
  state: "current" | "changed" | "unknown";
  reasons: string[];
};
export type ReceiptInput = {
  relationshipInputs?: RelationshipDeclaration[];
  outputId: string;
  expectedOutputVersion?: number;
  outcome: string;
  inputs: InputDeclaration[];
  supersedes?: string;
  configurationId?: string;
};
export type Receipt = Provenance & {
  relationshipInputs?: CapturedRelationship[];
  id: string;
  at: string;
  output: Entity;
  schema: SchemaObject;
  outcome: string;
  inputs: CapturedInput[];
  supersedes?: string;
  configuration?: Pick<Configuration, "id" | "name" | "subject">;
};
export type InputComparison = {
  referenceUse?: InputReferenceUse;
  entityId: string;
  dependencyPath: string[];
  state: "current" | "changed" | "unknown";
  hasChanged: boolean;
  hasUnknown: boolean;
  reasons: string[];
  recorded: CapturedInput;
  current: {
    entity: Entity | null;
    observation: Observation | null;
    links: (Relationship | null)[];
  };
};
export type InputReferenceUse = {
  relationshipId: string;
  selection: "resource-default" | "pinned-observation" | "pinned-revision" | "unavailable";
  resourceDefault: { entity: Entity | null; observation: Observation | null };
  passage: "unknown" | "whole-resource";
  reason?: string;
};
export type ComparedState = {
  relationshipInputs?: RelationshipComparison[];
  receiptId: string;
  state: "current" | "changed" | "unknown";
  hasChanged: boolean;
  hasUnknown: boolean;
  inputs: InputComparison[];
};
export type ReviewInput = {
  receiptId: string;
  decision: "accepted" | "acknowledged" | "needs_reevaluation";
  rationale: string;
  expectedComparison: string;
};
/** Application-owned interpretation context; absence retains original current-head meaning. */
export type ReviewQualification = {
  ownerId: string;
  contract: string;
  version: number;
  basisDigest: string;
};
export type Review = Provenance & {
  qualification?: ReviewQualification;
  id: string;
  at: string;
  receiptId: string;
  decision: ReviewInput["decision"];
  rationale: string;
  comparison: ComparedState;
  token: string;
};
export type Comparison = ComparedState & {
  token: string;
  review: { state: "unreviewed" | ReviewInput["decision"]; decision?: Review; previous?: Review };
  supersededBy: string[];
};
/** One kind-to-payload authority for storage and typed service reads. */
export type EvidenceByKind = {
  external: ExternalIdentity;
  observation: Observation;
  receipt: Receipt;
  review: Review;
};
export type EvidenceKind = keyof EvidenceByKind;
export type Evidence = EvidenceByKind[EvidenceKind];
/** Correlated tuples also reject independently union-typed kinds and payloads. */
export type EvidenceAppend = {
  [K in EvidenceKind]: [kind: K, subject: string, value: EvidenceByKind[K]];
}[EvidenceKind];
export type EvidenceQuery = { subject?: string; after?: string; limit?: number };

/** Canonical JSON comparison, independent of property insertion order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical((value as Record<string, Json>)[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
