import { useEffect, useEffectEvent, useRef } from "react";
import type { Configuration } from "../src/core/configuration.ts";
import type { ExternalIdentity, Observation } from "../src/core/evidence.ts";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import { NativeRevisionSelect } from "./native-revision-select.tsx";
import {
  ReceiptEntityChoice,
  ReceiptFieldScope,
  ReceiptStatement,
} from "./receipt-authoring-fields.tsx";
import type { InputDraft } from "./receipt-authoring-state.ts";
import {
  chooseInput,
  currentDrift,
  inputRevision,
  inputSnapshot,
} from "./receipt-authoring-state.ts";
import { ReceiptPathEditor } from "./receipt-path-editor.tsx";
import { useProjection } from "./use-projection.ts";

export function ReceiptInputEditor({
  input,
  index,
  active,
  entities,
  schema,
  external,
  observations,
  configuration,
  output,
  epoch,
  report,
  onChange,
  onRemove,
  canRemove,
  pinsAvailable,
}: {
  input: InputDraft;
  index: number;
  active: boolean;
  entities: Entity[];
  schema: SchemaObject | null;
  external: ExternalIdentity[];
  observations: Observation[];
  configuration?: Configuration;
  output?: Entity;
  epoch: number;
  report(error: unknown): void;
  onChange(patch: Partial<InputDraft>): void;
  onRemove(): void;
  canRemove: boolean;
  pinsAvailable: boolean;
}) {
  useExactInputPin(input, epoch, report, onChange);
  const snapshot = inputSnapshot(input);
  const choices = configuration ? configuration.members.map((pin) => pin.entity) : entities;
  return (
    <section
      className="receipt-input-editor"
      hidden={!active}
      aria-label={`Declared input ${index + 1}`}
    >
      <div className="receipt-input-heading">
        <h3>Input {index + 1}</h3>
        <button disabled={!canRemove} onClick={onRemove}>
          Remove input {index + 1}
        </button>
      </div>
      <ReceiptEntityChoice
        name="Input entity"
        entities={choices}
        chosen={input.chosen?.entity}
        onChoose={(entity) => onChange(chooseInput(input, entity, schema, external, configuration))}
      />
      <InputSelectionStatus input={input} epoch={epoch} />
      <InputCurrentAdoption
        input={input}
        entities={entities}
        schema={schema}
        external={external}
        onChange={onChange}
      />
      <InputRevisionChoice
        input={input}
        epoch={epoch}
        pinsAvailable={pinsAvailable}
        onChange={onChange}
      />
      {snapshot && (
        <ReceiptStatement
          chosen={snapshot}
          kind="Input"
          compact={input.fieldsMode === "selected"}
        />
      )}
      {snapshot && (
        <InputScope
          input={input}
          chosen={snapshot}
          observations={observations}
          configuration={configuration}
          onChange={onChange}
        />
      )}
      <InputDependency
        input={input}
        output={output}
        entities={entities}
        epoch={epoch}
        report={report}
        onChange={onChange}
      />
    </section>
  );
}
function InputSelectionStatus({ input, epoch }: { input: InputDraft; epoch: number }) {
  return (
    <>
      {input.notice && (
        <p className="receipt-reconciliation" role="status">
          {input.notice}
        </p>
      )}
      {input.needsSelection && (
        <p role="alert">
          This retained identity is not in the chosen basis. Choose a replacement before recording.
        </p>
      )}
      {input.mode === "history" && input.pinEpoch !== epoch && (
        <p role="status">
          Reading exact native pin; recording is paused until this revision and its schema are
          available.
        </p>
      )}
    </>
  );
}
function useExactInputPin(
  input: InputDraft,
  epoch: number,
  report: (error: unknown) => void,
  onChange: (patch: Partial<InputDraft>) => void,
) {
  const query =
    input.mode === "history" && input.chosen && input.revision
      ? { id: input.chosen.entity.id, version: input.revision }
      : undefined;
  const read = useProjection("/api/native-pin", query, epoch, report);
  const latest = useRef(onChange);
  latest.current = onChange;
  const syncPin = useEffectEvent(() => {
    if (query)
      latest.current({
        ...(read.ready ? { pin: read.data } : {}),
        pinEpoch: read.ready ? epoch : undefined,
      });
  });
  useEffect(() => {
    syncPin();
  }, [read.state, epoch, query?.id, query?.version]);
}
function InputCurrentAdoption({
  input,
  entities,
  schema,
  external,
  onChange,
}: {
  input: InputDraft;
  entities: Entity[];
  schema: SchemaObject | null;
  external: ExternalIdentity[];
  onChange(patch: Partial<InputDraft>): void;
}) {
  if (input.mode !== "current" || !input.chosen) return null;
  const drift = currentDrift(input.chosen, entities, schema);
  const ownership =
    input.external !== external.some((value) => value.id === input.chosen?.entity.id);
  if (!drift && !ownership) return null;
  const current = entities.find((entity) => entity.id === input.chosen?.entity.id);
  const adopt = () => {
    if (!current || !schema) return;
    const owner = external.some((value) => value.id === current.id);
    const fields = input.fields.filter((name) =>
      Object.hasOwn(schema.entityTypes[current.type].fields, name),
    );
    onChange({
      chosen: structuredClone({ entity: current, schema }),
      external: owner,
      needsSelection: false,
      fields: owner ? [] : fields,
      fieldsMode: owner ? "whole" : input.fieldsMode,
      observationId: owner === input.external ? input.observationId : "",
      notice:
        "Current input explicitly adopted. Compatible field scope and directed path are retained; incompatible choices were cleared.",
    });
  };
  return (
    <div className="receipt-drift" role="status">
      <p>{drift || "Input ownership changed; explicitly adopt the current mode."}</p>
      <button disabled={!current || !schema} onClick={adopt}>
        Use current input
      </button>
    </div>
  );
}
function InputRevisionChoice({
  input,
  epoch,
  pinsAvailable,
  onChange,
}: {
  input: InputDraft;
  epoch: number;
  pinsAvailable: boolean;
  onChange(patch: Partial<InputDraft>): void;
}) {
  if (input.mode === "configuration")
    return (
      <p>
        Configuration member · exact pinned v{input.pin?.entity.version}. Direct declaration; no
        live path. Native annotations and selected observed content are separate facets.
      </p>
    );
  if (input.external) return null;
  return (
    <NativeRevisionSelect
      key={input.chosen?.entity.id}
      entity={input.chosen?.entity}
      value={input.revision}
      showSelected={false}
      epoch={epoch}
      disabled={!pinsAvailable}
      onChange={(revision) => onChange(inputRevision(input, revision))}
    />
  );
}
function InputScope({
  input,
  chosen,
  observations,
  configuration,
  onChange,
}: {
  input: InputDraft;
  chosen: NonNullable<ReturnType<typeof inputSnapshot>>;
  observations: Observation[];
  configuration?: Configuration;
  onChange(patch: Partial<InputDraft>): void;
}) {
  if (input.mode === "configuration" && configuration?.capture)
    return (
      <ConfigurationInputScope
        input={input}
        chosen={chosen}
        configuration={configuration}
        onChange={onChange}
      />
    );
  if (input.mode !== "current" || !input.external)
    return <ReceiptFieldScope input={input} chosen={chosen} onChange={onChange} />;
  return (
    <label>
      Exact observation
      <select
        aria-label="Exact observation"
        value={input.observationId}
        onChange={(event) => onChange({ observationId: event.target.value })}
      >
        <option value="">Choose immutable observation</option>
        {observations
          .filter((value) => value.entityId === input.chosen?.entity.id)
          .map((value) => (
            <option key={value.id} value={value.id}>
              {value.at} · {value.availability} · {value.commit ?? value.hash ?? value.reason}
            </option>
          ))}
      </select>
    </label>
  );
}

