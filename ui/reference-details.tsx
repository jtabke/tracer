import { useState, useEffect, useEffectEvent } from "react";
import type { Entity, Relationship } from "../src/core/model.ts";
import type { Editing } from "./editing.ts";
import type { ReadResponse } from "../src/interfaces/api-contract.ts";
import { useProjection } from "./use-projection.ts";
export function ReferenceDetails({
  link,
  editing,
  onEdit,
  onChanged,
  onDirty,
}: {
  link: Relationship;
  editing: Editing;
  onEdit(value: ReadResponse<"/api/reference">): void;
  onChanged(): void;
  onDirty(id: string, value: boolean): void;
}) {
  const context = useProjection("/api/reference", { id: link.id }, editing.epoch, editing.report);
  const [path, setPath] = useState("");
  const notify = useEffectEvent((value: boolean) => onDirty(link.id, value));
  useEffect(() => {
    notify(Boolean(path));
    return () => notify(false);
  }, [path]);
  const data = context.data;
  async function observe() {
    if (!data) return;
    const result = await editing.mutate("/api/observations", {
      entityId: data.resource.id,
      locator: { system: "file", path: path || data.latestObservation?.locator.path || "" },
    });
    if (result) {
      setPath("");
      onChanged();
    }
  }
  return (
    <section aria-label={`Reference ${link.id}`}>
      <h3>{data?.resource.resource?.label ?? "Resource"}</h3>
      <p>
        {link.reference?.role} · {link.reference?.explanation}
      </p>
      <p>{link.reference?.selector && JSON.stringify(link.reference.selector)}</p>
      {data && (
        <>
          <p>
            {link.reference?.state.mode === "pinned" ? "Pinned state" : "Latest observed state"} ·{" "}
            {data.availability} · {data.contentRetention}
          </p>
          <p>
            Selected:{" "}
            {data.selectedObservation?.hash ??
              (data.resource.resource?.source
                ? "no observed content"
                : `native v${data.nativeVersion}`)}{" "}
            · Source drift: {data.sourceChanged === null ? "unknown" : String(data.sourceChanged)} ·
            Passage: {data.passage}
          </p>
          <p>
            Observed {data.latestObservation?.at ?? "never"}. Original evaluation outcomes are
            unchanged by source drift.
          </p>
        </>
      )}
      <fieldset disabled={editing.busy || !context.ready}>
        <label>
          Local file path
          <input
            value={path}
            placeholder={data?.latestObservation?.locator.path}
            onChange={(e) => setPath(e.target.value)}
          />
        </label>
        <button type="button" onClick={() => void observe()}>
          Observe file
        </button>
        <button type="button" onClick={() => data && onEdit(data)}>
          Edit reference
        </button>
      </fieldset>
    </section>
  );
}
export function ReferenceEvaluation(props: {
  source: Entity;
  link: Relationship;
  data: ReadResponse<"/api/reference">;
  entities: Entity[];
  editing: Editing;
  onSaved(id: string): void;
  onDirty(value: boolean): void;
}) {
  const { editing, onSaved, onDirty } = props;
  const [base] = useState(() => ({
    source: props.source,
    link: props.link,
    data: props.data,
    entities: props.entities,
  }));
  const { source, link, data, entities } = base;
  const [outcome, setOutcome] = useState("");
  const [output, setOutput] = useState(source.id);
  const [additional, setAdditional] = useState<string[]>([]);
  const dirty = Boolean(outcome) || additional.length > 0 || output !== source.id;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  async function record() {
    const observation = data.selectedObservation;
    const result = await editing.mutate("/api/receipts", {
      outputId: output,
      expectedOutputVersion: entities.find((e) => e.id === output)!.version,
      outcome,
      inputs: [
        { entityId: source.id, expectedVersion: source.version, role: "reference subject" },
        ...(data.resource.resource?.source
          ? [
              {
                entityId: data.resource.id,
                observationId: observation!.id,
                role: link.reference!.role,
              },
            ]
          : [
              {
                entityId: data.resource.id,
                revision: data.nativeVersion,
                role: link.reference!.role,
              },
            ]),
        ...additional
          .filter((id) => id !== source.id && id !== data.resource.id)
          .map((id) => ({
            entityId: id,
            expectedVersion: entities.find((e) => e.id === id)!.version,
            role: "additional declared input",
          })),
      ],
      relationshipInputs: [
        { id: link.id, expectedVersion: link.version, role: "declared reference" },
      ],
    });
    if (result) {
      setOutcome("");
      setAdditional([]);
      setOutput(source.id);
      onSaved(result.id);
    }
  }
  return (
    <section>
      <h3>Record evaluation using this reference</h3>
      <p>
        Captures the subject, selected content state and exact reference. Include the actual
        product, check and conditions when making a verification claim.
      </p>
      <p>
        Input state: {data.selectedObservation?.hash ?? `native v${data.nativeVersion}`} · reference
        v{link.version}
      </p>
      <fieldset disabled={editing.busy}>
        <label>
          Evaluation output
          <select
            aria-label="Evaluation output"
            value={output}
            onChange={(e) => setOutput(e.target.value)}
          >
            <RecordOptions entities={entities} />
          </select>
        </label>
        <label>
          Other used records (product, check, conditions)
          <select
            aria-label="Other used records (product, check, conditions)"
            multiple
            value={additional}
            onChange={(e) => setAdditional([...e.target.selectedOptions].map((o) => o.value))}
          >
            <RecordOptions
              entities={entities.filter((e) => e.id !== source.id && !e.resource?.source)}
            />
          </select>
        </label>
        <label>
          Outcome and conditions
          <textarea required value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={
            !outcome.trim() ||
            (Boolean(data.resource.resource?.source) &&
              data.selectedObservation?.availability !== "available")
          }
          onClick={() => void record()}
        >
          Record evaluation
        </button>
      </fieldset>
    </section>
  );
}

function RecordOptions({ entities }: { entities: Entity[] }) {
  return (
    <>
      {entities.map((e) => (
        <option key={e.id} value={e.id}>
          {e.key ?? e.resource?.label ?? String(e.fields.title ?? e.id)}
        </option>
      ))}
    </>
  );
}
