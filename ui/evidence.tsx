import { useRef, useState } from "react";
import type { ExternalIdentity, Observation, Receipt } from "../src/core/evidence.ts";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import { read } from "./api.ts";
import { ConfigurationCapture, useConfigurations } from "./configurations.tsx";
import type { Save } from "./editing.ts";
import { EvidenceReviewStage } from "./evidence-review-stage.tsx";
import "./evidence.css";
import { label } from "./fields.tsx";
import type { MutationExecutor } from "./mutation-controller.ts";
import { ReceiptCapture } from "./receipt-capture.tsx";
import { useRead } from "./use-read.ts";

export function EvidenceView({
  epoch,
  changed,
  report,
  mutate,
  onOpenReceipt,
}: {
  onOpenReceipt?(receiptId: string, focusInputId?: string): void;
  mutate: MutationExecutor;
  epoch: number;
  changed: () => void;
  report: (error: unknown, attempted?: unknown) => void;
}) {
  const externalHeading = useRef<HTMLLegendElement>(null);
  const receiptHeading = useRef<HTMLLegendElement>(null);
  const [task, setTask] = useState<"catalogue" | "receipt" | "artifact">("catalogue");
  const receiptPicker = useRef<HTMLSelectElement>(null);
  const returnToCatalog = () => {
    setTask("catalogue");
    requestAnimationFrame(() => {
      receiptPicker.current?.focus({ preventScroll: true });
      receiptPicker.current?.scrollIntoView({ block: "nearest" });
    });
  };
  const selection = useReceiptSelection(onOpenReceipt);
  const { selected, reviewActive, chooseReceipt } = selection;
  const goToTask = (heading: HTMLLegendElement | null) => {
    requestAnimationFrame(() => {
      heading?.focus({ preventScroll: true });
      heading?.closest(".evidence-author-stage")?.scrollIntoView({ block: "start" });
    });
  };
  const { schema, entities, external, observations, receipts, limited, ready } = useEvidenceLists(
    epoch,
    report,
  );
  const catalog = useConfigurations(epoch);
  const { busy, notice, save } = useEvidenceWrite(changed, mutate);
  const paused = busy || !ready;
  const {
    artifact,
    setArtifact,
    system,
    setSystem,
    externalId,
    setExternalId,
    path,
    setPath,
    repository,
    setRepository,
    ref,
    setRef,
  } = useExternalDraft();
  const options = entities.map((value) => (
    <option key={value.id} value={value.id}>
      {label(value)} · v{value.version}
    </option>
  ));
  const binding = external.find((value) => value.id === artifact);
  function adoptLocator(latest: Observation["locator"] | undefined) {
    setPath(latest?.path ?? "");
    setRepository(latest?.system === "git" ? latest.repository : "");
    setRef(latest?.system === "git" ? latest.ref : "HEAD");
  }
  function chooseArtifact(id: string) {
    setArtifact(id);
    const value = external.find((item) => item.id === id);
    if (value) setSystem(value.system);
    const latest = observations.filter((item) => item.entityId === id).at(-1)?.locator;
    adoptLocator(latest);
    setExternalId(value?.externalId ?? "");
  }
  function renderExternalTask() {
    return (
      <>
        <fieldset disabled={paused || limited}>
          <legend ref={externalHeading} tabIndex={-1}>
            External artifact: bind identity
          </legend>
          <p>
            Choose a native artifact item. Its identity and links stay in Tracer; the external
            source owns its content.
          </p>
          <label>
            Artifact entity
            <select
              aria-label="Artifact entity"
              value={artifact}
              onChange={(event) => chooseArtifact(event.target.value)}
            >
              <option value="">Choose entity</option>
              {options}
            </select>
          </label>
          {binding ? (
            <p>
              Stable {binding.system} identity: {binding.externalId} · external ownership ·{" "}
              {binding.id}
            </p>
          ) : (
            <>
              <label>
                Source system
                <select
                  aria-label="Source system"
                  value={system}
                  onChange={(event) => setSystem(event.target.value as "git" | "file")}
                >
                  <option value="git">Git (committed file)</option>
                  <option value="file">Local file</option>
                </select>
              </label>
              <label>
                Stable external identifier
                <input
                  value={externalId}
                  onChange={(event) => setExternalId(event.target.value)}
                  placeholder="module-03 (not a file path)"
                />
              </label>
              <button
                disabled={!artifact || !externalId.trim()}
                onClick={() =>
                  void save("/api/external", {
                    entityId: artifact,
                    system,
                    externalId,
                    ownership: "external",
                  })
                }
              >
                Bind identity
              </button>
            </>
          )}
          <h3>Observe scoped content offline</h3>
          {system === "git" && (
            <>
              <label>
                Local Git repository
                <input value={repository} onChange={(event) => setRepository(event.target.value)} />
              </label>
              <label>
                Local Git ref
                <input value={ref} onChange={(event) => setRef(event.target.value)} />
              </label>
            </>
          )}
          <label>
            {system === "git" ? "Repository-relative file path" : "Local file path"}
            <input value={path} onChange={(event) => setPath(event.target.value)} />
          </label>
          <p>
            Git resolves the ref to an immutable commit and reads only this committed file (not
            working-tree edits). Moving a path does not change the artifact identity. Files up to 16
            MiB; unavailable or unverifiable states are recorded as unknown. No network fetch.
          </p>
          <button
            disabled={!binding || !path.trim()}
            onClick={() =>
              void save("/api/observations", {
                entityId: artifact,
                locator: system === "git" ? { system, repository, ref, path } : { system, path },
              })
            }
          >
            Record observation
          </button>
          {observations
            .filter((value) => value.entityId === artifact)
            .slice(-5)
            .reverse()
            .map((value) => (
              <details key={value.id}>
                <summary>
                  {value.availability} · {value.at} · {value.commit ?? value.hash ?? value.reason}
                </summary>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </details>
            ))}
        </fieldset>
      </>
    );
  }
  return (
    <section className="evidence-workspace" aria-label="Evaluation evidence">
      <div hidden={task !== "catalogue"}>
        <h2>Evaluations</h2>
        <p>Recorded outcomes and the exact inputs they evaluated.</p>
      </div>
      <LocalEvidenceReview
        external={Boolean(onOpenReceipt)}
        selection={selection}
        epoch={epoch}
        changed={changed}
        mutate={mutate}
        report={report}
      />
      <div hidden={(!onOpenReceipt && reviewActive) || task !== "catalogue"}>
        <EvidenceTaskActions
          onRecord={() => {
            setTask("receipt");
            goToTask(receiptHeading.current);
          }}
          onObserve={() => {
            setTask("artifact");
            goToTask(externalHeading.current);
          }}
        />
        <label>
          Exact receipt
          <select
            ref={receiptPicker}
            aria-label="Evaluation receipt"
            value={selected}
            onChange={(event) => chooseReceipt(event.target.value)}
          >
            <option value="">Choose receipt</option>
            {receipts.map((value) => (
              <option key={value.id} value={value.id}>
                {label(value.output)} · {value.at}
              </option>
            ))}
          </select>
        </label>
        <RecordedEvaluationResults
          ready={ready}
          receipts={receipts}
          selected={selected}
          onSelect={chooseReceipt}
        />
        {limited && (
          <p role="status">
            Large project: creation pickers are disabled beyond 1,000 items. Use Work to find and
            connect items; existing receipts can still be compared and reviewed here.
          </p>
        )}
      </div>
      <p role="status">{notice}</p>
      <div className="evidence-create evidence-author-stage" hidden={task !== "receipt"}>
        <header>
          <button onClick={returnToCatalog}>Return to recorded evaluations</button>
          <h2>Record an evaluation</h2>
        </header>
        <ReceiptCapture
          schema={schema}
          epoch={epoch}
          report={report}
          entities={entities}
          external={external}
          observations={observations}
          receipts={receipts}
          busy={paused}
          limited={limited}
          heading={receiptHeading}
          save={save}
          catalog={catalog}
        />
      </div>
      <LegacyConfigurationCapture
        enabled={!onOpenReceipt}
        catalog={catalog}
        entities={entities}
        disabled={paused || limited}
        changed={changed}
        report={report}
      />
      <div className="evidence-author-stage" hidden={task !== "artifact"}>
        <header>
          <button onClick={returnToCatalog}>Return to recorded evaluations</button>
          <h2>Observe an external artifact</h2>
        </header>
        {renderExternalTask()}
      </div>
    </section>
  );
}