function ConfigurationInputScope({
  input,
  chosen,
  configuration,
  onChange,
}: {
  input: InputDraft;
  chosen: NonNullable<ReturnType<typeof inputSnapshot>>;
  configuration: Configuration;
  onChange(patch: Partial<InputDraft>): void;
}) {
  const observation = configuration.capture!.content.find(
    (x) => x.entityId === chosen.entity.id,
  )?.observation;
  return (
    <section aria-label="Configuration input material">
      <label>
        Configuration input facet
        <select
          aria-label="Configuration input facet"
          value={input.facet ?? "native"}
          onChange={(e) =>
            onChange({
              facet: e.target.value as "native" | "content",
              fieldsMode: "whole",
              fields: [],
              observationId: e.target.value === "content" ? (observation?.id ?? "") : "",
            })
          }
        >
          <option value="native">Exact native annotations</option>
          <option value="content" disabled={!observation}>
            Exact selected observed content
          </option>
        </select>
      </label>
      {input.facet === "content" ? (
        <p>
          {observation?.availability} · {observation?.hash ?? "no hash"} · exact observation{" "}
          {observation?.id}. No latest source is substituted.
        </p>
      ) : (
        <ReceiptFieldScope input={input} chosen={chosen} onChange={onChange} />
      )}
    </section>
  );
}
function InputDependency({
  input,
  output,
  entities,
  epoch,
  report,
  onChange,
}: {
  input: InputDraft;
  output?: Entity;
  entities: Entity[];
  epoch: number;
  report(error: unknown): void;
  onChange(patch: Partial<InputDraft>): void;
}) {
  if (input.mode !== "current") return null;
  return (
    <>
      <div className="receipt-mode-controls" role="group" aria-label="Dependency mode">
        <label>
          <input
            type="radio"
            name={`dependency-${input.id}`}
            checked={input.dependency === "direct"}
            onChange={() =>
              onChange({
                dependency: "direct",
                hops: [],
                pathEpoch: undefined,
                pathValid: false,
                notice: "Live path cleared. This is a direct declared dependency.",
              })
            }
          />
          Direct dependency
        </label>
        <label>
          <input
            type="radio"
            name={`dependency-${input.id}`}
            checked={input.dependency === "recorded"}
            onChange={() =>
              onChange({ dependency: "recorded", hops: [], pathEpoch: undefined, pathValid: false })
            }
          />
          Recorded path
        </label>
      </div>
      {input.dependency === "recorded" && (
        <ReceiptPathEditor
          input={input}
          output={output}
          entities={entities}
          epoch={epoch}
          report={report}
          onChange={onChange}
        />
      )}
    </>
  );
}
