import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type { PrepareVerificationBasis } from "../../src/core/verification-basis.ts";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { Editing } from "../editing.ts";
import { AdditionalFields, RecordChoice, useApplicationDirty } from "../application-choices.tsx";
import type { applicationModelChoices } from "../application-choices.tsx";
import { fieldsFrom } from "../fields.tsx";
import { useVerificationBasisSource } from "./basis-source-state.ts";
import { VerificationTargetChoice } from "./target-choice.tsx";
import type { ConfigurationHandoff } from "../configurations/handoff.ts";
import type { VerificationTargetPolicy } from "../../src/core/verification-case.ts";
import { CriterionSource, MethodAssignments } from "./basis-source.tsx";
import type { BasisCapture } from "./basis-source.tsx";
import { verificationCommand, useRecoveredVerification } from "./common.ts";
import { VerificationContext } from "./context.tsx";
import { requirementRequestChanged } from "./subject.ts";
type BasisEditorProps = {
  intent?: ConfigurationHandoff;
  initialRequirement?: Entity;
  models?: ReturnType<typeof applicationModelChoices>;
  entities: Entity[];
  editing: Editing;
  epoch: number;
  onDirty(value: boolean): void;
  saved(id: string): void;
  revision?: VerificationAnalysis;
  ready?: boolean;
};
type BasisFields = {
  targetId: string;
  targetPolicy: VerificationTargetPolicy;
  modelKey: string;
  requirementId: string;
  title: string;
  purpose: string;
  reason: string;
  coverage: "complete" | "partial";
  extra: Record<string, string>;
  criteria: PrepareVerificationBasis["criteria"];
  assignments: Record<string, string[]>;
  mapping: Record<string, string | null>;
};
type BasisScope = Pick<BasisFields, "targetId" | "modelKey" | "requirementId">;
function initialBasisFields(
  revision: VerificationAnalysis | undefined,
  intent?: ConfigurationHandoff,
  initialRequirement?: Entity,
): BasisFields {
  return {
    modelKey: "",
    targetId: revision?.view.scope.target?.configurationId ?? intent?.pair.afterId ?? "",
    targetPolicy: revision?.view.scope.target?.policy ?? "target-reference-uses-v2",
    requirementId:
      revision?.view.scope.basis.requirement.entityId ??
      intent?.rootId ??
      initialRequirement?.id ??
      "",
    title: "",
    purpose: "",
    reason: "",
    coverage: revision?.view.scope.basis.coverage.kind ?? "complete",
    extra: {},
    criteria: revision?.view.scope.basis.criteria ?? [],
    assignments: Object.fromEntries(
      revision?.view.scope.basis.methods.map((x) => [x.relationship.id, x.criterionIds]) ?? [],
    ),
    mapping: {},
  };
}
function useBasisDraft({
  models = [],
  entities,
  editing,
  epoch,
  onDirty,
  saved,
  revision,
  ready = true,
  intent,
  initialRequirement,
}: BasisEditorProps) {
  const [requestedRequirement, setRequestedRequirement] = useState(initialRequirement);
  const [draft, setDraft] = useState(() =>
      initialBasisFields(revision, intent, initialRequirement),
    ),
    [preparation, setPreparation] = useState<{
      capture: BasisCapture;
      revision: VerificationAnalysis | undefined;
    }>(),
    [attempt, setAttempt] = useState<string>(),
    [ids] = useState(() => ({ caseId: crypto.randomUUID(), membershipId: crypto.randomUUID() }));
  const {
      modelKey,
      targetId,
      targetPolicy,
      requirementId,
      title,
      purpose,
      reason,
      coverage,
      extra,
      criteria,
      assignments,
      mapping,
    } = draft,
    capture = preparation?.capture,
    preparedRevision = preparation?.revision;
  function update(patch: Partial<Omit<BasisFields, keyof BasisScope>>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }
  function changeScope(patch: Partial<BasisScope>, message: string) {
    if (!ready || editing.busy || (criteria.length && !window.confirm(message))) return;
    if (patch.requirementId !== undefined && patch.requirementId !== requestedRequirement?.id)
      setRequestedRequirement(undefined);
    setDraft((previous) => ({ ...previous, ...patch, criteria: [], assignments: {} }));
    setCapture(undefined);
  }
  function setCapture(value: BasisCapture | undefined) {
    setPreparation(value ? { capture: value, revision } : undefined);
  }
  const source = useVerificationBasisSource(
    { models, entities, modelKey, requirementId, targetId, modelPin: revision?.view.model.pin },
    editing,
    epoch,
  );
  const { model, definition } = source;
  const selectedRequirement = source.entities.find((entity) => entity.id === requirementId);
  const requestedStale = requirementRequestChanged(requestedRequirement, selectedRequirement);
  const requirementCompatible = Boolean(
    selectedRequirement && selectedRequirement.type === definition?.requirement.type,
  );
  const dirty = [
    title,
    purpose,
    reason,
    criteria.length,
    Object.keys(extra).length,
    targetId,
    modelKey,
  ].some(Boolean);
  useApplicationDirty(dirty, onDirty);
  useRecoveredVerification(attempt, revision?.view.case.id ?? ids.caseId, editing, epoch, () =>
    saved(revision?.view.case.id ?? ids.caseId),
  );
  const stale =
    !!capture &&
    (JSON.stringify(capture.model.context) !== JSON.stringify(model.retained?.context) ||
      (capture.target?.id ?? "") !== targetId ||
      (capture.targetPolicy ?? targetPolicy) !== targetPolicy);
  function prepare() {
    if (
      !model.ready ||
      !model.data ||
      !source.ready ||
      !selectedRequirement ||
      requestedStale ||
      !requirementCompatible
    )
      return;
    setCapture(
      structuredClone({
        model: model.data,
        requirement: selectedRequirement,
        methods: source.entities.filter((x) => x.type === model.data!.definition.method.type),
        links: source.relationships,
        ...(source.target.data
          ? { target: { id: source.target.data.id, name: source.target.data.name }, targetPolicy }
          : {}),
      }),
    );
  }
  async function submit() {
    if (!ready || !capture || stale || !model.ready || !source.ready || requestedStale) return;
    const basis: PrepareVerificationBasis = {
      model: capture.model.pin,
      requirement: { entityId: capture.requirement.id, version: capture.requirement.version },
      coverage: { kind: coverage, rationale: reason },
      criteria,
      methods: capture.links.flatMap((link) => {
        const method = capture.methods.find((x) => x.id === link.target),
          criterionIds = (assignments[link.id] ?? []).filter((id) =>
            criteria.some((c) => c.id === id),
          );
        return method && criterionIds.length
          ? [
              {
                entityId: method.id,
                version: method.version,
                relationship: { id: link.id, version: link.version },
                criterionIds,
              },
            ]
          : [];
      }),
    };
    try {
      if (revision && preparedRevision) {
        const request = {
          ...verificationCommand(preparedRevision, reason),
          basis,
          ...(capture.target
            ? { targetConfigurationId: capture.target.id, targetPolicy: capture.targetPolicy }
            : {}),
          mapping: preparedRevision.view.scope.basis.criteria.map((c) => ({
            fromId: c.id,
            toId: Object.hasOwn(mapping, c.id)
              ? mapping[c.id]
              : criteria.some((x) => x.id === c.id)
                ? c.id
                : null,
          })),
        };
        setAttempt(request.commandId);
        if (await editing.mutate("/api/verifications/revise", request)) {
          setAttempt(undefined);
          saved(revision.view.case.id);
        }
      } else {
        const request = {
          ...ids,
          commandId: crypto.randomUUID(),
          title,
          purpose,
          basis,
          ...(capture.target
            ? { targetConfigurationId: capture.target.id, targetPolicy: capture.targetPolicy }
            : {}),
          additionalFields: fieldsFrom(extra, capture.model.requiredFields.case ?? {}),
          expectedSchemaVersion: capture.model.context.schemaVersion,
          expectedProjectRevision: capture.model.context.projectRevision,
          expectedEvidenceRevision: capture.model.context.evidenceRevision,
        };
        setAttempt(request.commandId);
        if (await editing.mutate("/api/verifications/open", request)) {
          setAttempt(undefined);
          saved(ids.caseId);
        }
      }
    } catch (error) {
      editing.report(error);
    }
  }
  return {
    ...draft,
    update,
    changeScope,
    models: source.models,
    entities: source.entities,
    selectedRequirement,
    requestedRequirement,
    requestedStale,
    requirementCompatible,
    adoptRequestedRequirement: () => {
      if (!selectedRequirement || !source.ready || editing.busy) return;
      setRequestedRequirement(structuredClone(selectedRequirement));
      setCapture(undefined);
      update({ criteria: [], assignments: {} });
    },
    editing,
    epoch,
    revision,
    ready,
    source,
    capture,
    setCapture,
    preparedRevision,
    model,
    definition,
    stale,
    prepare,
    submit,
  };
}
type BasisDraft = ReturnType<typeof useBasisDraft>;
export function VerificationBasisEditor(props: BasisEditorProps) {
  const draft = useBasisDraft(props);
  const { revision, ready, editing, submit, model, source, requirementId, capture, prepare } =
    draft;
  return (
    <form
      aria-label={revision ? "Revise verification basis" : "Open verification case"}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>{revision ? "Revise the governing basis" : "New verification"}</h3>
      <BasisContext draft={draft} />
      {draft.requestedStale && (
        <p role="alert">
          The selected requirement changed or is unavailable. The original proposal is retained; no
          newer version is adopted automatically.
          <button
            type="button"
            disabled={!draft.selectedRequirement || !source.ready || editing.busy}
            onClick={draft.adoptRequestedRequirement}
          >
            Adopt displayed requirement version
          </button>
        </p>
      )}
      <fieldset disabled={!ready || editing.busy}>
        <VerificationTargetChoice
          id={draft.targetId}
          target={source.target.retained}
          policy={draft.targetPolicy}
          bound={Boolean(revision?.view.scope.target)}
          editing={editing}
          onChange={(targetId) =>
            draft.changeScope(
              { targetId, modelKey: "" },
              "Changing the engineering target clears criterion ranges and method assignments. Continue?",
            )
          }
          onPolicy={(targetPolicy) => draft.update({ targetPolicy })}
        />
        {!revision && <BasisIdentity draft={draft} />}
        {(model.loading || source.loading) && (
          <p role="status">Reading model and method connections…</p>
        )}
        {(model.failed || source.failed) && (
          <p role="alert">
            Preparation could not be read; retained choices are not permission to save.
          </p>
        )}
        <button
          type="button"
          disabled={
            !model.ready ||
            !source.ready ||
            !model.data?.compatibility.writable ||
            !requirementId ||
            draft.requestedStale ||
            !draft.requirementCompatible
          }
          onClick={prepare}
        >
          {capture ? "Reprepare current basis" : "Prepare verification basis"}
        </button>
        {source.truncated && (
          <p>
            Only the first 100 method connections are offered. Narrow the project requirement/method
            scope before choosing additional methods; this list is not complete coverage.
          </p>
        )}
        <PreparedBasis draft={draft} />
      </fieldset>
    </form>
  );
}

