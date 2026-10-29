import { useState } from "react";
import type { ResolvedApplicationModel } from "../../src/core/application-model.ts";
import type { Editing } from "../editing.ts";
import type { modelChoices } from "./choices.tsx";
function CaptureBaseline({
  editing,
  context,
  changed,
}: {
  editing: Editing;
  context?: { projectRevision: number };
  changed(): void;
}) {
  const [name, setName] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  return (
    <div>
      <label>
        New baseline name
        <input
          aria-label="New assessment baseline name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={editing.busy || !context || !name.trim()}
        onClick={() => {
          if (context)
            void editing
              .mutate("/api/baselines", {
                id,
                name,
                expectedProjectRevision: context.projectRevision,
              })
              .then((saved) => {
                if (saved) changed();
              });
        }}
      >
        Capture current baseline
      </button>
    </div>
  );
}

export function ModelChoice({
  models,
  modelKey,
  model,
  onChoose,
}: {
  models: ReturnType<typeof modelChoices>;
  modelKey: string;
  model: import("../use-projection.ts").Projection<"/api/application-model">;
  onChoose(value: string): void;
}) {
  return (
    <>
      {" "}
      <label>
        Application model
        <select
          aria-label="Assessment application model"
          value={modelKey}
          onChange={(e) => onChoose(e.target.value)}
        >
          <option value="">Choose a model and version</option>
          {modelKey && !models.some((item) => item.name === modelKey) && (
            <option value={modelKey}>{modelKey} · retained pin</option>
          )}
          {models.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {model.loading && <p role="status">Checking model compatibility…</p>}
      {model.data && (
        <p>
          Model v{model.data.pin.version} · schema v{model.data.context.schemaVersion} ·{" "}
          {model.data.compatibility.writable ? "Compatible" : "Incompatible"}
        </p>
      )}
      {model.data?.compatibility.issues.map((issue) => (
        <p role="alert" key={issue.path.join(".")}>
          {issue.message}
        </p>
      ))}
    </>
  );
}

export function BaselineChoice({
  baselines,
  baselineId,
  after,
  editing,
  model,
  changed,
  onChoose,
  onPage,
}: {
  baselines: import("../use-projection.ts").Projection<"/api/baselines">;
  baselineId: string;
  after: string | undefined;
  editing: Editing;
  model: ResolvedApplicationModel | undefined;
  changed(): void;
  onChoose(id: string): void;
  onPage(after: string | undefined): void;
}) {
  return (
    <>
      {" "}
      {baselines.failed && (
        <p role="alert">Baselines could not be read. Refresh assessments before opening.</p>
      )}
      <label>
        Baseline
        <select
          required
          aria-label="Assessment baseline"
          value={baselineId}
          onChange={(e) => onChoose(e.target.value)}
        >
          <option value="">Choose a recorded baseline</option>
          {baselines.retained?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · r{item.projectRevision}
            </option>
          ))}
        </select>
      </label>
      {baselines.retained?.nextAfter && (
        <button
          type="button"
          disabled={!baselines.ready}
          onClick={() => {
            onPage(baselines.retained?.nextAfter);
          }}
        >
          More baselines
        </button>
      )}
      {after && (
        <button
          type="button"
          onClick={() => {
            onPage(undefined);
          }}
        >
          First baselines
        </button>
      )}
      {baselines.ready && !baselines.retained?.items.length && (
        <CaptureBaseline editing={editing} context={model?.context} changed={changed} />
      )}
    </>
  );
}

export function TraversalChoice({
  availableTypes,
  direction,
  types,
  depth,
  setDirection,
  setTypes,
  setDepth,
}: {
  availableTypes: string[];
  direction: "outgoing" | "incoming" | "both";
  types: string[];
  depth: number;
  setDirection(value: "outgoing" | "incoming" | "both"): void;
  setTypes(value: string[]): void;
  setDepth(value: number): void;
}) {
  return (
    <>
      {" "}
      <label>
        Direction
        <select
          aria-label="Assessment direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as typeof direction)}
        >
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
          <option value="both">Both directions</option>
        </select>
      </label>
      <label>
        Relationship kinds
        <select
          multiple
          aria-label="Assessment relationship kinds"
          value={types}
          onChange={(e) => setTypes(Array.from(e.target.selectedOptions, (item) => item.value))}
        >
          {availableTypes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p>
        {types.length
          ? `Follow ${types.join(", ")} within the selected depth.`
          : "No relationship kinds selected: assess only the changed record and its declared captured uses."}
      </p>
      <label>
        Depth
        <input
          aria-label="Assessment depth"
          type="number"
          min={1}
          max={6}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
        />
      </label>
    </>
  );
}
