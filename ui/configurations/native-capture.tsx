import { useEffect, useRef, useState } from "react";
import type { Configuration } from "../../src/core/configuration.ts";
import type { Entity } from "../../src/core/model.ts";
import { ApiError } from "../api.ts";
import { ConfigurationDetails } from "./details.tsx";
import { label } from "../entity-label.ts";
import { NativeRevisionSelect } from "../native-revision-select.tsx";
import { useMutation } from "../use-mutation.ts";
import { usePageCursor } from "../use-page-cursor.ts";
import { useProjection } from "../use-projection.ts";
export { ConfigurationDetails } from "./details.tsx";

export function useConfigurations(epoch: number) {
  const cursor = usePageCursor();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const reconciliation = useRef<(() => void) | undefined>(undefined);
  const read = useProjection(
    "/api/configurations",
    { after: cursor.after, limit: 25 },
    epoch + retry,
    (error) => {
      reconciliation.current = undefined;
      setError(configurationReadError(error));
    },
  );
  useEffect(() => {
    if (read.ready) {
      reconciliation.current?.();
      reconciliation.current = undefined;
      setError("");
    }
  }, [read.state, read.ready]);
  return {
    read,
    cursor,
    error,
    refresh: (success?: () => void) => {
      reconciliation.current = success;
      setRetry((value) => value + 1);
    },
  };
}
export function ConfigurationPaging({
  catalog,
  onRefresh,
}: {
  catalog: ReturnType<typeof useConfigurations>;
  onRefresh?: () => void;
}) {
  return (
    <div className="toolbar">
      <button
        type="button"
        disabled={catalog.read.loading}
        onClick={() => (onRefresh ?? catalog.refresh)()}
      >
        Refresh configurations
      </button>
      <ConfigurationPageLinks catalog={catalog} />
      {!catalog.read.loading && !catalog.read.data && (
        <p role="alert">{catalog.error || "Configurations could not be read."}</p>
      )}
    </div>
  );
}
function ConfigurationPageLinks({ catalog }: { catalog: ReturnType<typeof useConfigurations> }) {
  if (!catalog.cursor.hasPrevious && !catalog.read.data?.nextAfter) return null;
  return (
    <>
      <button
        type="button"
        disabled={catalog.read.loading || !catalog.cursor.hasPrevious}
        onClick={catalog.cursor.previous}
      >
        Previous configurations
      </button>
      <button
        type="button"
        disabled={catalog.read.loading || !catalog.read.data?.nextAfter}
        onClick={() => catalog.cursor.next(catalog.read.data?.nextAfter)}
      >
        Next configurations
      </button>
    </>
  );
}
type MemberDraft = { entityId: string; version?: number };
export function ConfigurationCapture({
  entities,
  disabled,
  changed,
  report,
  catalog,
  stage = false,
  active = true,
  onReturn,
}: {
  entities: Entity[];
  catalog: ReturnType<typeof useConfigurations>;
  disabled: boolean;
  changed(): void;
  report(error: unknown, attempted?: unknown): void;
  stage?: boolean;
  active?: boolean;
  onReturn?(): void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<Entity>();
  const [members, setMembers] = useState<MemberDraft[]>([{ entityId: "" }]);
  const mutation = useMutation(report);
  const unknown = mutation.state.status === "unknown";
  const [saved, setSaved] = useState<Configuration>();
  const capture = async () => {
    if (!subject || disabled || mutation.blocked || !catalog.read.ready) return;
    const pins = members.flatMap((member) =>
      member.version === undefined ? [] : [{ entityId: member.entityId, version: member.version }],
    );
    if (pins.length !== members.length) return;
    const input = {
      name,
      subjectId: subject.id,
      expectedSubjectVersion: subject.version,
      members: pins,
    };
    setSaved(undefined);
    const saved = await mutation.run("/api/configurations", input);
    if (saved) {
      setSaved(saved);
      changed();
    }
  };
  const update = (index: number, value: MemberDraft) =>
    setMembers((items) => items.map((item, i) => (i === index ? value : item)));
  return (
    <ConfigurationCaptureSurface stage={stage} active={active} onReturn={onReturn}>
      <fieldset
        aria-label="Immutable configuration capture"
        disabled={disabled || mutation.blocked || !catalog.read.ready}
      >
        <CaptureIntroduction stage={stage} />
        <label>
          Configuration name
          <input
            aria-label="Configuration name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <EntityChoice
          title="Configuration subject"
          placeholder="Choose build or release record"
          value={subject?.id ?? ""}
          entities={entities}
          onChange={(entity) => setSubject(entity)}
        />
        {members.map((member, index) => (
          <fieldset key={index}>
            <legend>Configuration member {index + 1}</legend>
            <EntityChoice
              title="Member entity"
              placeholder="Choose native member"
              value={member.entityId}
              entities={entities}
              onChange={(entity) =>
                update(index, { entityId: entity?.id ?? "", version: entity?.version })
              }
            />
            <NativeRevisionSelect
              key={member.entityId}
              entity={entities.find((entity) => entity.id === member.entityId)}
              value={member.version}
              allowCurrent={false}
              onChange={(version) => update(index, { ...member, version })}
            />
            <button
              disabled={members.length === 1}
              onClick={() => setMembers((items) => items.filter((_, i) => i !== index))}
            >
              Remove member {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          disabled={members.length >= 100}
          onClick={() => setMembers((items) => [...items, { entityId: "" }])}
        >
          Add configuration member
        </button>
        <button
          disabled={
            !name.trim() ||
            !subject ||
            members.some((member) => !member.entityId || !member.version)
          }
          onClick={() => void capture()}
        >
          Capture configuration
        </button>
      </fieldset>
      {unknown && <ConfigurationRecovery catalog={catalog} mutation={mutation} name={name} />}
      {saved && <ConfigurationDetails value={saved} />}
    </ConfigurationCaptureSurface>
  );
}

function CaptureIntroduction({ stage }: { stage: boolean }) {
  if (stage) return <p>Choose a subject and exact native member revisions.</p>;
  return (
    <>
      <legend>Immutable configuration capture</legend>
      <p>
        Choose a build or release record and exact native member versions. Captures may mix
        revisions from different points in history.
      </p>
    </>
  );
}

function ConfigurationCaptureSurface({
  stage,
  active,
  onReturn,
  children,
}: {
  stage: boolean;
  active: boolean;
  onReturn?: () => void;
  children: React.ReactNode;
}) {
  if (!stage)
    return (
      <details className="configuration-capture">
        <summary>Capture a revision-pinned configuration</summary>
        {children}
      </details>
    );
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
      {children}
    </section>
  );
}

function EntityChoice({
  title,
  placeholder,
  value,
  entities,
  onChange,
}: {
  title: string;
  placeholder: string;
  value: string;
  entities: Entity[];
  onChange(entity?: Entity): void;
}) {
  return (
    <label>
      {title}
      <select
        aria-label={title}
        value={value}
        onChange={(event) => onChange(entities.find((entity) => entity.id === event.target.value))}
      >
        <option value="">{placeholder}</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {label(entity)} · v{entity.version}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConfigurationRecovery({
  catalog,
  mutation,
  name,
}: {
  catalog: ReturnType<typeof useConfigurations>;
  mutation: ReturnType<typeof useMutation>;
  name: string;
}) {
  const refreshed =
    catalog.read.ready && mutation.state.status === "unknown" && mutation.state.inspectedRead;
  return (
    <section aria-label="Capture recovery">
      <p role="alert">
        Capture outcome is unknown. The draft is retained and retry is paused. Refresh and inspect
        the recorded captures before continuing.
      </p>
      <ConfigurationPaging
        catalog={catalog}
        onRefresh={() => catalog.refresh(mutation.beginReconciliation())}
      />
      {catalog.read.data?.items
        .filter((value) => value.name === name.trim())
        .map((value) => (
          <details key={value.id}>
            <summary>
              Recorded capture: {value.name} · {value.id}
            </summary>
            <ConfigurationDetails value={value} />
          </details>
        ))}
      <p>
        The catalogue is paged; check other pages if needed. A recorded capture may already contain
        this proposal.
      </p>
      <button disabled={!refreshed} onClick={mutation.acknowledge}>
        I inspected refreshed captures; continue editing
      </button>
    </section>
  );
}

function configurationReadError(error: unknown) {
  return error instanceof ApiError && error.code === "not_found"
    ? "This running server does not support configuration captures. Restart it with current Tracer source and reopen the same database. Historical-input selection is paused."
    : String(error);
}