function BasisContext({ draft }: { draft: BasisDraft }) {
  const requirement =
    draft.capture?.requirement ?? draft.requestedRequirement ?? draft.selectedRequirement;
  const definition = draft.capture?.model.definition ?? draft.definition;
  const target =
    draft.capture?.target ??
    (draft.targetId
      ? {
          id: draft.targetId,
          name:
            draft.source.target.retained?.id === draft.targetId
              ? draft.source.target.retained.name
              : draft.targetId,
        }
      : undefined);
  return (
    <VerificationContext
      inline={Boolean(draft.revision)}
      kind={draft.capture ? "Prepared basis" : "Proposed basis"}
      requirement={
        requirement
          ? {
              id: requirement.id,
              key: requirement.key,
              version: requirement.version,
              title: String(
                requirement.fields[definition?.requirement.fields.title ?? "title"] ??
                  requirement.fields.name ??
                  requirement.key ??
                  requirement.id,
              ),
            }
          : undefined
      }
      revision={draft.capture?.model.context.projectRevision}
      target={
        target
          ? { ...target, policy: draft.capture?.targetPolicy ?? draft.targetPolicy }
          : undefined
      }
    />
  );
}

function BasisIdentity({ draft }: { draft: BasisDraft }) {
  const {
    models,
    entities,
    definition,
    modelKey,
    title,
    purpose,
    requirementId,
    update,
    changeScope,
    source,
  } = draft;
  return (
    <>
      <label>
        Verification model
        <select
          aria-label="Verification model"
          required
          value={modelKey}
          onChange={(e) =>
            changeScope(
              { modelKey: e.target.value, requirementId: draft.requestedRequirement?.id ?? "" },
              "Changing verification model clears selected criterion ranges and method assignments. Continue?",
            )
          }
        >
          <option value="">Choose model</option>
          {models.map((x, i) => (
            <option key={x.name} value={i}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      {!models.length && (!draft.targetId || source.target.ready) && (
        <p>
          No verification model definitions are installed. Configure the project through Model or
          the headless installation interface first.
        </p>
      )}
      <label>
        Verification title
        <input
          aria-label="Verification title"
          required
          value={title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </label>
      <label>
        Verification purpose
        <textarea
          aria-label="Verification purpose"
          required
          value={purpose}
          onChange={(e) => update({ purpose: e.target.value })}
        />
      </label>
      <RecordChoice
        name="Requirement"
        titleField={definition?.requirement.fields.title}
        required
        entities={entities.filter((x) => x.type === definition?.requirement.type)}
        value={requirementId}
        onChange={(requirementId) =>
          changeScope(
            { requirementId },
            "Changing requirement clears the selected criterion ranges and method assignments. Continue?",
          )
        }
      />
    </>
  );
}

function PreparedBasis({ draft }: { draft: BasisDraft }) {
  const {
    capture,
    stale,
    criteria,
    assignments,
    coverage,
    revision,
    reason,
    extra,
    update,
    model,
    source,
  } = draft;
  if (!capture) return null;
  return (
    <>
      {capture.target && (
        <p>
          Target: {capture.target.name} · {capture.target.id} · {capture.targetPolicy}
        </p>
      )}
      <p>
        Requirement:{" "}
        {String(capture.requirement.fields[capture.model.definition.requirement.fields.title])} · v
        {capture.requirement.version}
      </p>
      <p>
        {String(capture.requirement.fields[capture.model.definition.requirement.fields.statement])}
      </p>
      {stale && (
        <p role="alert">
          The preparation context changed. Your criterion and text drafts are retained. Inspect the
          current source and explicitly reprepare before saving.
        </p>
      )}
      <CriterionSource
        capture={capture}
        criteria={criteria}
        onChange={(criteria) => update({ criteria })}
      />
      <MethodAssignments
        capture={capture}
        criteria={criteria}
        assignments={assignments}
        onChange={(assignments) => update({ assignments })}
      />
      <label>
        Declared source coverage
        <select
          aria-label="Declared source coverage"
          value={coverage}
          onChange={(e) => update({ coverage: e.target.value as typeof coverage })}
        >
          <option value="complete">Complete acceptance source</option>
          <option value="partial">Explicitly partial scope</option>
        </select>
      </label>
      <PreviousMappings draft={draft} />
      <label>
        Basis rationale
        <textarea
          aria-label="Basis rationale"
          required
          value={reason}
          onChange={(e) => update({ reason: e.target.value })}
        />
      </label>
      {!revision && (
        <AdditionalFields
          title="Verification"
          definitions={capture.model.requiredFields.case}
          values={extra}
          onChange={(extra) => update({ extra })}
        />
      )}
      <button type="submit" disabled={stale || !model.ready || !source.ready || !criteria.length}>
        {revision ? "Save revised basis" : "Open verification"}
      </button>
    </>
  );
}

function PreviousMappings({ draft }: { draft: BasisDraft }) {
  const { revision, mapping, update, criteria } = draft;
  if (!revision) return null;
  return (
    <fieldset>
      <legend>Previous criterion mappings</legend>
      <p>
        Every previous identity is retained, mapped or explicitly retired. Changed meanings still
        require new execution.
      </p>
      {revision.view.scope.basis.criteria.map((c) => (
        <label key={c.id}>
          {c.id}
          <select
            aria-label={`Map previous ${c.id}`}
            value={
              Object.hasOwn(mapping, c.id)
                ? (mapping[c.id] ?? "")
                : criteria.some((x) => x.id === c.id)
                  ? c.id
                  : ""
            }
            onChange={(e) => update({ mapping: { ...mapping, [c.id]: e.target.value || null } })}
          >
            <option value="">Retire this criterion</option>
            {criteria.map((x) => (
              <option key={x.id}>{x.id}</option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}
