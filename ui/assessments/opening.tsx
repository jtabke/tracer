import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type {
  ApplicationModelPin,
  ResolvedApplicationModel,
} from "../../src/core/application-model.ts";
import { canonical } from "../../src/core/evidence.ts";
import type { ConfigurationHandoff } from "../configuration-handoff.ts";
import type { AssessmentScopeQuery } from "../../src/core/change-assessment.ts";
import {
  AssessmentPairChoice,
  useAssessmentSource,
  assessmentRootChoices,
  assessmentRelationshipChoices,
} from "./opening-source.tsx";
import type { AssessmentSourceDraft } from "./opening-source.tsx";
import type { OpenChangeAssessment } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { ModelChoice, BaselineChoice, TraversalChoice } from "./opening-fields.tsx";
import { useRecoveredApplication } from "../use-application-outcome.ts";
import { fieldsFrom } from "../fields.tsx";
import { useProjection } from "../use-projection.ts";
import {
  AdditionalFields,
  RecordChoice,
  useAssessmentDirty,
  type modelChoices,
} from "./choices.tsx";

type OpeningProps = {
  pair?: ConfigurationHandoff;
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
    sourceState,
    setSource,
    sourceRead,
    prepare,
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
          entities={assessmentRootChoices(entities, sourceRead.comparison.retained)}
          value={rootId}
          onChange={setRootId}
        />
        <label>
          Investigation source
          <select
            aria-label="Assessment investigation source"
            value={sourceState.source}
            onChange={(e) =>
              setSource({ source: e.target.value as AssessmentSourceDraft["source"] })
            }
          >
            <option value="baseline">Baseline compared with current state</option>
            <option value="configuration_pair">Exact configuration pair</option>
          </select>
        </label>
        {sourceState.source === "configuration_pair" ? (
          <AssessmentPairChoice
            value={sourceState}
            comparison={sourceRead.comparison.retained}
            editing={editing}
            onChange={setSource}
          />
        ) : (
          <>
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
          </>
        )}
        {sourceRead.comparison.failed && (
          <p role="alert">
            The selected pair could not be read. Draft scope is retained; preparation and opening
            are paused.
          </p>
        )}
        <TraversalChoice
          availableTypes={assessmentRelationshipChoices(schema, sourceRead.comparison.retained)}
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
        disabled={
          editing.busy || !model.ready || !model.data?.compatibility.writable || !sourceRead.ready
        }
        onClick={prepare}
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
type OpeningPreparation = { model: ResolvedApplicationModel; query: AssessmentScopeQuery };
type OpeningDraft = AssessmentSourceDraft & {
  modelKey: string;
  pin: ApplicationModelPin | undefined;
  prepared: OpeningPreparation | undefined;
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
function useOpening({ editing, onOpened, onDirty, pair }: OpeningProps) {
  const [attempt, setAttempt] = useState<string>();
  const [draft, setDraft] = useState<OpeningDraft>(() => ({
    modelKey: "",
    pin: undefined,
    prepared: undefined,
    title: "",
    purpose: "",
    rootId: pair?.rootId ?? "",
    source: pair ? "configuration_pair" : "baseline",
    beforeId: pair?.pair.beforeId ?? "",
    afterId: pair?.pair.afterId ?? "",
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
  const query = openingQuery(draft);
  const sourceRead = useAssessmentSource(query, after, editing);
  const baselines = sourceRead.baselines;
  const { stale, blocked } = preparationState(
    prepared,
    model.data,
    model.ready,
    sourceRead.ready,
    editing.busy,
    query,
  );
  useAssessmentDirty(
    [modelKey, title, purpose, rootId, baselineId, draft.beforeId, draft.afterId].some(Boolean),
    onDirty,
  );
  const setSource = (patch: Partial<AssessmentSourceDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const prepare = () => {
    if (model.ready && model.data && sourceRead.ready)
      set("prepared")(structuredClone({ model: model.data, query }));
  };
  useRecoveredApplication(attempt, identity.assessmentId, editing, 0, () =>
    onOpened(identity.assessmentId),
  );
  const open = () =>
    commitOpening(
      prepared,
      blocked,
      {
        ...identity,
        title,
        purpose,
        values: extra,
      },
      editing,
      onOpened,
      setAttempt,
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
    sourceState: draft,
    setSource,
    sourceRead,
    prepare,
    stale,
    blocked,
    open,
  };
}

function preparationState(
  prepared: OpeningPreparation | undefined,
  current: ResolvedApplicationModel | undefined,
  modelReady: boolean,
  baselinesReady: boolean,
  busy: boolean,
  query: AssessmentScopeQuery,
) {
  const stale =
    !prepared ||
    canonical(prepared.model.context) !== canonical(current?.context) ||
    canonical(prepared.query) !== canonical(query);
  const blocked =
    busy || stale || !modelReady || !prepared?.model.compatibility.writable || !baselinesReady;
  return { stale, blocked };
}

async function commitOpening(
  prepared: OpeningPreparation | undefined,
  blocked: boolean,
  draft: Pick<OpenChangeAssessment, "commandId" | "assessmentId" | "title" | "purpose"> & {
    values: Record<string, string>;
  },
  editing: Editing,
  onOpened: (id: string) => void,
  onAttempt: (id: string) => void,
) {
  if (blocked || !prepared) return;
  try {
    const { values, ...input } = draft;
    const context = prepared.model.context;
    const request: OpenChangeAssessment = {
      ...input,
      model: prepared.model.pin,
      query: prepared.query,
      additionalFields: fieldsFrom(values, prepared.model.requiredFields.assessment ?? {}),
      expectedSchemaVersion: context.schemaVersion,
      expectedProjectRevision: context.projectRevision,
      expectedEvidenceRevision: context.evidenceRevision,
    };
    onAttempt(request.commandId);
    if (await editing.mutate("/api/change-assessments/open", request)) onOpened(draft.assessmentId);
  } catch (error) {
    editing.report(error);
  }
}

function openingQuery(draft: OpeningDraft): AssessmentScopeQuery {
  const traversal = {
    rootId: draft.rootId,
    direction: draft.direction,
    relationshipTypes: draft.types,
    depth: draft.depth,
  };
  return draft.source === "configuration_pair"
    ? {
        ...traversal,
        source: "configuration_pair",
        beforeId: draft.beforeId,
        afterId: draft.afterId,
        policy: "scoped-reference-dependencies-v1",
      }
    : { ...traversal, baselineId: draft.baselineId };
}
