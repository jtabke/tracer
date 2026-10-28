import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type { Editing } from "../editing.ts";
import { label } from "../entity-label.ts";
import { useProjection } from "../use-projection.ts";
import { ApplicationTaskHeader, ApplicationRecovery } from "../application-task.tsx";
import { assessmentChoices, modelChoices, useAssessmentDirty } from "./choices.tsx";
import { AssessmentOpening } from "./opening.tsx";
import { AssessmentDetail } from "./detail.tsx";
import "./workspace.css";

export function AssessmentWorkspace({
  entities,
  schema,
  editing,
  active,
  changed,
  onDirty,
}: {
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  active: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const models = modelChoices(entities, schema),
    candidates = assessmentChoices(entities);
  useAssessmentDirty(dirty, onDirty);
  const navigate = (id: string, create: boolean) => {
    if (editing.busy) return;
    if (dirty && !window.confirm("Discard this assessment draft to choose another assessment?"))
      return;
    setDirty(false);
    setSelected(id);
    setCreating(create);
    setNewKey((value) => value + 1);
  };
  const refresh = () => {
    setEpoch((value) => value + 1);
    changed();
  };
  return (
    <section className="scoped-assessments" aria-label="Scoped change assessments" hidden={!active}>
      <ApplicationTaskHeader
        title="Change assessments"
        description="Keep the selected scope, candidate judgments and unfinished actions together."
        createLabel="New assessment"
        refreshLabel="Refresh assessments"
        busy={editing.busy}
        create={() => navigate("", true)}
        refresh={refresh}
      />
      <ApplicationRecovery report={editing.report} refresh={refresh} />
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
              entities={entities}
              schema={schema}
              models={models}
              editing={editing}
              onDirty={setDirty}
              changed={refresh}
              onOpened={(id) => {
                setDirty(false);
                setCreating(false);
                setSelected(id);
                refresh();
              }}
            />
          )}
          {!creating && selected && (
            <LocatedAssessment
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
              Select a recorded assessment or start one from a named baseline and explicit change
              scope.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LocatedAssessment({
  selected,
  entities,
  editing,
  epoch,
  onDirty,
  changed,
}: {
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
