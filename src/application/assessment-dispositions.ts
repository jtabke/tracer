import { ensure, record } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import type {
  ChangeAssessmentView,
  DispositionView,
  DispositionData,
  DispositionRegistration,
  SetAssessmentDisposition,
  SupportReference,
} from "../core/change-assessment.ts";
import type { AssessmentDecision } from "../core/application-model.ts";
import {
  parseActions,
  assessmentText,
  parseDispositionView,
} from "../core/assessment-disposition.ts";
import { assessmentContext } from "./assessment-context.ts";
import { candidateBasis, candidateKey, declaredFacts } from "./assessment-facts.ts";
import { assessmentSupportResolver } from "./assessment-support.ts";
import { expectVersion } from "./version-guard.ts";
import { parseAssessmentScope } from "../core/assessment-scope-validation.ts";
import type { Operation } from "./commands.ts";

async function ownedDisposition(
  tx: Transaction,
  view: ChangeAssessmentView,
  registration: DispositionRegistration,
) {
  const incoming = await tx.impactIncident({
    id: registration.id,
    direction: "incoming",
    relationshipTypes: [view.model.definition.relationships.member],
    limit: 2,
  });
  ensure(
    !incoming.nextAfter &&
      incoming.items.length === 1 &&
      incoming.items[0].id === registration.membershipId &&
      incoming.items[0].source === view.assessment.id,
    "conflict",
    "Disposition must belong to exactly one assessment",
  );
  const entity = await tx.get("entity", registration.id);
  ensure(
    entity && entity.type === view.model.definition.disposition.type,
    "conflict",
    "Controlled disposition is missing or has another type",
  );
  const command = await tx.getEvaluationCommand(registration.commandId);
  ensure(command, "conflict", "Disposition application command is missing");
  const intent: unknown = JSON.parse(command.intent);
  ensure(
    record(intent) &&
      intent.operation === "change-assessment.disposition" &&
      record(intent.input) &&
      intent.input.assessmentId === view.assessment.id &&
      intent.input.openingCommandId === view.opening.commandId,
    "conflict",
    "Disposition command belongs to another assessment",
  );
  const saved = command.result.native?.results.find((result) => result.id === entity.id);
  ensure(
    saved && "fields" in saved && !("source" in saved),
    "conflict",
    "Disposition has no controlled native result",
  );
  const fields = view.model.definition.disposition.fields;
  for (const role of ["candidate", "decision", "rationale", "actions"] as const)
    ensure(
      canonical(entity.fields[fields[role]]) === canonical(saved.fields[fields[role]]),
      "conflict",
      "Disposition fields changed outside an application command",
    );
  const data = entity.fields[fields.candidate] as unknown as DispositionData;
  ensure(
    record(data) &&
      record(data.subject) &&
      candidateKey(data.subject) === candidateKey(registration.subject),
    "conflict",
    "Disposition subject does not match membership registry",
  );
  const decision = Object.entries(view.model.definition.decisions).find(
    ([, value]) => value === entity.fields[fields.decision],
  )?.[0] as AssessmentDecision | undefined;
  ensure(decision, "validation", "Disposition has an unmapped decision");
  const rationale = entity.fields[fields.rationale],
    title = entity.fields[fields.title];
  assessmentText(rationale);
  assessmentText(title, 200);
  const disposition: DispositionView = {
    assessment: { assessmentId: view.assessment.id, openingCommandId: view.opening.commandId },
    id: entity.id,
    version: entity.version,
    membershipId: registration.membershipId,
    title,
    decision,
    rationale,
    actions: parseActions(entity.fields[fields.actions]),
    data,
  };
  return { entity, disposition, member: incoming.items[0] };
}
export async function assessmentDispositions(tx: Transaction, view: ChangeAssessmentView) {
  const registry = view.scope.dispositions ?? [];
  const members = await tx.impactIncident({
    id: view.assessment.id,
    direction: "outgoing",
    relationshipTypes: [view.model.definition.relationships.member],
    limit: 25,
  });
  ensure(
    !members.nextAfter && members.items.length === registry.length,
    "conflict",
    "Assessment membership differs from its controlled registry",
  );
  const results = [];
  for (const entry of registry) {
    ensure(
      members.items.some((link) => link.id === entry.membershipId && link.target === entry.id),
      "conflict",
      "Controlled membership is missing or redirected",
    );
    results.push(await ownedDisposition(tx, view, entry));
  }
  return results;
}
async function relatedReceipt(
  tx: Transaction,
  reference: SupportReference,
  subject: DispositionData["subject"],
) {
  if (reference.kind !== "receipt" || reference.mode !== "current") return false;
  let receipt = await tx.getEvidence("receipt", reference.id);
  ensure(receipt, "not_found", "Verification receipt is missing");
  if (subject.kind === "entity")
    return receipt.inputs.some((input) => input.entityId === subject.id);
  if (subject.kind === "relationship")
    return (
      (receipt.relationshipInputs ?? []).some((link) => link.relationship.id === subject.id) ||
      receipt.inputs.some((input) => input.links.some((link) => link.id === subject.id))
    );
  for (let depth = 0; depth < 25; depth++) {
    if (receipt.id === subject.id) return true;
    if (!receipt.supersedes) return false;
    receipt = await tx.getEvidence("receipt", receipt.supersedes);
    ensure(receipt, "not_found", "Supersession chain is unavailable");
  }
  ensure(false, "validation", "Verification supersession chain exceeds 25 receipts");
}
async function assertCompletedAction(
  tx: Transaction,
  view: ChangeAssessmentView,
  request: SetAssessmentDisposition,
  action: SetAssessmentDisposition["actions"][number],
  resolved: import("../core/change-assessment.ts").ResolvedSupport[],
  resolver: ReturnType<typeof assessmentSupportResolver>,
) {
  ensure(
    resolved.every((item) => !item.hasUnknown) &&
      action.support.some((item) => item.mode === "current" || item.mode === "configuration"),
    "validation",
    "Completed actions need known current supporting evidence",
  );
  if (action.kind === "reverify") {
    let related =
      view.scope.version === 2 ? await resolver.verifies(request.subject, action.support) : false;
    if (view.scope.version === 1)
      for (const reference of action.support)
        related ||= await relatedReceipt(tx, reference, request.subject);
    ensure(
      related,
      "validation",
      view.scope.version === 2
        ? "Pair reverification requires applicable controlled verification for the exact after target and related engineering scope"
        : "Reverification requires a current receipt declaring the candidate or superseding its result",
    );
  }
}
async function supportData(
  tx: Transaction,
  request: SetAssessmentDisposition,
  view: ChangeAssessmentView,
) {
  const resolver = assessmentSupportResolver(tx, view.scope);
  const support = await resolver.resolveAll(request.support, true);
  const actionSupport = [];
  for (const action of request.actions) {
    const resolved = await resolver.resolveAll(action.support, true);
    if (action.state === "waived")
      ensure(
        view.model.definition.policy.allowActionWaiver === true,
        "validation",
        "This pinned model does not permit action waivers",
      );
    if (action.state === "done")
      await assertCompletedAction(tx, view, request, action, resolved, resolver);
    actionSupport.push({ id: action.id, support: resolved });
  }
  return { support, actionSupport };
}
function assertActionObligations(
  request: SetAssessmentDisposition,
  previous: import("../core/change-assessment.ts").AssessmentAction[],
) {
  for (const action of previous)
    ensure(
      request.actions.some((next) => next.id === action.id && next.kind === action.kind),
      "validation",
      "Existing action obligations cannot be removed or change kind",
    );
  if (["revise", "reverify", "investigate"].includes(request.decision))
    ensure(
      request.actions.some((action) => action.kind === request.decision),
      "validation",
      "Decision requires an explicit action of the selected kind",
    );
  if (request.decision === "no_action" || request.decision === "acknowledge_unknown")
    ensure(
      request.actions.every((action) => action.state !== "open"),
      "validation",
      "No-action or exception dispositions cannot hide open actions",
    );
}
export async function setAssessmentDisposition(tx: Transaction, request: SetAssessmentDisposition) {
  const { entity, view } = await assessmentContext(tx, request, request.expectedAssessmentVersion);
  ensure(
    view.model.compatibility.writable &&
      view.assessment.state === view.model.definition.states.open &&
      entity.fields[view.model.definition.assessment.fields.closure] === null,
    "conflict",
    "Disposition editing requires a compatible open assessment",
  );
  const existing = await assessmentDispositions(tx, view),
    previous = existing.find(
      (item) => candidateKey(item.disposition.data.subject) === candidateKey(request.subject),
    );
  ensure(
    previous
      ? previous.entity.id === request.dispositionId && previous.member.id === request.membershipId
      : request.expectedDispositionVersion === 0,
    "conflict",
    "Disposition identity differs from the controlled candidate",
  );
  expectVersion(previous?.entity.version ?? 0, request.expectedDispositionVersion);
  if (!previous)
    ensure(
      !(await tx.getRevision("entity", request.dispositionId, 1)) &&
        !(await tx.getRevision("relationship", request.membershipId, 1)),
      "conflict",
      "Disposition identities have already been used",
    );
  assertActionObligations(request, previous?.disposition.actions ?? []);
  const basis = await candidateBasis(tx, view.scope, request.subject);
  ensure(
    basis.digest === request.expectedBasisDigest,
    "conflict",
    "Candidate basis changed since it was inspected",
  );
  const resolved = await supportData(tx, request, view);
  const unknown = basis.hasUnknown || resolved.support.some((item) => item.hasUnknown);
  if (request.decision === "acknowledge_unknown")
    ensure(
      unknown && view.model.definition.policy.allowUnknown,
      "validation",
      "Unknown acknowledgment requires unknown basis and explicit model permission",
    );
  if (request.decision === "no_action")
    ensure(
      !unknown,
      "validation",
      "Unknown basis needs investigation, reverification or a configured acknowledgment",
    );
  const binding = view.model.definition.disposition;
  ensure(
    Object.keys(request.additionalFields).every(
      (name) => !Object.values(binding.fields).includes(name),
    ),
    "validation",
    "Additional fields cannot replace disposition-controlled fields",
  );
  const data: DispositionData = { subject: request.subject, basis, ...resolved };
  parseDispositionView({
    assessment: { assessmentId: request.assessmentId, openingCommandId: request.openingCommandId },
    id: request.dispositionId,
    version: request.expectedDispositionVersion + 1,
    membershipId: request.membershipId,
    title: request.title,
    decision: request.decision,
    rationale: request.rationale,
    actions: request.actions,
    data,
  });
  ensure(
    new TextEncoder().encode(
      JSON.stringify({ data, actions: request.actions, rationale: request.rationale }),
    ).byteLength <= 49152,
    "validation",
    "Captured disposition exceeds 48 KiB; narrow supporting uses",
  );
  const fields = {
    ...(previous?.entity.fields ?? {}),
    ...request.additionalFields,
    [binding.fields.title]: request.title,
    [binding.fields.candidate]: data,
    [binding.fields.decision]: view.model.definition.decisions[request.decision],
    [binding.fields.rationale]: request.rationale,
    [binding.fields.actions]: request.actions,
  };
  const registry = (view.scope.dispositions ?? []).filter(
    (item) => candidateKey(item.subject) !== candidateKey(request.subject),
  );
  registry.push({
    subject: request.subject,
    id: request.dispositionId,
    membershipId: request.membershipId,
    commandId: request.commandId,
  });
  const scope = parseAssessmentScope({
    ...view.scope,
    dispositions: registry,
    control: { commandId: request.commandId, openingCommandId: request.openingCommandId },
  });
  const operations: Operation[] = previous
    ? [
        {
          op: "entity.update",
          id: previous.entity.id,
          expectedVersion: previous.entity.version,
          input: { fields },
        },
      ]
    : [
        { op: "entity.create", id: request.dispositionId, input: { type: binding.type, fields } },
        {
          op: "relationship.create",
          id: request.membershipId,
          input: {
            type: view.model.definition.relationships.member,
            source: entity.id,
            target: request.dispositionId,
            fields: {},
          },
        },
      ];
  operations.push({
    op: "entity.update",
    id: entity.id,
    expectedVersion: entity.version,
    input: { fields: { ...entity.fields, [view.model.definition.assessment.fields.scope]: scope } },
  });
  const captures = declaredFacts([
    basis,
    ...resolved.support,
    ...resolved.actionSupport.flatMap((item) => item.support),
  ]);
  return {
    operations,
    assertResult: async (current: Transaction) => {
      const resolver = assessmentSupportResolver(current, view.scope);
      ensure(
        (await candidateBasis(current, view.scope, request.subject)).digest === basis.digest,
        "conflict",
        "The operation changes its own assessed candidate basis",
      );
      for (const support of [
        ...resolved.support,
        ...resolved.actionSupport.flatMap((item) => item.support),
      ])
        if (support.reference.mode !== "historical")
          ensure(
            (await resolver.resolve(support.reference)).digest === support.digest,
            "conflict",
            "The operation changes its own current supporting basis; use independent evidence or an explicit historical reference",
          );
    },
    receipt: {
      outputId: entity.id,
      expectedOutputVersion: entity.version + 1,
      outcome: `Recorded ${request.decision} disposition with ${request.actions.filter((action) => action.state === "open").length} outstanding local actions. No assessment completion established.`,
      inputs: [
        ...captures.inputs,
        {
          entityId: request.dispositionId,
          facet: "native" as const,
          revision: request.expectedDispositionVersion + 1,
          role: "controlled candidate judgment",
        },
        {
          entityId: entity.id,
          facet: "native" as const,
          revision: entity.version,
          role: "assessment before judgment",
        },
        {
          entityId: view.model.pin.entityId,
          facet: "native" as const,
          revision: view.model.pin.version,
          fields: [view.model.pin.field],
          role: "governing model",
        },
      ],
      relationshipInputs: [
        ...captures.relationshipInputs,
        { id: request.membershipId, role: "controlled disposition membership" },
      ],
    },
  };
}
