import { ensure } from "../core/model.ts";
import { assessmentCandidateKey } from "../core/change-assessment.ts";
import type {
  CapturedBasis,
  CandidateKey,
  AssessmentPairContext,
} from "../core/change-assessment.ts";
import type { InputDeclaration, RelationshipDeclaration } from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import { declaredFacts } from "./captured-facts.ts";
import { factDigest } from "./fact-digest.ts";

/** Shared bounded capture; version 2 explicitly qualifies absences/facts to selected pair state. */
export async function captureAssessmentFact(
  tx: Transaction,
  data: {
    value: unknown;
    hasUnknown: boolean;
    inputs: InputDeclaration[];
    relationshipInputs: RelationshipDeclaration[];
    absences?: CandidateKey[];
    context?: AssessmentPairContext;
  },
): Promise<CapturedBasis> {
  const { value, hasUnknown, context } = data;
  const selected = declaredFacts([data]);
  const absentByKey = new Map(
    (data.absences ?? []).map((value) => [assessmentCandidateKey(value), value]),
  );
  const absent = [...absentByKey.keys()].sort().map((key) => absentByKey.get(key)!);
  ensure(
    selected.inputs.length + selected.relationshipInputs.length + absent.length <= 80,
    "validation",
    "Assessment basis exceeds 80 direct or absence facts",
  );
  ensure(
    new TextEncoder().encode(JSON.stringify(selected)).byteLength <= 16384,
    "validation",
    "Assessment capture declarations exceed 16 KiB",
  );
  const shared = {
    contract: "assessment_basis" as const,
    digest: await factDigest({
      version: context ? 2 : 1,
      hasUnknown,
      value,
      absences: absent,
      ...(context ? { context } : {}),
    }),
    hasUnknown,
    at: {
      projectRevision: await tx.headRevision(),
      evidenceRevision: await tx.impactEvidenceRevision(),
    },
    inputs: selected.inputs.map(({ role: _role, ...input }) => input),
    relationshipInputs: selected.relationshipInputs,
    absences: absent,
  };
  return context ? { ...shared, version: 2, context } : { ...shared, version: 1 };
}