function LegacyConfigurationCapture({
  enabled,
  ...props
}: Parameters<typeof ConfigurationCapture>[0] & { enabled: boolean }) {
  if (!enabled) return null;
  return <ConfigurationCapture {...props} />;
}

function EvidenceTaskActions({ onRecord, onObserve }: { onRecord(): void; onObserve(): void }) {
  return (
    <nav className="toolbar" aria-label="Evidence tasks">
      <button onClick={onRecord}>Record native-input receipt</button>
      <button onClick={onObserve}>Observe external artifact</button>
    </nav>
  );
}

function LocalEvidenceReview({
  external,
  selection,
  epoch,
  changed,
  mutate,
  report,
}: {
  external: boolean;
  selection: ReturnType<typeof useReceiptSelection>;
  epoch: number;
  changed(): void;
  mutate: MutationExecutor;
  report(error: unknown, attempted?: unknown): void;
}) {
  if (external) return null;
  return (
    <>
      <EvidenceReviewStage
        receiptId={selection.selected}
        epoch={epoch}
        changed={changed}
        mutate={mutate}
        report={report}
        active={selection.reviewActive}
        returnLabel="Return to recorded evaluations"
        onReturn={() => selection.setReviewActive(false)}
        onDraftChange={selection.setReviewDirty}
        onReceiptChangeBlocked={selection.setSelected}
      />
      {selection.reviewDirty && !selection.reviewActive && (
        <button onClick={() => selection.setReviewActive(true)}>Return to review draft</button>
      )}
    </>
  );
}

