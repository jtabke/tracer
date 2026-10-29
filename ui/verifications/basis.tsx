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
import type { ConfigurationHandoff } from "../configuration-handoff.ts";
import type { VerificationTargetPolicy } from "../../src/core/verification-case.ts";
import { CriterionSource, MethodAssignments } from "./basis-source.tsx";
import type { BasisCapture } from "./basis-source.tsx";
import { verificationCommand, useRecoveredVerification } from "./common.ts";
type BasisEditorProps = {
  intent?: ConfigurationHandoff;
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
function initialBasisFields(
  revision: VerificationAnalysis | undefined,
  intent?: ConfigurationHandoff,
): BasisFields {
  return {
    modelKey: "",
    targetId: revision?.view.scope.target?.configurationId ?? intent?.pair.afterId ?? "",
    targetPolicy: revision?.view.scope.target?.policy ?? "target-reference-uses-v2",
    requirementId: revision?.view.scope.basis.requirement.entityId ?? intent?.rootId ?? "",
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
}: BasisEditorProps) {
  const [draft, setDraft] = useState(() => initialBasisFields(revision, intent)),
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
  function update(patch: Partial<BasisFields>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }
  const setModelKey = (value: string) => update({ modelKey: value });
  const setRequirementId = (value: string) => update({ requirementId: value });
  const setTitle = (value: string) => update({ title: value });
  const setPurpose = (value: string) => update({ purpose: value });
  const setReason = (value: string) => update({ reason: value });
  const setCoverage = (value: BasisFields["coverage"]) => update({ coverage: value });
  const setExtra = (value: Record<string, string>) => update({ extra: value });
  const setCriteria = (value: BasisFields["criteria"]) => update({ criteria: value });
  const setAssignments = (value: Record<string, string[]>) => update({ assignments: value });
  const setMapping = (value: Record<string, string | null>) => update({ mapping: value });
  function setCapture(value: BasisCapture | undefined) {
    setPreparation(value ? { capture: value, revision } : undefined);
  }
  const source = useVerificationBasisSource(
    { models, entities, modelKey, requirementId, targetId, modelPin: revision?.view.model.pin },
    editing,
    epoch,
  );
  const { model, definition } = source;
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
    const requirement = source.entities.find((x) => x.id === requirementId);
    if (!model.ready || !model.data || !source.ready || !requirement) return;
    setCapture(
      structuredClone({
        model: model.data,
        requirement,
        methods: source.entities.filter((x) => x.type === model.data!.definition.method.type),
        links: source.relationships,
        ...(source.target.data
          ? { target: { id: source.target.data.id, name: source.target.data.name }, targetPolicy }
          : {}),
      }),
    );
  }
  async function submit() {
    if (!ready || !capture || stale || !model.ready || !source.ready) return;
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
    models: source.models,
    entities: source.entities,
    editing,
    epoch,
    revision,
    ready,
    targetId,
    targetPolicy,
    source,
    setTargetId: (targetId: string) => {
      if (
        criteria.length &&
        !window.confirm(
          "Changing the engineering target clears criterion ranges and method assignments. Continue?",
        )
      )
        return;
      update({ targetId, modelKey: "", criteria: [], assignments: {} });
      setCapture(undefined);
    },
    setTargetPolicy: (targetPolicy: VerificationTargetPolicy) => update({ targetPolicy }),
    modelKey,
    setModelKey,
    requirementId,
    setRequirementId,
    title,
    setTitle,
    purpose,
    setPurpose,
    reason,
    setReason,
    coverage,
    setCoverage,
    extra,
    setExtra,
    criteria,
    setCriteria,
    assignments,
    setAssignments,
    mapping,
    setMapping,
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
      <fieldset disabled={!ready || editing.busy}>
        <VerificationTargetChoice
          id={draft.targetId}
          target={source.target.retained}
          policy={draft.targetPolicy}
          bound={Boolean(revision?.view.scope.target)}
          editing={editing}
          onChange={draft.setTargetId}
          onPolicy={draft.setTargetPolicy}
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
            !model.ready || !source.ready || !model.data?.compatibility.writable || !requirementId
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

function BasisIdentity({ draft }: { draft: BasisDraft }) {
  const {
    models,
    entities,
    definition,
    modelKey,
    setModelKey,
    setCapture,
    setRequirementId,
    title,
    setTitle,
    purpose,
    setPurpose,
    requirementId,
    criteria,
    setCriteria,
    setAssignments,
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
          onChange={(e) => {
            if (
              criteria.length &&
              !window.confirm(
                "Changing verification model clears selected criterion ranges and method assignments. Continue?",
              )
            )
              return;
            setCriteria([]);
            setAssignments({});
            setModelKey(e.target.value);
            setCapture(undefined);
            setRequirementId("");
          }}
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
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Verification purpose
        <textarea
          aria-label="Verification purpose"
          required
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </label>
      <RecordChoice
        name="Requirement"
        titleField={definition?.requirement.fields.title}
        required
        entities={entities.filter((x) => x.type === definition?.requirement.type)}
        value={requirementId}
        onChange={(id) => {
          if (
            criteria.length &&
            !window.confirm(
              "Changing requirement clears the selected criterion ranges and method assignments. Continue?",
            )
          )
            return;
          setRequirementId(id);
          setCapture(undefined);
          setCriteria([]);
          setAssignments({});
        }}
      />
    </>
  );
}

function PreparedBasis({ draft }: { draft: BasisDraft }) {
  const {
    capture,
    stale,
    criteria,
    setCriteria,
    assignments,
    setAssignments,
    coverage,
    setCoverage,
    revision,
    reason,
    setReason,
    extra,
    setExtra,
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
      <CriterionSource capture={capture} criteria={criteria} onChange={setCriteria} />
      <MethodAssignments
        capture={capture}
        criteria={criteria}
        assignments={assignments}
        onChange={setAssignments}
      />
      <label>
        Declared source coverage
        <select
          aria-label="Declared source coverage"
          value={coverage}
          onChange={(e) => setCoverage(e.target.value as typeof coverage)}
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
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {!revision && (
        <AdditionalFields
          title="Verification"
          definitions={capture.model.requiredFields.case}
          values={extra}
          onChange={setExtra}
        />
      )}
      <button type="submit" disabled={stale || !model.ready || !source.ready || !criteria.length}>
        {revision ? "Save revised basis" : "Open verification"}
      </button>
    </>
  );
}

function PreviousMappings({ draft }: { draft: BasisDraft }) {
  const { revision, mapping, setMapping, criteria } = draft;
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
            onChange={(e) => setMapping({ ...mapping, [c.id]: e.target.value || null })}
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
