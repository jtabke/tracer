import { useState } from "react";
import type { Entity, Relationship } from "../../src/core/model.ts";
import type { Configuration, ExactConfigurationInput } from "../../src/core/configuration.ts";
import { validateExactConfiguration } from "../../src/core/configuration-capture-validation.ts";
import { canonical } from "../../src/core/evidence.ts";
import type { Editing } from "../editing.ts";
import type { ReadResponse } from "../../src/interfaces/api-contract.ts";
import { RecordChoice, useApplicationDirty } from "../application-choices.tsx";
import { ApplicationRecovery } from "../application-task.tsx";
import { useProjection } from "../use-projection.ts";
import { ConfigurationDetails } from "./details.tsx";
import { ConfigurationMember, type CaptureMemberDraft } from "./member.tsx";
import { ConfigurationRelationships } from "./relationships.tsx";

const emptyMember = (): CaptureMemberDraft => ({
  key: crypto.randomUUID(),
  entityId: "",
  version: undefined,
  content: "none",
  observationId: "",
  reason: "",
});
type Context = ReadResponse<"/api/configuration-capture-context">;

type CaptureProps = {
  entities: Entity[];
  editing: Editing;
  active: boolean;
  onReturn(): void;
  changed(): void;
  onDirty(value: boolean): void;
};
export function ControlledConfigurationCapture({
  entities,
  editing,
  active,
  onReturn,
  changed,
  onDirty,
}: CaptureProps) {
  const draft = useCaptureDraft({ editing, changed, onDirty });
  const { context, refresh, prepared, saved, ready, stale, prepare, capture } = draft;
  return (
    <section
      className="configuration-capture configuration-task"
      aria-label="Capture configuration task"
      hidden={!active}
    >
      <button className="text-action" onClick={onReturn}>
        Return to configurations
      </button>
      <h2>Capture configuration</h2>
      <p>
        Select exact native revisions, explicit relationships and observed content. Omitted scope is
        not inferred.
      </p>
      {active && <ApplicationRecovery report={editing.report} refresh={refresh} />}
      <button disabled={editing.busy} onClick={refresh}>
        Refresh capture context
      </button>
      {context.failed && (
        <p role="alert">
          Capture context could not be read. Your selection is retained; prepare and capture are
          paused.
        </p>
      )}
      <CaptureSelection draft={draft} entities={entities} editing={editing} />
      <button disabled={editing.busy || !ready || Boolean(saved)} onClick={prepare}>
        {prepared ? "Adopt refreshed capture selection" : "Prepare capture"}
      </button>
      {prepared && !saved && (
        <p role={stale ? "alert" : "status"}>
          {stale
            ? "The selection or capture context changed. Your draft is retained; prepare again explicitly."
            : `Prepared ${prepared.members.length} native members, ${prepared.relationships.length} relationships and ${prepared.content.length} content states at native r${prepared.expectedProjectRevision} / evidence ${prepared.expectedEvidenceRevision}.`}
        </p>
      )}
      <button
        disabled={editing.busy || !ready || stale || Boolean(saved)}
        onClick={() => void capture()}
      >
        Capture configuration
      </button>
      {prepared && (
        <details>
          <summary>Exact capture proposal</summary>
          <pre>{JSON.stringify(prepared, null, 2)}</pre>
        </details>
      )}
      {saved && (
        <>
          <p role="status">
            Configuration captured. Start a new capture from the catalogue to choose another state.
          </p>
          <ConfigurationDetails value={saved} />
        </>
      )}
    </section>
  );
}

function captureProposal(
  id: string,
  name: string,
  subject: Entity,
  members: CaptureMemberDraft[],
  relationships: Relationship[],
  scope: ExactConfigurationInput["scope"],
  context: Context,
): ExactConfigurationInput {
  return {
    id,
    name,
    subjectId: subject.id,
    expectedSubjectVersion: subject.version,
    members: members.map((x) => ({ entityId: x.entityId, version: x.version ?? 0 })),
    relationships: relationships.map((x) => ({ relationshipId: x.id, version: x.version })),
    content: members
      .filter((x) => x.content !== "none")
      .map((x) => ({
        entityId: x.entityId,
        observationId: x.content === "observation" ? x.observationId : null,
        ...(x.reason ? { reason: x.reason } : {}),
      })),
    scope,
    expectedSchemaVersion: context.schema.version,
    expectedProjectRevision: context.projectRevision,
    expectedEvidenceRevision: context.evidenceRevision,
  };
}

