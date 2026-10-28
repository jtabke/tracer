import { useState } from "react";
import type { Entity, Relationship } from "../../src/core/model.ts";
import type { PrepareVerificationBasis } from "../../src/core/verification-basis.ts";
import type { ResolvedVerificationModel } from "../../src/core/verification-model.ts";
type Criteria = PrepareVerificationBasis["criteria"];
export type BasisCapture = {
  model: ResolvedVerificationModel;
  requirement: Entity;
  methods: Entity[];
  links: Relationship[];
};
export function CriterionSource({
  capture,
  criteria,
  onChange,
}: {
  capture: BasisCapture;
  criteria: Criteria;
  onChange(value: Criteria): void;
}) {
  const [field, setField] = useState(capture.model.definition.requirement.fields.acceptance[0]),
    [range, setRange] = useState<{ start: number; end: number }>();
  const text = String(capture.requirement.fields[field] ?? "");
  function add(start: number, end: number) {
    if (start === end || criteria.length >= 25) return;
    let n = 1;
    while (criteria.some((x) => x.id === `criterion-${n}`)) n++;
    onChange([
      ...criteria,
      { id: `criterion-${n}`, field, start, end, quote: text.slice(start, end) },
    ]);
    setRange(undefined);
  }
  return (
    <section aria-label="Acceptance criterion scope">
      <h4>Choose the acceptance to verify</h4>
      <p>
        Each criterion is an explicit verification unit. Highlight a clause or deliberately use the
        entire field. Complete scope must cover all acceptance text.
      </p>
      <label>
        Acceptance field
        <select
          aria-label="Acceptance field"
          value={field}
          onChange={(e) => {
            setField(e.target.value);
            setRange(undefined);
          }}
        >
          {capture.model.definition.requirement.fields.acceptance.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <textarea
        aria-label="Acceptance source"
        readOnly
        value={text}
        onSelect={(e) =>
          setRange({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })
        }
      />
      <button
        type="button"
        disabled={!range || range.start === range.end}
        onClick={() => range && add(range.start, range.end)}
      >
        Add highlighted criterion
      </button>
      <button
        type="button"
        disabled={!text || criteria.length >= 25}
        onClick={() => add(0, text.length)}
      >
        Use entire acceptance field
      </button>
      <ol>
        {criteria.map((c, i) => (
          <li key={i}>
            <label>
              Criterion identity
              <input
                aria-label={`Criterion ${i + 1} identity`}
                required
                value={c.id}
                onChange={(e) =>
                  onChange(criteria.map((x, n) => (n === i ? { ...x, id: e.target.value } : x)))
                }
              />
            </label>
            <blockquote>{c.quote}</blockquote>
            <small>
              {c.field} · characters {c.start}–{c.end}
            </small>
            <button type="button" onClick={() => onChange(criteria.filter((_, n) => n !== i))}>
              Remove criterion {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function MethodAssignments({
  capture,
  criteria,
  assignments,
  onChange,
}: {
  capture: BasisCapture;
  criteria: Criteria;
  assignments: Record<string, string[]>;
  onChange(value: Record<string, string[]>): void;
}) {
  return (
    <section aria-label="Verification methods">
      <h4>Assign methods</h4>
      <p>
        Select every method obligation that applies to each criterion. A linked plan is planned
        coverage; recording an activity comes later.
      </p>
      {!capture.links.length && (
        <p>
          No configured requirement-to-method connections were found. Connect an appropriate method
          in the project model, then refresh and prepare again.
        </p>
      )}
      {capture.links.map((link) => {
        const method = capture.methods.find((x) => x.id === link.target);
        if (!method) return null;
        const fields = capture.model.definition.method.fields;
        return (
          <fieldset key={link.id}>
            <legend>
              {String(method.fields[fields.title])} · v{method.version}
            </legend>
            <p>{String(method.fields[fields.procedure])}</p>
            <p>Expected: {String(method.fields[fields.expected])}</p>
            {criteria.map((c, i) => (
              <label key={i}>
                <span>
                  <input
                    type="checkbox"
                    aria-label={`Assign ${c.id} to ${String(method.fields[fields.title])}`}
                    checked={(assignments[link.id] ?? []).includes(c.id)}
                    onChange={(e) =>
                      onChange({
                        ...assignments,
                        [link.id]: e.target.checked
                          ? [...(assignments[link.id] ?? []), c.id]
                          : (assignments[link.id] ?? []).filter((x) => x !== c.id),
                      })
                    }
                  />
                  {c.id}
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </section>
  );
}
