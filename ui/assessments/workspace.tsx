import type { ConfigurationHandoff } from "../configurations/handoff.ts";
import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type { Editing } from "../editing.ts";
import { label } from "../entity-label.ts";
import { useProjection } from "../use-projection.ts";
import { ApplicationTaskHeader, ApplicationRecovery } from "../application-task.tsx";
import { assessmentChoices, modelChoices, useAssessmentDirty } from "./choices.tsx";
import { AssessmentOpening } from "./opening.tsx";
import { AssessmentDetail } from "./detail.tsx";
import { AssessmentContext } from "./context.tsx";
import "./workspace.css";

export function AssessmentWorkspace({
  entities,
  schema,
  editing,
  active,
  changed,
  onDirty,
  intent,
  onVerify,
}: {
  intent?: ConfigurationHandoff;
  onVerify?(value: Omit<ConfigurationHandoff, "sequence">): void;
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  active: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [navigation, setNavigation] = useState<{
    selected: string;
    creating: boolean;
    key: number;
    openingPair?: ConfigurationHandoff;
    acceptedSequence: number;
  }>({ selected: "", creating: false, key: 0, acceptedSequence: 0 });
  const { selected, creating, key: newKey, openingPair, acceptedSequence } = navigation;
  const [dirty, setDirty] = useState(false),
    [epoch, setEpoch] = useState(0);
  const models = modelChoices(entities, schema),
    candidates = assessmentChoices(entities);
  useAssessmentDirty(dirty, onDirty);
  const navigate = (id: string, create: boolean, pair?: ConfigurationHandoff) => {
    if (editing.busy) return;
    if (dirty && !window.confirm("Discard this assessment draft to choose another assessment?"))
      return;
    setDirty(false);
    setNavigation((previous) => ({
      ...previous,
      selected: id,
      creating: create,
      key: previous.key + 1,
      openingPair: pair,
      acceptedSequence: pair?.sequence ?? previous.acceptedSequence,
    }));
  };
  const refresh = () => {
    setEpoch((value) => value + 1);
    changed();
  };
  return (
    <section className="scoped-assessments" aria-label="Scoped change assessments" hidden={!active}>
      <ApplicationTaskHeader
        title="Change assessments"
        description="Controlled change assessments: define scope, record candidate judgments and track follow-up actions. Evidence review compares individual captured results separately."
        createLabel="New assessment"
        refreshLabel="Refresh assessments"
        busy={editing.busy}
        create={() => navigate("", true)}
        refresh={refresh}
      />
      {active && <ApplicationRecovery report={editing.report} refresh={refresh} />}
      {intent && intent.sequence !== acceptedSequence && (
        <section aria-label="Incoming configuration investigation">
          <p>
            A compared pair is available. Your current assessment draft is retained until you
            explicitly start another assessment.
          </p>
          <AssessmentContext
            title="Compared scope"
            name="Incoming assessment context"
            sticky={false}
            query={{ ...intent.pair, rootId: intent.rootId }}
            entities={entities}
            epoch={editing.epoch}
            report={editing.report}
          />
          <button disabled={editing.busy} onClick={() => navigate("", true, intent)}>
            Start assessment for displayed pair
          </button>
        </section>
      )}
      <div className="assessment-layout">
        <AssessmentCatalogue
          candidates={candidates}
          selected={selected}
          busy={editing.busy}
          choose={(id) => navigate(id, false)}
        />
        <div className="assessment-main">
          {creating && (
            <AssessmentOpening
              key={newKey}
              pair={openingPair}
              entities={entities}
              schema={schema}
              models={models}
              editing={editing}
              onDirty={setDirty}
              changed={refresh}
              onOpened={(id) => {
                setDirty(false);
                setNavigation((previous) => ({ ...previous, creating: false, selected: id }));
                refresh();
              }}
            />
          )}
          {!creating && selected && (
            <LocatedAssessment
              onVerify={onVerify}
              selected={selected}
              entities={entities}
              editing={editing}
              epoch={epoch}
              onDirty={setDirty}
              changed={refresh}
            />
          )}
          {!creating && !selected && (
            <p>
              Select a recorded assessment or start one from a named baseline or exact configuration
              pair and explicit change scope.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LocatedAssessment({
  onVerify,
  selected,
  entities,
  editing,
  epoch,
  onDirty,
  changed,
}: {
  onVerify?(value: Omit<ConfigurationHandoff, "sequence">): void;
  selected: string;
  entities: Entity[];
  editing: Editing;
  epoch: number;
  onDirty(value: boolean): void;
  changed(): void;
}) {
  const located = useProjection(
    "/api/assessment-locate",
    selected ? { assessmentId: selected } : undefined,
    editing.epoch + epoch,
    editing.report,
  );
  return (
    <>
      {located.loading && <p role="status">Resolving the recorded assessment…</p>}
      {located.failed && (
        <p role="alert">
          The assessment could not be resolved. Its retained view is read only. Refresh to try
          again.
        </p>
      )}
      {located.retained && (
        <AssessmentDetail
          onVerify={onVerify}
          key={selected}
          view={located.retained}
          entities={entities}
          editing={editing}
          ready={located.ready}
          epoch={epoch}
          onDirty={onDirty}
          changed={changed}
        />
      )}
    </>
  );
}

function AssessmentCatalogue({
  candidates,
  selected,
  busy,
  choose,
}: {
  candidates: Entity[];
  selected: string;
  busy: boolean;
  choose(id: string): void;
}) {
  const [search, setSearch] = useState("");
  const matching = candidates.filter((entity) =>
    `${label(entity)} ${entity.fields.title ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const shown = matching.slice(0, 50);
  return (
    <nav aria-label="Assessment records">
      <h3>Recorded assessments</h3>
      <label>
        Find assessment
        <input
          aria-label="Find assessment"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {!matching.length && (
        <p>
          No assessment records match this search. Start a new assessment after selecting a
          configured application model.
        </p>
      )}
      {shown.map((entity) => (
        <button
          key={entity.id}
          aria-pressed={selected === entity.id}
          onClick={() => choose(entity.id)}
          disabled={busy}
        >
          {label(entity)}
        </button>
      ))}
      <small>
        {shown.length} shown · {matching.length} matching records in the current project snapshot.
        Opening validates controlled history; a stored status is not proof of completion.
      </small>
    </nav>
  );
}