function useReceiptSelection(onOpenReceipt?: (id: string, focusInputId?: string) => void) {
  const [selected, setSelected] = useState("");
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const chooseReceipt = (id: string) => {
    if (onOpenReceipt) {
      onOpenReceipt(id);
      return;
    }
    if (reviewDirty && id !== selected) {
      setReviewActive(true);
      return;
    }
    setSelected(id);
    setReviewActive(Boolean(id));
  };
  return {
    selected,
    setSelected,
    reviewActive,
    setReviewActive,
    reviewDirty,
    setReviewDirty,
    chooseReceipt,
  };
}

const emptyLists = {
  schema: null as SchemaObject | null,
  entities: [] as Entity[],
  external: [] as ExternalIdentity[],
  observations: [] as Observation[],
  receipts: [] as Receipt[],
  limited: false,
};
function useEvidenceLists(epoch: number, report: (error: unknown) => void) {
  const projection = useRead(
    "evidence-lists",
    epoch,
    async () => {
      const values = await Promise.all([
        read("/api/work", { limit: 1000 }),
        read("/api/evidence", { kind: "external", limit: 1000 }),
        read("/api/evidence", { kind: "observation", limit: 1000 }),
        read("/api/evidence", { kind: "receipt", limit: 1000 }),
      ]);
      if ([values[1], values[2], values[3]].some((value) => value.nextAfter))
        throw new Error(
          "Evidence workspace supports up to 1000 items per list; use paginated CLI queries for larger projects.",
        );
      return {
        schema: values[0].schema,
        entities: values[0].entities.items,
        external: values[1].items,
        observations: values[2].items,
        receipts: values[3].items,
        limited: Boolean(values[0].entities.nextAfter),
      };
    },
    report,
  );
  return { ...(projection.data ?? projection.retained ?? emptyLists), ready: projection.ready };
}
function useEvidenceWrite(changed: () => void, mutate: MutationExecutor) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const save: Save = async (endpoint, input) => {
    setNotice("");
    setBusy(true);
    try {
      const result = await mutate(endpoint, input);
      if (result === undefined) return false;
      setNotice("Immutable record saved. Original evidence unchanged.");
      changed();
      return true;
    } finally {
      setBusy(false);
    }
  };
  return { busy, notice, save };
}

function useExternalDraft() {
  const [artifact, setArtifact] = useState(""),
    [system, setSystem] = useState<"git" | "file">("git"),
    [externalId, setExternalId] = useState(""),
    [path, setPath] = useState(""),
    [repository, setRepository] = useState(""),
    [ref, setRef] = useState("HEAD");
  return {
    artifact,
    setArtifact,
    system,
    setSystem,
    externalId,
    setExternalId,
    path,
    setPath,
    repository,
    setRepository,
    ref,
    setRef,
  };
}

function RecordedEvaluationResults({
  ready,
  receipts,
  selected,
  onSelect,
}: {
  ready: boolean;
  receipts: Receipt[];
  selected: string;
  onSelect(id: string): void;
}) {
  return (
    <div className="evidence-results" aria-label="Recorded evaluation results">
      {!ready && <p role="status">Reading evaluation results…</p>}
      {ready && !receipts.length && (
        <p>
          No recorded evaluations yet. Capture the inputs and conclusion of your first evaluation
          below.
        </p>
      )}
      {receipts.map((value) => (
        <button
          key={value.id}
          aria-pressed={selected === value.id}
          onClick={() => onSelect(value.id)}
        >
          <span className="receipt-outcome">
            <span>{value.output.key ?? value.output.type.replaceAll("_", " ")}</span>
            <span>{value.at.slice(0, 10)}</span>
          </span>
          <h3>{String(value.output.fields.title ?? label(value.output))}</h3>
          <p className="receipt-conclusion">{value.outcome}</p>
          <small>{value.inputs.length} declared inputs</small>
        </button>
      ))}
    </div>
  );
}