function useCaptureDraft({
  editing,
  changed,
  onDirty,
}: Pick<CaptureProps, "editing" | "changed" | "onDirty">) {
  const [form, setForm] = useState(() => ({
    name: "",
    subject: undefined as Entity | undefined,
    members: [emptyMember()],
    relationships: [] as Relationship[],
    scope: { purpose: "", coverage: "partial", rationale: "" } as ExactConfigurationInput["scope"],
  }));
  const { name, subject, members, relationships, scope } = form;
  const update = (patch: Partial<typeof form>) =>
    setForm((previous) => ({ ...previous, ...patch }));
  const setName = (name: string) => update({ name });
  const setSubject = (subject: Entity | undefined) => update({ subject });
  const setScope = (scope: ExactConfigurationInput["scope"]) => update({ scope });
  const setRelationships = (relationships: Relationship[]) => update({ relationships });
  const setMembers = (change: (members: CaptureMemberDraft[]) => CaptureMemberDraft[]) =>
    setForm((previous) => ({ ...previous, members: change(previous.members) }));
  const [identity] = useState(() => crypto.randomUUID());
  const [epoch, setEpoch] = useState(0);
  const [readiness, setReadiness] = useState<Record<string, boolean>>({});
  const [linksReady, setLinksReady] = useState(true);
  const [prepared, setPrepared] = useState<ExactConfigurationInput>();
  const [saved, setSaved] = useState<Configuration>();
  const context = useProjection(
    "/api/configuration-capture-context",
    {},
    editing.epoch + epoch,
    editing.report,
  );
  const proposal =
    context.data && subject
      ? captureProposal(identity, name, subject, members, relationships, scope, context.data)
      : undefined;
  const stale = !proposal || !prepared || canonical(proposal) !== canonical(prepared);
  const ready = context.ready && members.every((x) => readiness[x.key]) && linksReady;
  const dirty =
    !saved &&
    [name, subject, scope.purpose, scope.rationale, ...members.map((x) => x.entityId)].some(
      Boolean,
    );
  useApplicationDirty(dirty, onDirty);
  const refresh = () => {
    setEpoch((x) => x + 1);
    changed();
  };
  const prepare = () => {
    if (!ready || !proposal || editing.busy || saved) return;
    setPrepared(prepareCapture(proposal, editing.report));
  };
  const capture = async () => {
    if (!ready || stale || !prepared || editing.busy || saved) return;
    const result = await editing.mutate("/api/configuration-captures", prepared);
    if (result) {
      setSaved(result);
      changed();
    }
  };
  return {
    name,
    setName,
    subject,
    setSubject,
    members,
    setMembers,
    relationships,
    setRelationships,
    scope,
    setScope,
    epoch,
    setReadiness,
    setLinksReady,
    prepared,
    saved,
    context,
    stale,
    ready,
    refresh,
    prepare,
    capture,
  };
}

function prepareCapture(proposal: ExactConfigurationInput, report: (error: unknown) => void) {
  try {
    validateExactConfiguration(proposal);
    return structuredClone(proposal);
  } catch (error) {
    report(error);
    return undefined;
  }
}

function CaptureSelection({
  draft,
  entities,
  editing,
}: {
  draft: ReturnType<typeof useCaptureDraft>;
  entities: Entity[];
  editing: Editing;
}) {
  const {
    name,
    setName,
    subject,
    setSubject,
    members,
    setMembers,
    relationships,
    setRelationships,
    scope,
    setScope,
    epoch,
    setReadiness,
    setLinksReady,
    saved,
  } = draft;
  return (
    <fieldset
      disabled={editing.busy || Boolean(saved)}
      aria-label="Controlled configuration selection"
    >
      <label>
        Configuration name
        <input
          aria-label="Configuration name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <RecordChoice
        name="Configuration subject"
        entities={entities}
        value={subject?.id ?? ""}
        onChange={(id) => setSubject(entities.find((x) => x.id === id))}
      />
      {subject && (
        <p>
          Selected subject v{subject.version}. Re-select deliberately to adopt another current
          revision.
        </p>
      )}
      <label>
        Capture purpose
        <textarea
          aria-label="Capture purpose"
          maxLength={4000}
          value={scope.purpose}
          onChange={(e) => setScope({ ...scope, purpose: e.target.value })}
        />
      </label>
      <label>
        Declared coverage
        <select
          aria-label="Declared coverage"
          value={scope.coverage}
          onChange={(e) =>
            setScope({ ...scope, coverage: e.target.value as "complete" | "partial" })
          }
        >
          <option value="partial">Partial engineering scope</option>
          <option value="complete">Complete for the stated purpose</option>
        </select>
      </label>
      <label>
        Scope rationale
        <textarea
          aria-label="Scope rationale"
          maxLength={4000}
          value={scope.rationale}
          onChange={(e) => setScope({ ...scope, rationale: e.target.value })}
        />
      </label>
      <p>Complete describes the stated purpose, not the entire project or release approval.</p>
      {members.map((member, index) => (
        <ConfigurationMember
          key={member.key}
          value={member}
          index={index}
          entities={entities}
          epoch={editing.epoch + epoch}
          report={editing.report}
          onChange={(patch) =>
            setMembers((items) => items.map((x) => (x.key === member.key ? { ...x, ...patch } : x)))
          }
          onReady={(value) =>
            setReadiness((previous) =>
              previous[member.key] === value ? previous : { ...previous, [member.key]: value },
            )
          }
          remove={() => setMembers((items) => items.filter((x) => x.key !== member.key))}
          canRemove={members.length > 1}
        />
      ))}
      <button
        disabled={members.length >= 100}
        onClick={() => setMembers((items) => [...items, emptyMember()])}
      >
        Add configuration member
      </button>
      <ConfigurationRelationships
        entities={entities}
        memberIds={members.map((x) => x.entityId)}
        value={relationships}
        onChange={setRelationships}
        epoch={editing.epoch + epoch}
        report={editing.report}
        onReady={setLinksReady}
      />
    </fieldset>
  );
}
