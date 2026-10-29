import { canonical } from "../core/evidence.ts";
import type { VerificationCaseView } from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { nativeState } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { verificationEngineeringState } from "./verification-target.ts";
import { pinEntity } from "./native-pins.ts";
import { parseVerificationScope } from "../core/verification-case-validation.ts";
import type { VerificationExecutionData } from "../core/verification-case.ts";
import { supportedPriorResults } from "./verification-prior-results.ts";

type NativeSemanticState = {
  changed: boolean;
  unknown: boolean;
  fact: unknown;
  inputs: import("../core/evidence.ts").InputDeclaration[];
};
async function nativeSemantics(
  state: EngineeringStateReader,
  id: string,
  type: string,
  fields: string[],
  values: Record<string, string>,
): Promise<NativeSemanticState> {
  const current = await state.getEntity(id);
  const fact = current ? { type: current.type, fields: nativeState(current, fields) } : null;
  const expected = {
    type,
    fields: fields.map((name) => ({ name, present: true, value: values[name] })),
  };
  return {
    changed: !!current && canonical(fact) !== canonical(expected),
    unknown: !current,
    fact,
    inputs: current ? [{ entityId: id, facet: "native", revision: current.version, fields }] : [],
  };
}
async function governingMethod(
  state: EngineeringStateReader,
  view: VerificationCaseView,
  method: VerificationCaseView["scope"]["basis"]["methods"][number],
) {
  const fields = view.model.definition.method.fields;
  const native = await nativeSemantics(
    state,
    method.entityId,
    view.model.definition.method.type,
    [fields.procedure, fields.expected],
    { [fields.procedure]: method.procedure, [fields.expected]: method.expected },
  );
  const link = await state.getRelationship(method.relationship.id),
    different = canonical(link ?? null) !== canonical(method.relationship);
  return {
    ...native,
    changed: native.changed || different,
    unknown: native.unknown || !link,
    facts: [native.fact, link ?? null],
    relationships: link ? [{ id: link.id, revision: link.version }] : [],
  };
}
function governingReasons(
  requirement: NativeSemanticState,
  methods: { id: string; changed: boolean; unknown: boolean }[],
  compatible: boolean,
) {
  const reasons: string[] = [];
  if (requirement.changed)
    reasons.push(
      "Requirement semantic source changed; explicitly revise the basis before current verification",
    );
  if (requirement.unknown) reasons.push("Requirement is unavailable");
  if (!compatible) reasons.push("Pinned model is incompatible with the current schema");
  for (const method of methods)
    if (method.changed || method.unknown)
      reasons.push("Method or declared requirement-to-method mapping changed: " + method.id);
  return reasons;
}
export async function verificationGoverningBasis(
  tx: Transaction,
  view: VerificationCaseView,
  selected?: EngineeringStateReader,
) {
  const state = selected ?? (await verificationEngineeringState(tx, view.scope));
  const compatible = state.kind === "configuration" || view.model.compatibility.writable;
  const basis = view.scope.basis,
    definition = view.model.definition,
    fields = definition.requirement.fields;
  const requirement = await nativeSemantics(
    state,
    basis.requirement.entityId,
    definition.requirement.type,
    [fields.statement, ...fields.acceptance],
    { ...basis.requirement.acceptance, [fields.statement]: basis.requirement.statement },
  );
  const methods = [];
  for (const method of basis.methods)
    methods.push({ id: method.entityId, ...(await governingMethod(state, view, method)) });
  const changed = requirement.changed || methods.some((x) => x.changed),
    unknown = requirement.unknown || !compatible || methods.some((x) => x.unknown);
  const reasons = governingReasons(requirement, methods, compatible);
  return {
    state: unknown ? ("unknown" as const) : changed ? ("changed" as const) : ("current" as const),
    reasons,
    digest: await factDigest({
      model: view.model.pin,
      definition,
      compatible,
      ...(view.scope.target ? { target: view.scope.target } : {}),
      criteria: basis.criteria,
      coverage: basis.coverage,
      methods: basis.methods.map((x) => ({ id: x.entityId, criterionIds: x.criterionIds })),
      facts: [requirement.fact, ...methods.flatMap((x) => x.facts)],
    }),
    inputs: [...requirement.inputs, ...methods.flatMap((x) => x.inputs)],
    relationships: methods.flatMap((x) => x.relationships),
  };
}

function mappedCriterion(view: VerificationCaseView, version: number, id: string): string | null {
  let current: string | null = id;
  for (const revision of view.scope.revisions ?? [])
    if (revision.caseVersion >= version && current !== null)
      current = revision.mapping.find((x) => x.fromId === current)?.toId ?? null;
  return current;
}
export async function verificationExecutionBasis(
  tx: Transaction,
  view: VerificationCaseView,
  data: VerificationExecutionData,
) {
  const original = await pinEntity(tx, view.case.id, data.basisVersion, true);
  const old = parseVerificationScope(
    original.entity.fields[view.model.definition.case.fields.basis],
  ).basis;
  const current = view.scope.basis,
    priorMethod = old.methods.find((x) => x.entityId === data.methodId),
    method = current.methods.find((x) => x.entityId === data.methodId);
  const sameMethod =
    !!method &&
    !!priorMethod &&
    method.procedure === priorMethod.procedure &&
    method.expected === priorMethod.expected &&
    canonical(method.relationship) === canonical(priorMethod.relationship);
  const results = data.results.map((result) => ({
    ...result,
    currentCriterionId: mappedCriterion(view, data.basisVersion, result.criterionId),
  }));
  const eligible = results
    .filter((result) => {
      const from = old.criteria.find((x) => x.id === result.criterionId),
        to = current.criteria.find((x) => x.id === result.currentCriterionId);
      return (
        sameMethod &&
        old.requirement.statement === current.requirement.statement &&
        !!from &&
        !!to &&
        from.field === to.field &&
        from.quote === to.quote &&
        method!.criterionIds.includes(to.id)
      );
    })
    .map((x) => x.currentCriterionId!);
  const priorSourceSupported = await supportedPriorResults(tx, view, old, data);
  return { results, eligible: priorSourceSupported ? eligible : [], priorSourceSupported };
}
