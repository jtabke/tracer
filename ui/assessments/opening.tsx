import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type {
  ApplicationModelPin,
  ResolvedApplicationModel,
} from "../../src/core/application-model.ts";
import type { OpenChangeAssessment } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { fieldsFrom } from "../fields.tsx";
import { useProjection } from "../use-projection.ts";
import {
  AdditionalFields,
  RecordChoice,
  useAssessmentDirty,
  type modelChoices,
} from "./choices.tsx";

type OpeningProps = {
  models: ReturnType<typeof modelChoices>;
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  changed(): void;
  onOpened(id: string): void;
  onDirty(value: boolean): void;
};
export function AssessmentOpening(props: OpeningProps) {
  const { models, entities, schema, editing, changed } = props;
  const {
    modelKey,
    setModelKey,
    setPin,
    prepared,
    setPrepared,
    title,
    setTitle,
    purpose,
    setPurpose,
    rootId,
    setRootId,
    baselineId,
    setBaselineId,
    direction,
    setDirection,
    types,
    setTypes,
    depth,
    setDepth,
    extra,
    setExtra,
    after,
    setAfter,
    model,
    baselines,
    stale,
    blocked,
    open,
  } = useOpening(props);
  return (
    <form
      aria-label="Open change assessment"
      onSubmit={(event) => {
        event.preventDefault();
        void open();
      }}
    >
      <h3>New assessment</h3>
      {!models.length && (
        <p role="status">
          No application-model definitions are available. Install a change-assessment model through
          the documented application-model setup, then refresh the project.
        </p>
      )}
      <fieldset disabled={editing.busy}>
        <ModelChoice
          models={models}
          modelKey={modelKey}
          model={model}
          onChoose={(key) => {
            setModelKey(key);
            setPin(models.find((item) => item.name === key)?.pin);
            setPrepared(undefined);
            setExtra({});
          }}
        />
        <label>
          Assessment title
          <input
            aria-label="Assessment title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Purpose
          <textarea
            aria-label="Assessment purpose"
            required
            maxLength={4000}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <RecordChoice
          name="Changed record"
          required
          entities={entities}
          value={rootId}
          onChange={setRootId}
        />
        <BaselineChoice
          baselines={baselines}
          baselineId={baselineId}
          after={after}
          editing={editing}
          model={model.data}
          changed={changed}
          onChoose={setBaselineId}
          onPage={(cursor) => {
            setBaselineId("");
            setAfter(cursor);
          }}
        />
        <TraversalChoice
          schema={schema}
          direction={direction}
          types={types}
          depth={depth}
          setDirection={setDirection}
          setTypes={setTypes}
          setDepth={setDepth}
        />
        <AdditionalFields
          definitions={model.data?.requiredFields.assessment ?? null}
          values={extra}
          onChange={setExtra}
        />
      </fieldset>
      {prepared && stale && (
        <p role="alert">
          The preparation context changed. Your draft is retained; explicitly adopt current context
          before opening.
        </p>
      )}
      <button
        type="button"
        disabled={editing.busy || !model.ready || !model.data?.compatibility.writable}
        onClick={() => setPrepared(model.data)}
      >
        {prepared ? "Adopt refreshed scope context" : "Prepare assessment"}
      </button>
      <p>
        Opening records this selected traversal, with up to 25 candidates. It does not establish
        technical impact or complete any judgment.
      </p>
      <button type="submit" disabled={blocked}>
        Open assessment
      </button>
    </form>
  );
}
type OpeningDraft = {
  modelKey: string;
  pin: ApplicationModelPin | undefined;
  prepared: ResolvedApplicationModel | undefined;
  title: string;
  purpose: string;
  rootId: string;
  baselineId: string;
  direction: "outgoing" | "incoming" | "both";
  types: string[];
  depth: number;
  extra: Record<string, string>;
  after: string | undefined;
  identity: { assessmentId: string; commandId: string };
};
function useOpening({ editing, onOpened, onDirty }: OpeningProps) {
  const [draft, setDraft] = useState<OpeningDraft>(() => ({
    modelKey: "",
    pin: undefined,
    prepared: undefined,
    title: "",
    purpose: "",
    rootId: "",
    baselineId: "",
    direction: "outgoing",
    types: [],
    depth: 1,
    extra: {},
    after: undefined,
    identity: { assessmentId: crypto.randomUUID(), commandId: crypto.randomUUID() },
  }));
  const {
    modelKey,
    pin,
    prepared,
    title,
    purpose,
    rootId,
    baselineId,
    direction,
    types,
    depth,
    extra,
    after,
    identity,
  } = draft;
  const set =
    <K extends keyof OpeningDraft>(key: K) =>
    (value: OpeningDraft[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));
  const model = useProjection("/api/application-model", pin, editing.epoch, editing.report);
  const baselines = useProjection(
    "/api/baselines",
    { limit: 25, after },
    editing.epoch,
    editing.report,
  );
  const { stale, blocked } = preparationState(
    prepared,
    model.data,
    model.ready,
    baselines.ready,
    editing.busy,
  );
  useAssessmentDirty([modelKey, title, purpose, rootId, baselineId].some(Boolean), onDirty);
  const open = () =>
    commitOpening(
      prepared,
      blocked,
      {
        ...identity,
        title,
        purpose,
        query: { baselineId, rootId, direction, relationshipTypes: types, depth },
        values: extra,
      },
      editing,
      onOpened,
    );
  return {
    modelKey,
    setModelKey: set("modelKey"),
    setPin: set("pin"),
    prepared,
    setPrepared: set("prepared"),
    title,
    setTitle: set("title"),
    purpose,
    setPurpose: set("purpose"),
    rootId,
    setRootId: set("rootId"),
    baselineId,
    setBaselineId: set("baselineId"),
    direction,
    setDirection: set("direction"),
    types,
    setTypes: set("types"),
    depth,
    setDepth: set("depth"),
    extra,
    setExtra: set("extra"),
    after,
    setAfter: set("after"),
    model,
    baselines,
    stale,
    blocked,
    open,
  };
}

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

