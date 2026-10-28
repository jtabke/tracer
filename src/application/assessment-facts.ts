import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type {
  CapturedBasis,
  CandidateKey,
  AssessmentScope,
  SupportReference,
  ResolvedSupport,
} from "../core/change-assessment.ts";
import type {
  InputDeclaration,
  RelationshipDeclaration,
  InputComparison,
} from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity, pinRelationship } from "./native-pins.ts";
import { compareCapturedInputs, comparisonToken, nativeState } from "./receipt-comparison.ts";

export function candidateKey(value: CandidateKey) {
  return value.kind + ":" + value.id;
}
export async function factDigest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  ensure(
    bytes.length <= 1048576,
    "validation",
    "Assessment fact exceeds 1 MiB; narrow the selected basis",
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
export function declaredFacts(bases: Pick<CapturedBasis, "inputs" | "relationshipInputs">[]) {
  const inputs = [
    ...new Map(
      bases.flatMap((basis) => basis.inputs).map((input) => [canonical(input), input]),
    ).values(),
  ];
  const relationships = new Map<string, RelationshipDeclaration>();
  for (const link of bases.flatMap((basis) => basis.relationshipInputs)) {
    const prior = relationships.get(link.id);
    ensure(
      !prior || prior.revision === link.revision,
      "validation",
      "Receipt cannot declare two states of one relationship; split the supporting basis",
    );
    relationships.set(link.id, link);
  }
  ensure(
    inputs.length + relationships.size <= 80,
    "validation",
    "Assessment capture exceeds 80 direct facts; narrow the supporting basis",
  );
  return {
    inputs: inputs.map((input, index) => ({ ...input, role: "assessment fact " + index })),
    relationshipInputs: [...relationships.values()],
  };
}
async function fact(
  tx: Transaction,
  value: unknown,
  hasUnknown: boolean,
  inputs: InputDeclaration[],
  relationshipInputs: RelationshipDeclaration[],
  absences: CandidateKey[] = [],
): Promise<CapturedBasis> {
  const selected = declaredFacts([{ inputs, relationshipInputs }]);
  const absentByKey = new Map(absences.map((value) => [candidateKey(value), value]));
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
  return {
    contract: "assessment_basis",
    version: 1,
    digest: await factDigest({ version: 1, hasUnknown, value, absences: absent }),
    hasUnknown,
    at: {
      projectRevision: await tx.headRevision(),
      evidenceRevision: await tx.impactEvidenceRevision(),
    },
    inputs: selected.inputs.map(({ role: _role, ...input }) => input),
    relationshipInputs: selected.relationshipInputs,
    absences: absent,
  };
}
function observed(value: import("../core/evidence.ts").Observation | null | undefined) {
  return { availability: value?.availability ?? "unknown", hash: value?.hash ?? null };
}
function inputSource(input: InputComparison, inputs: InputDeclaration[], absences: CandidateKey[]) {
  if (!input.current.entity) {
    absences.push({ kind: "entity", id: input.entityId });
    return input.recorded.observation ? observed(input.current.observation) : null;
  }
  if (input.recorded.observation) {
    if (input.current.observation)
      inputs.push({
        entityId: input.entityId,
        facet: "content",
        observationId: input.current.observation.id,
      });
    return observed(input.current.observation);
  }
  inputs.push({
    entityId: input.entityId,
    facet: "native",
    revision: input.current.entity.version,
    ...(input.recorded.fields ? { fields: input.recorded.fields } : {}),
  });
  return nativeState(input.current.entity, input.recorded.fields);
}
function inputFact(
  input: InputComparison,
  content: boolean,
  links: Set<string>,
  inputs: InputDeclaration[],
  relationshipInputs: RelationshipDeclaration[],
  absences: CandidateKey[],
) {
  const source = content ? inputSource(input, inputs, absences) : null;
  const path = input.recorded.links.flatMap((link, index) => {
    if (!links.has(link.id)) return [];
    const current = input.current.links[index] ?? null;
    if (current) relationshipInputs.push({ id: current.id, revision: current.version });
    else absences.push({ kind: "relationship", id: link.id });
    return [{ id: link.id, current }];
  });
  return {
    entityId: input.entityId,
    ...(content ? { exists: input.current.entity !== null, source } : {}),
    path,
  };
}
async function receiptBasis(tx: Transaction, scope: AssessmentScope, subject: CandidateKey) {
  const candidate = scope.candidates.find(
    (value) => value.kind === "receipt" && value.id === subject.id,
  );
  ensure(
    candidate?.kind === "receipt",
    "validation",
    "Receipt is outside the declared assessment population",
  );
  const receipt = await tx.getEvidence("receipt", subject.id);
  ensure(receipt, "not_found", "Candidate receipt is unavailable");
  const comparison = await compareCapturedInputs(tx, receipt);
  const entities = new Set(
    candidate.contentIds ??
      scope.candidates.filter((value) => value.kind === "entity").map((value) => value.id),
  );
  const links = new Set(candidate.scope.relationshipIds),
    inputs: InputDeclaration[] = [],
    relationshipInputs: RelationshipDeclaration[] = [],
    absences: CandidateKey[] = [];
  const matched = comparison.inputs.filter(
    (input) =>
      entities.has(input.entityId) || input.recorded.links.some((link) => links.has(link.id)),
  );
  const values = matched.map((input) =>
    inputFact(input, entities.has(input.entityId), links, inputs, relationshipInputs, absences),
  );
  let unknown = matched.some(
    (input) =>
      entities.has(input.entityId) &&
      (!input.current.entity ||
        (input.recorded.observation &&
          (input.recorded.observation.availability !== "available" ||
            input.current.observation?.availability !== "available"))),
  );
  const direct = (comparison.relationshipInputs ?? [])
    .filter((link) => links.has(link.id))
    .map((link) => {
      if (link.current) relationshipInputs.push({ id: link.id, revision: link.current.version });
      else absences.push({ kind: "relationship", id: link.id });
      unknown ||= link.hasUnknown;
      return { id: link.id, current: link.current };
    });
  return fact(
    tx,
    { subject, values, direct, supersession: await tx.impactSupersession(subject.id) },
    Boolean(unknown),
    inputs,
    relationshipInputs,
    absences,
  );
}
export async function candidateBasis(
  tx: Transaction,
  scope: AssessmentScope,
  subject: CandidateKey,
): Promise<CapturedBasis> {
  ensure(
    scope.candidates.some((value) => candidateKey(value) === candidateKey(subject)),
    "validation",
    "Candidate is outside the declared assessment population",
  );
  if (subject.kind === "receipt") return receiptBasis(tx, scope, subject);
  const current = await tx.get(subject.kind, subject.id);
  if (subject.kind === "relationship")
    return fact(
      tx,
      { subject, current: current ?? null },
      false,
      [],
      current ? [{ id: current.id, revision: current.version }] : [],
      current ? [] : [subject],
    );
  return entityBasis(tx, subject);
}
async function entityBasis(tx: Transaction, subject: CandidateKey) {
  const entity = await tx.get("entity", subject.id);
  const external =
    entity && (entity.resource?.source ?? (await tx.getEvidence("external", subject.id)));
  const observation = external ? await tx.latestEvidence("observation", subject.id) : undefined;
  const inputs: InputDeclaration[] = entity
    ? [{ entityId: entity.id, facet: "native", revision: entity.version }]
    : [];
  if (entity && observation)
    inputs.push({ entityId: entity.id, facet: "content", observationId: observation.id });
  return fact(
    tx,
    { subject, entity: entity ?? null, ...(external ? { content: observed(observation) } : {}) },
    Boolean(external && observation?.availability !== "available"),
    inputs,
    [],
    entity ? [] : [subject],
  );
}
type SupportState = {
  selected: unknown;
  current: unknown;
  hasUnknown: boolean;
  inputs: InputDeclaration[];
  relationshipInputs: RelationshipDeclaration[];
  absences: CandidateKey[];
};
async function nativeSupport(
  tx: Transaction,
  reference: SupportReference & { version: number },
): Promise<SupportState> {
  const selected =
    reference.kind === "entity"
      ? (await pinEntity(tx, reference.id, reference.version, true)).entity
      : (await pinRelationship(tx, reference.id, reference.version)).relationship;
  const current = (await tx.get(reference.kind as "entity" | "relationship", reference.id)) ?? null;
  return {
    selected,
    current,
    hasUnknown: reference.mode === "current" && !current,
    inputs:
      reference.kind === "entity"
        ? [{ entityId: reference.id, facet: "native", revision: reference.version }]
        : [],
    relationshipInputs:
      reference.kind === "relationship" ? [{ id: reference.id, revision: reference.version }] : [],
    absences:
      reference.mode === "current" && !current
        ? [{ kind: reference.kind as "entity" | "relationship", id: reference.id }]
        : [],
  };
}
async function observationSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent: boolean,
): Promise<SupportState> {
  const observation = await tx.getEvidence("observation", reference.id);
  ensure(observation, "not_found", "Supporting observation is unavailable");
  const latest = await tx.latestEvidence("observation", observation.entityId);
  const selected = observed(observation),
    current = observed(latest);
  const entity = await tx.get("entity", observation.entityId);
  if (requireCurrent && reference.mode === "current")
    ensure(entity, "not_found", "Supporting current observed resource is unavailable");
  return {
    selected,
    current,
    hasUnknown:
      observation.availability !== "available" ||
      (reference.mode === "current" && (!entity || current.availability !== "available")),
    inputs: entity
      ? [observation, ...(reference.mode === "current" && latest ? [latest] : [])].map((value) => ({
          entityId: value.entityId,
          facet: "content" as const,
          observationId: value.id,
        }))
      : [],
    relationshipInputs: [],
    absences:
      reference.mode === "current" && !entity ? [{ kind: "entity", id: observation.entityId }] : [],
  };
}
async function receiptSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent: boolean,
): Promise<SupportState> {
  const receipt = await tx.getEvidence("receipt", reference.id);
  ensure(receipt, "not_found", "Supporting receipt is unavailable");
  const result: SupportState = {
    selected: { id: receipt.id },
    current: { id: receipt.id },
    hasUnknown: false,
    inputs: [{ entityId: receipt.output.id, facet: "native", revision: receipt.output.version }],
    relationshipInputs: [],
    absences: [],
  };
  if (reference.mode === "historical") return result;
  const compared = await compareCapturedInputs(tx, receipt),
    supersession = await tx.impactSupersession(receipt.id);
  if (requireCurrent)
    ensure(
      compared.state === "current" && supersession.count === 0,
      "conflict",
      "Supporting current receipt has changed, unknown or superseded inputs",
    );
  result.hasUnknown = compared.hasUnknown;
  const links = new Set(
    compared.inputs.flatMap((input) => input.recorded.links.map((link) => link.id)),
  );
  for (const input of compared.inputs)
    inputFact(input, true, links, result.inputs, result.relationshipInputs, result.absences);
  for (const link of compared.relationshipInputs ?? [])
    if (link.current)
      result.relationshipInputs.push({ id: link.id, revision: link.current.version });
    else result.absences.push({ kind: "relationship", id: link.id });
  result.current = { comparison: comparisonToken(compared), supersession };
  return result;
}
export async function resolveSupport(
  tx: Transaction,
  reference: SupportReference,
  requireCurrent = false,
): Promise<ResolvedSupport> {
  const state =
    reference.kind === "entity" || reference.kind === "relationship"
      ? await nativeSupport(tx, reference)
      : reference.kind === "observation"
        ? await observationSupport(tx, reference, requireCurrent)
        : await receiptSupport(tx, reference, requireCurrent);
  if (requireCurrent && reference.mode === "current" && reference.kind !== "receipt")
    ensure(
      canonical(state.selected) === canonical(state.current) && !state.hasUnknown,
      "conflict",
      "Supporting current state differs from the selected state",
    );
  return {
    ...(await fact(
      tx,
      { reference, state: reference.mode === "current" ? state.current : state.selected },
      state.hasUnknown,
      state.inputs,
      state.relationshipInputs,
      state.absences,
    )),
    reference,
  };
}
