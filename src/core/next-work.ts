import type { Entity, Schema, SchemaObject } from "./model.ts";
import type { Comparison } from "./evidence.ts";

export type NextWorkSelection = {
  requirementType: string;
  statementField: string;
  allocationExpectationId: string;
  verificationExpectationId: string;
};
export type NextWorkQuery = Partial<NextWorkSelection>;
export type WorkRecord = Pick<Entity, "id" | "type" | "key" | "version"> & { title: string };
export type WorkEvidence = {
  receiptId: string;
  output: WorkRecord;
  outcome: string;
  changedInputs: number;
  unknownInputs: number;
  reviewState: Comparison["review"]["state"];
  reviewReason: string;
};
export type WorkQueue<T> = {
  available: boolean;
  explanation: string;
  evaluated: number;
  items: T[];
};
export type NextWork = {
  schema: SchemaObject | null;
  projectRevision: number;
  evidenceRevision: number;
  schemaVersion: number;
  selection: NextWorkSelection;
  queues: {
    statements: WorkQueue<WorkRecord>;
    allocation: WorkQueue<WorkRecord>;
    verification: WorkQueue<WorkRecord>;
    changedEvidence: WorkQueue<WorkEvidence>;
    reviews: WorkQueue<WorkEvidence>;
  };
};

/** Only the optional Engineering vocabulary supplies defaults; other models choose explicitly. */
export function nextWorkDefaults(
  schema: Schema | null,
  requirementType = schema && Object.hasOwn(schema.entityTypes, "requirement") ? "requirement" : "",
): NextWorkSelection {
  return {
    requirementType,
    statementField:
      schema?.entityTypes[requirementType]?.fields.statement?.type === "string" ? "statement" : "",
    allocationExpectationId: defaultPolicy(schema, requirementType, "requirement_design"),
    verificationExpectationId: defaultPolicy(schema, requirementType, "requirement_verification"),
  };
}
function defaultPolicy(schema: Schema | null, type: string, id: string) {
  return schema?.coverageExpectations?.[id]?.subject.type === type && type ? id : "";
}
export function workRecord(entity: Entity): WorkRecord {
  return {
    id: entity.id,
    type: entity.type,
    version: entity.version,
    ...(entity.key === undefined ? {} : { key: entity.key }),
    title:
      typeof entity.fields.title === "string" ? entity.fields.title : (entity.key ?? entity.id),
  };
}
