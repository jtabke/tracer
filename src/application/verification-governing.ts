import { canonical } from "../core/evidence.ts";
import type { VerificationCaseView } from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { nativeState } from "./receipt-comparison.ts";
import { factDigest } from "./fact-digest.ts";
import { pinEntity } from "./native-pins.ts";
import { parseVerificationScope } from "../core/verification-case-validation.ts";
import type { VerificationExecutionData } from "../core/verification-case.ts";

type NativeSemanticState = {
  changed: boolean;
  unknown: boolean;
  fact: unknown;
  inputs: import("../core/evidence.ts").InputDeclaration[];
};
async function nativeSemantics(
  tx: Transaction,
  id: string,
  type: string,
  fields: string[],
  values: Record<string, string>,
): Promise<NativeSemanticState> {
  const current = await tx.get("entity", id);
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
  tx: Transaction,
  view: VerificationCaseView,
  method: VerificationCaseView["scope"]["basis"]["methods"][number],
) {
  const fields = view.model.definition.method.fields;
  const native = await nativeSemantics(
    tx,
    method.entityId,
    view.model.definition.method.type,
    [fields.procedure, fields.expected],
    { [fields.procedure]: method.procedure, [fields.expected]: method.expected },
  );
  const link = await tx.get("relationship", method.relationship.id),
    different = canonical(link ?? null) !== canonical(method.relationship);
  return {
    ...native,
    changed: native.changed || different,
    unknown: native.unknown || !link,
    facts: [native.fact, link ?? null],
    relationships: link ? [{ id: link.id, revision: link.version }] : [],
  };
}
export async function verificationGoverningBasis(tx: Transaction, view: VerificationCaseView) {
  const basis = view.scope.basis,
    definition = view.model.definition,
    fields = definition.requirement.fields;
  const requirement = await nativeSemantics(
    tx,
    basis.requirement.entityId,
    definition.requirement.type,
    [fields.statement, ...fields.acceptance],
    { ...basis.requirement.acceptance, [fields.statement]: basis.requirement.statement },
  );
  const methods = [];
  for (const method of basis.methods)
    methods.push({ id: method.entityId, ...(await governingMethod(tx, view, method)) });
  const changed = requirement.changed || methods.some((x) => x.changed),
    unknown =
      requirement.unknown || !view.model.compatibility.writable || methods.some((x) => x.unknown);
  const reasons: string[] = [];
  if (requirement.changed)
    reasons.push(
      "Requirement semantic source changed; explicitly revise the basis before current verification",
    );
  if (requirement.unknown) reasons.push("Requirement is unavailable");
  if (!view.model.compatibility.writable)
    reasons.push("Pinned model is incompatible with the current schema");
  for (const method of methods)
    if (method.changed || method.unknown)
      reasons.push("Method or declared requirement-to-method mapping changed: " + method.id);
  return {
    state: unknown ? ("unknown" as const) : changed ? ("changed" as const) : ("current" as const),
    reasons,
    digest: await factDigest({
      model: view.model.pin,
      definition,
      compatible: view.model.compatibility.writable,
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
  return { results, eligible };
}
