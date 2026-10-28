import { array, literal, nullable, number, optional, text } from "../decode.ts";
import { strictObject } from "./input.ts";

export const exactConfigurationInputFields = {
  id: text,
  name: text,
  subjectId: text,
  expectedSubjectVersion: number,
  expectedSchemaVersion: number,
  expectedProjectRevision: number,
  expectedEvidenceRevision: number,
  members: array(strictObject({ entityId: text, version: number })),
  relationships: array(strictObject({ relationshipId: text, version: number })),
  content: array(
    strictObject({ entityId: text, observationId: nullable(text), reason: optional(text) }),
  ),
  scope: strictObject({ purpose: text, coverage: literal("complete", "partial"), rationale: text }),
};
