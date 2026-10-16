import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Entity, Relationship } from "../src/core/model.ts";
import { read } from "./api.ts";
import { label } from "./entity-label.ts";
import { readable } from "./presentation-text.ts";
import type { InputDraft } from "./receipt-authoring-state.ts";
import { pathComplete } from "./receipt-authoring-state.ts";
import { statementText } from "./statement-text.ts";
import { usePageCursor } from "./use-page-cursor.ts";
import { useProjection } from "./use-projection.ts";
import { useRead } from "./use-read.ts";

export function ReceiptPathEditor({
  input,
  output,
  entities,
  epoch,
  report,
  onChange,
}: {
  input: InputDraft;
  output?: Entity;
  entities: Entity[];
  epoch: number;
  report(error: unknown): void;
  onChange(patch: Partial<InputDraft>): void;
}) {
  const cursor = usePageCursor();
  const endpoint = input.hops.at(-1)?.relationship.target ?? output?.id;
  const [candidate, setCandidate] = useState("");
  const choices = useProjection(
    "/api/connections",
    endpoint ? { id: endpoint, after: cursor.after, limit: 50 } : undefined,
    epoch,
    report,
  );
  const verification = usePathVerification(input, output, entities, epoch, report, onChange);
  const resetChoices = useEffectEvent(() => {
    cursor.reset();
    setCandidate("");
  });
  useEffect(() => {
    resetChoices();
  }, [endpoint]);
  const outgoing =
    choices.data?.items.filter(
      (value) =>
        value.relationship.source === endpoint &&
        !input.hops.some((hop) => hop.relationship.id === value.relationship.id),
    ) ?? [];
  const selected = outgoing.find((value) => value.relationship.id === candidate);
  return (
    <section className="receipt-path-editor" aria-label="Recorded dependency path">
      <p>
        Follow stored outgoing connections from the output to this input. Selected link versions are
        checked when recording.
      </p>
      <ol>
        {input.hops.map((hop, index) => (
          <li key={hop.relationship.id}>
            <span>
              {label(index ? input.hops[index - 1].target : output!)} →{" "}
              {readable(hop.relationship.type)} → {label(hop.target)} · link v
              {hop.relationship.version}
            </span>
            <button
              onClick={() =>
                onChange({
                  hops: input.hops.slice(0, index),
                  pathValid: false,
                  pathEpoch: undefined,
                  notice: "Path trimmed; choose any remaining steps explicitly.",
                })
              }
            >
              Remove path step {index + 1} and following
            </button>
          </li>
        ))}
      </ol>
      <PathReadStatus
        input={input}
        verification={verification}
        onAdopt={() => {
          const hops = verification.latest!.map((link) => ({
            relationship: link!,
            target: entities.find((entity) => entity.id === link!.target)!,
          }));
          onChange({
            hops,
            pathValid: false,
            pathEpoch: undefined,
            notice:
              "Current link revisions adopted. Check the complete directed path before recording.",
          });
        }}
      />
      <OutgoingReadStatus loading={choices.loading} failed={choices.failed} />
      <label>
        Next path connection
        <select
          aria-label="Next path connection"
          value={candidate}
          disabled={!choices.ready || input.hops.length >= 100}
          onChange={(event) => setCandidate(event.target.value)}
        >
          <option value="">Choose a stored outgoing connection</option>
          {outgoing.map((value) => (
            <option key={value.relationship.id} value={value.relationship.id}>
              {readable(value.relationship.type)} → {label(value.target)} ·{" "}
              {String(value.target.fields.title ?? value.target.type)} · link v
              {value.relationship.version} · {value.relationship.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="receipt-path-target" aria-label="Next path target context">
          <strong>
            {label(selected.target)} · loaded v{selected.target.version}
          </strong>
          <p>{statementText(selected.target)}</p>
          <button
            disabled={!choices.ready}
            onClick={() => {
              onChange({
                hops: [
                  ...input.hops,
                  { relationship: selected.relationship, target: selected.target },
                ],
                pathValid: false,
                pathEpoch: undefined,
              });
              setCandidate("");
            }}
          >
            Add selected path step
          </button>
        </div>
      )}
      <PathChoicePaging
        previous={cursor.hasPrevious}
        next={choices.data?.nextAfter}
        paused={!choices.ready}
        onPrevious={cursor.previous}
        onNext={() => {
          cursor.next(choices.data?.nextAfter);
          setCandidate("");
        }}
      />
      {choices.ready && !outgoing.length && <p>No unused outgoing connection on this page.</p>}
      <small>
        {input.hops.length} / 100 unique links. Entity cycles are permitted; the ordered path must
        end at the chosen input.
      </small>
    </section>
  );
}
function OutgoingReadStatus({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (loading) return <p role="status">Reading outgoing connections…</p>;
  if (failed)
    return (
      <p role="alert">
        Outgoing connection read failed. Chosen steps remain; refresh before adding a step.
      </p>
    );
  return null;
}
function PathChoicePaging({
  previous,
  next,
  paused,
  onPrevious,
  onNext,
}: {
  previous: boolean;
  next?: string;
  paused: boolean;
  onPrevious(): void;
  onNext(): void;
}) {
  if (!previous && !next) return null;
  return (
    <div className="toolbar">
      <button disabled={paused || !previous} onClick={onPrevious}>
        Previous outgoing connections
      </button>
      <button disabled={paused || !next} onClick={onNext}>
        Next outgoing connections
      </button>
    </div>
  );
}
function usePathVerification(
  input: InputDraft,
  output: Entity | undefined,
  entities: Entity[],
  epoch: number,
  report: (error: unknown) => void,
  onChange: (patch: Partial<InputDraft>) => void,
) {
  const key = input.hops.length
    ? JSON.stringify(input.hops.map((hop) => [hop.relationship.id, hop.relationship.version]))
    : undefined;
  const latest = useRead(
    key,
    epoch,
    async () =>
      Promise.all(
        input.hops.map(async (hop) => {
          const page = await read("/api/history", {
            kind: "relationship",
            id: hop.relationship.id,
            limit: 1000,
          });
          if (page.nextAfter)
            throw new Error(
              "Chosen connection exceeds 1,000 recorded revisions; path verification is paused.",
            );
          return (page.items.at(-1)?.snapshot ?? null) as Relationship | null;
        }),
      ),
    report,
  );
  const callback = useRef(onChange);
  callback.current = onChange;
  const matched =
    latest.ready &&
    latest.data!.every((link, index) => link?.version === input.hops[index].relationship.version);
  const complete =
    !!output && !!input.chosen && pathComplete(output.id, input.chosen.entity.id, input.hops);
  useEffect(() => {
    callback.current({
      pathEpoch: latest.ready ? epoch : undefined,
      pathValid: matched && complete,
    });
  }, [latest.state, latest.ready, epoch, matched, complete]);
  const adoptable =
    latest.ready &&
    latest.data!.every((link) => !!link && entities.some((entity) => entity.id === link.target));
  return {
    ready: latest.ready,
    loading: latest.loading,
    failed: latest.failed,
    matched,
    complete,
    adoptable,
    latest: latest.data,
  };
}
function PathReadStatus({
  input,
  verification,
  onAdopt,
}: {
  input: InputDraft;
  verification: ReturnType<typeof usePathVerification>;
  onAdopt(): void;
}) {
  if (!input.hops.length)
    return <p>Choose at least one stored connection, or use Direct dependency.</p>;
  if (verification.loading) return <p role="status">Checking chosen link revisions…</p>;
  if (verification.failed)
    return (
      <p role="alert">
        Chosen path could not be checked. Recording is paused; its original hops are retained.
      </p>
    );
  if (!verification.matched)
    return (
      <div role="status">
        <p>One or more chosen connections changed or were removed. Recording is paused.</p>
        <button disabled={!verification.adoptable} onClick={onAdopt}>
          Use current path
        </button>
        <p>
          Adopting link revisions does not repair a broken direction or endpoint; rebuild
          incompatible steps.
        </p>
      </div>
    );
  return (
    <p>
      {verification.complete
        ? "Complete forward path to the selected input."
        : "This path does not yet reach the selected input from the chosen output."}
    </p>
  );
}
