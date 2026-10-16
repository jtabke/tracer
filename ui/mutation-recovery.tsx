import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MutationAttempt } from "./mutation-controller.ts";
import type { Reconciliation } from "./reconcile-mutation.ts";
import { reconcileMutation } from "./reconcile-mutation.ts";
import type { useMutation } from "./use-mutation.ts";

export function MutationRecovery({
  mutation,
  refreshed,
  resumed,
}: {
  mutation: ReturnType<typeof useMutation>;
  refreshed(): void;
  resumed(): void;
}) {
  const region = useRef<HTMLElement>(null);
  const [reading, setReading] = useState(false);
  const [snapshot, setSnapshot] = useState<{ attempt: MutationAttempt; records: Reconciliation }>();
  const [failure, setFailure] = useState<{ attempt: MutationAttempt; message: string }>();
  const state = mutation.state;
  const attempt = state.status === "unknown" ? state.attempt : undefined;
  useEffect(() => {
    if (!attempt) return;
    region.current?.focus();
    region.current?.scrollIntoView({ block: "nearest" });
  }, [attempt]);
  if (state.status !== "unknown") return null;
  const records = snapshot?.attempt === state.attempt ? snapshot.records : undefined;
  const error = failure?.attempt === state.attempt ? failure.message : "";
  const refresh = async () => {
    const success = mutation.beginReconciliation();
    setReading(true);
    setSnapshot(undefined);
    setFailure(undefined);
    try {
      const records = await reconcileMutation(state.attempt.path, state.attempt.input);
      setSnapshot({ attempt: state.attempt, records });
      success();
      refreshed();
    } catch (failure) {
      setFailure({ attempt: state.attempt, message: String(failure) });
    } finally {
      setReading(false);
    }
  };
  const content = (
    <section ref={region} tabIndex={-1} aria-label="Save recovery">
      <p role="alert">
        The save outcome is unknown. Your proposal is retained and further saves are paused.
      </p>
      <button disabled={reading} onClick={() => void refresh()}>
        Refresh saved records
      </button>
      {error && <p role="alert">{error}</p>}
      {records && <RecordedResults value={records} />}
      <p>
        Inspect the recorded result before deciding whether to retry. Continuing retains your draft
        and does not retry it.
      </p>
      <button
        disabled={reading || !state.inspectedRead}
        onClick={() => {
          mutation.acknowledge();
          resumed();
        }}
      >
        I inspected saved records; continue editing
      </button>
    </section>
  );
  const dialog = typeof document === "undefined" ? null : document.querySelector("dialog[open]");
  return dialog ? createPortal(content, dialog) : content;
}

function RecordedResults({ value }: { value: Reconciliation }) {
  return (
    <div aria-label="Recorded save results">
      {!value.records.length && (
        <p>No records appear in this excerpt. This does not establish that nothing was saved.</p>
      )}
      {value.incomplete && (
        <p>
          Additional records are outside this excerpt. Inspect the relevant history or catalogue
          before deciding to retry.
        </p>
      )}
      {value.records.map((record) => (
        <article key={record.id}>
          <strong>{record.heading}</strong>
          <p>{record.description}</p>
          <details>
            <summary>Full recorded data</summary>
            <pre>{JSON.stringify(record.value, null, 2)}</pre>
          </details>
        </article>
      ))}
    </div>
  );
}
