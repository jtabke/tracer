import type { Entity } from "../../src/core/model.ts";
import type { AssessmentAction } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { AssessmentSupport } from "./support.tsx";

export function AssessmentActions({
  value,
  existingIds,
  allowWaiver,
  entities,
  editing,
  onChange,
  configurationId,
}: {
  configurationId?: string;
  value: AssessmentAction[];
  existingIds: string[];
  allowWaiver: boolean;
  entities: Entity[];
  editing: Editing;
  onChange(value: AssessmentAction[]): void;
}) {
  const patch = (index: number, change: Partial<AssessmentAction>) =>
    onChange(value.map((action, i) => (i === index ? { ...action, ...change } : action)));
  return (
    <section aria-label="Candidate actions">
      <h5>Actions · {value.length}</h5>
      {value.map((action, index) => (
        <fieldset key={action.id} aria-label={`Action ${index + 1}`}>
          <legend>Action {index + 1}</legend>
          <label>
            Kind
            <select
              aria-label={`Action ${index + 1} kind`}
              disabled={existingIds.includes(action.id)}
              value={action.kind}
              onChange={(e) => patch(index, { kind: e.target.value as AssessmentAction["kind"] })}
            >
              <option value="investigate">Investigate</option>
              <option value="revise">Revise</option>
              <option value="reverify">Reverify</option>
            </select>
          </label>
          <label>
            Action title
            <input
              aria-label={`Action ${index + 1} title`}
              maxLength={200}
              value={action.title}
              onChange={(e) => patch(index, { title: e.target.value })}
            />
          </label>
          <label>
            State
            <select
              aria-label={`Action ${index + 1} state`}
              value={action.state}
              onChange={(e) => patch(index, { state: e.target.value as AssessmentAction["state"] })}
            >
              <option value="open">Open</option>
              <option value="done">Done with evidence</option>
              {allowWaiver && <option value="waived">Waived under model policy</option>}
            </select>
          </label>
          <label>
            Resolution
            <textarea
              aria-label={`Action ${index + 1} resolution`}
              maxLength={4000}
              value={action.resolution}
              onChange={(e) => patch(index, { resolution: e.target.value })}
            />
          </label>
          <AssessmentSupport
            configurationId={configurationId}
            title={`Action ${index + 1} support`}
            value={action.support}
            entities={entities}
            editing={editing}
            onChange={(support) => patch(index, { support })}
          />
          {!existingIds.includes(action.id) && (
            <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              Remove unsaved action {index + 1}
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={value.length >= 5}
        onClick={() =>
          onChange([
            ...value,
            {
              id: crypto.randomUUID(),
              kind: "investigate",
              title: "",
              state: "open",
              resolution: "",
              support: [],
            },
          ])
        }
      >
        Add action
      </button>
      <p>
        Recorded actions keep their identity. Done requires known current or applicable target
        support. Pair reverification requires a genuine controlled conclusion for the exact after
        target and related engineering scope. The application validates these rules when saving.
      </p>
    </section>
  );
}