function ModelChoice({
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

function BaselineChoice({
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

function TraversalChoice({
  schema,
  direction,
  types,
  depth,
  setDirection,
  setTypes,
  setDepth,
}: {
  schema: SchemaObject | null;
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
          {Object.keys(schema?.relationshipTypes ?? {}).map((name) => (
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

function preparationState(
  prepared: ResolvedApplicationModel | undefined,
  current: ResolvedApplicationModel | undefined,
  modelReady: boolean,
  baselinesReady: boolean,
  busy: boolean,
) {
  const stale = !prepared || JSON.stringify(prepared.context) !== JSON.stringify(current?.context);
  const blocked =
    busy || stale || !modelReady || !prepared?.compatibility.writable || !baselinesReady;
  return { stale, blocked };
}

async function commitOpening(
  prepared: ResolvedApplicationModel | undefined,
  blocked: boolean,
  draft: Pick<
    OpenChangeAssessment,
    "commandId" | "assessmentId" | "title" | "purpose" | "query"
  > & { values: Record<string, string> },
  editing: Editing,
  onOpened: (id: string) => void,
) {
  if (blocked || !prepared) return;
  try {
    const { values, ...input } = draft;
    const context = prepared.context;
    const request: OpenChangeAssessment = {
      ...input,
      model: prepared.pin,
      additionalFields: fieldsFrom(values, prepared.requiredFields.assessment ?? {}),
      expectedSchemaVersion: context.schemaVersion,
      expectedProjectRevision: context.projectRevision,
      expectedEvidenceRevision: context.evidenceRevision,
    };
    if (await editing.mutate("/api/change-assessments/open", request)) onOpened(draft.assessmentId);
  } catch (error) {
    editing.report(error);
  }
}
