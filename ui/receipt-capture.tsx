import type { Configuration } from "../src/core/configuration.ts";
import type { ExternalIdentity, Observation, Receipt } from "../src/core/evidence.ts";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import {
  ConfigurationDetails,
  ConfigurationPaging,
  type useConfigurations,
} from "./configurations/native-capture.tsx";
import type { Save } from "./editing.ts";
import { label } from "./entity-label.ts";
import { ReceiptEntityChoice, ReceiptStatement } from "./receipt-authoring-fields.tsx";
import type { InputDraft } from "./receipt-authoring-state.ts";
import {
  currentDrift,
  inputProblem,
  inputSnapshot,
  receiptProposal,
  reconcileBasis,
  useReceiptDraft,
} from "./receipt-authoring-state.ts";
import "./receipt-authoring.css";
import { ReceiptInputEditor } from "./receipt-input-editor.tsx";

type CaptureProps = {
  entities: Entity[];
  schema: SchemaObject | null;
  epoch: number;
  report(error: unknown): void;
  external: ExternalIdentity[];
  observations: Observation[];
  receipts: Receipt[];
  busy: boolean;
  limited: boolean;
  heading: React.RefObject<HTMLLegendElement | null>;
  save: Save;
  catalog: ReturnType<typeof useConfigurations>;
};
export function ReceiptCapture(props: CaptureProps) {
  const draft = useReceiptDraft();
  const pinsAvailable = props.catalog.read.ready;
  const problems = draft.inputs.map((input) =>
    inputProblem(input, props.entities, props.schema, props.external, props.epoch, pinsAvailable),
  );
  const outputProblem = currentDrift(draft.output, props.entities, props.schema);
  const blocked = props.busy || props.limited || !props.schema;
  const invalid = !!outputProblem || !draft.outcome.trim() || problems.some(Boolean);
  const record = () => {
    if (blocked || invalid || !draft.output) return;
    void props.save(
      "/api/receipts",
      receiptProposal(
        draft.output,
        draft.outcome,
        draft.inputs,
        draft.configuration,
        draft.supersedes,
      ),
    );
  };
  const basis = (configuration?: Configuration) => {
    draft.setConfiguration(configuration);
    draft.setInputs((values) =>
      values.map((input) =>
        reconcileBasis(input, configuration, props.entities, props.schema, props.external),
      ),
    );
  };
  return (
    <fieldset className="receipt-authoring" disabled={blocked}>
      <legend ref={props.heading} tabIndex={-1} className="sr-only">
        Record an immutable evaluation receipt
      </legend>
      <div className="receipt-output-layout">
        <section className="receipt-output" aria-label="Evaluation output and outcome">
          <ReceiptEntityChoice
            name="Output or conclusion"
            entities={props.entities}
            chosen={draft.output?.entity}
            onChoose={(entity) => draft.chooseOutput(entity, props.schema)}
          />
          {draft.output && <ReceiptStatement chosen={draft.output} kind="Output" />}
          <OutputAdoption
            draft={draft}
            entities={props.entities}
            schema={props.schema}
            problem={outputProblem}
          />
          <label>
            Outcome
            <textarea
              aria-label="Outcome"
              value={draft.outcome}
              onChange={(event) => draft.setOutcome(event.target.value)}
              placeholder="Recorded result or conclusion and supporting rationale"
            />
          </label>
          <SupersedesChoice
            receipts={props.receipts}
            outputId={draft.output?.entity.id}
            value={draft.supersedes}
            onChange={draft.setSupersedes}
          />
        </section>
        <ConfigurationBasis catalog={props.catalog} value={draft.configuration} onChange={basis} />
        <section className="receipt-declarations" aria-label="Complete declared input drafts">
          <h3>Declared inputs · {draft.inputs.length}</h3>
          <InputDraftList
            inputs={draft.inputs}
            active={draft.active}
            problems={problems}
            onSelect={draft.setActive}
          />
          <button disabled={draft.inputs.length >= 100} onClick={draft.add}>
            Add declared input
          </button>
        </section>
      </div>
      <div className="receipt-input-editors">
        {draft.inputs.map((input, index) => (
          <ReceiptInputEditor
            key={input.id}
            input={input}
            index={index}
            active={draft.active === input.id}
            entities={props.entities}
            schema={props.schema}
            external={props.external}
            observations={props.observations}
            configuration={draft.configuration}
            output={draft.output?.entity}
            epoch={props.epoch}
            report={props.report}
            pinsAvailable={pinsAvailable}
            onChange={(patch) => draft.update(input.id, patch)}
            onRemove={() => draft.remove(input.id)}
            canRemove={draft.inputs.length > 1}
          />
        ))}
      </div>
      <div className="receipt-record-controls">
        <button disabled={invalid} onClick={record}>
          Record receipt
        </button>
        {invalid && (
          <small>
            Resolve the output, outcome and declared-input states above before recording.
          </small>
        )}
      </div>
    </fieldset>
  );
}
function OutputAdoption({
  draft,
  entities,
  schema,
  problem,
}: {
  draft: ReturnType<typeof useReceiptDraft>;
  entities: Entity[];
  schema: SchemaObject | null;
  problem: string;
}) {
  if (!draft.output || !problem) return null;
  const current = entities.find((entity) => entity.id === draft.output?.entity.id);
  return (
    <div className="receipt-drift" role="status">
      <p>{problem}</p>
      <button
        disabled={!current || !schema}
        onClick={() => {
          if (current && schema) draft.adoptOutput(current, schema);
        }}
      >
        Use current output
      </button>
    </div>
  );
}
function SupersedesChoice({
  receipts,
  outputId,
  value,
  onChange,
}: {
  receipts: Receipt[];
  outputId?: string;
  value: string;
  onChange(value: string): void;
}) {
  const matching = receipts.filter((receipt) => receipt.output.id === outputId);
  if (!matching.length && !value) return null;
  return (
    <label>
      Supersedes (optional)
      <select
        aria-label="Supersedes (optional)"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">None</option>
        {matching.map((receipt) => (
          <option key={receipt.id} value={receipt.id}>
            {receipt.outcome} · {receipt.at.slice(0, 10)} · {receipt.id.slice(0, 8)}
          </option>
        ))}
      </select>
    </label>
  );
}
function InputDraftList({
  inputs,
  active,
  problems,
  onSelect,
}: {
  inputs: InputDraft[];
  active: string;
  problems: string[];
  onSelect(id: string): void;
}) {
  return (
    <ol className="receipt-input-draft-list">
      {inputs.map((input, index) => {
        const snapshot = inputSnapshot(input);
        const name = snapshot
          ? label(snapshot.entity)
          : input.chosen
            ? label(input.chosen.entity)
            : "Choose input";
        return (
          <li key={input.id}>
            <button
              aria-label={`Edit input ${index + 1}: ${name}`}
              aria-pressed={active === input.id}
              onClick={() => onSelect(input.id)}
            >
              <strong>
                {index + 1}. {name}
              </strong>
              <span>
                {snapshot
                  ? `${input.mode === "current" ? "Captured" : "Pinned"} v${snapshot.entity.version}`
                  : "Selection pending"}{" "}
                · {input.fieldsMode === "whole" ? "Whole item" : `${input.fields.length} fields`} ·{" "}
                {input.dependency === "direct" ? "Direct" : `${input.hops.length} path steps`}
              </span>
              <small>{problems[index] || "Ready to declare"}</small>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
function ConfigurationBasis({
  catalog,
  value,
  onChange,
}: {
  catalog: ReturnType<typeof useConfigurations>;
  value?: Configuration;
  onChange(value?: Configuration): void;
}) {
  if (!configurationBasisVisible(catalog, value)) return null;
  return (
    <section className="receipt-configuration-basis" aria-label="Input configuration basis">
      <label>
        Configuration basis (optional)
        <select
          aria-label="Configuration basis (optional)"
          value={value?.id ?? ""}
          onChange={(event) =>
            onChange(catalog.read.data?.items.find((item) => item.id === event.target.value))
          }
        >
          <option value="">Individually declared inputs</option>
          <ConfigurationBasisOptions items={catalog.read.data?.items ?? []} selected={value} />
        </select>
      </label>
      <ConfigurationPaging catalog={catalog} />
      {value && (
        <>
          <p>
            Only declared inputs are evaluated; this captured set has {value.members.length}{" "}
            available members.
          </p>
          <details>
            <summary>Inspect selected configuration</summary>
            <ConfigurationDetails value={value} />
          </details>
        </>
      )}
    </section>
  );
}
function configurationBasisVisible(
  catalog: ReturnType<typeof useConfigurations>,
  selected?: Configuration,
) {
  if (selected || catalog.cursor.hasPrevious) return true;
  if (!catalog.read.ready) return true;
  return !!catalog.read.data?.items.length;
}
function ConfigurationBasisOptions({
  items,
  selected,
}: {
  items: Configuration[];
  selected?: Configuration;
}) {
  return (
    <>
      {selected && !items.some((item) => item.id === selected.id) && (
        <option value={selected.id}>{selected.name} · retained selection</option>
      )}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} · {item.at.slice(0, 10)} · {item.id.slice(0, 8)}
        </option>
      ))}
    </>
  );
}
