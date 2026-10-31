import { label } from "../entity-label.ts";
import { useReferenceDrafts } from "./use-drafts.ts";
import "./workspace.css";
import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type { ReadResponse } from "../../src/interfaces/api-contract.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import { ReferenceEditor } from "./editor.tsx";
import { ReferenceDetails, ReferenceEvaluation } from "./details.tsx";
const ignoreDirty = () => {};
export function ReferenceWorkspace({
  entity,
  schema,
  editing,
  onChanged,
  onDirty = ignoreDirty,
}: {
  entity?: Entity;
  schema: SchemaObject;
  editing: Editing;
  onChanged(): void;
  onDirty?(value: boolean): void;
}) {
  const drafts = useReferenceDrafts(onDirty);
  const snapshot = useProjection("/api/project-snapshot", {}, editing.epoch, editing.report);
  const [selected, setSelected] = useState<ReadResponse<"/api/reference">>();
  const [generation, setGeneration] = useState(0);
  const [notice, setNotice] = useState("");
  const loaded = snapshot.data ?? snapshot.retained;
  const active = loaded?.entities.find((e) => e.id === entity?.id);
  const guarded = { ...editing, busy: editing.busy || !snapshot.ready || !active };
  if (!entity) return <p>Select a record to inspect its references.</p>;
  if (!loaded) return <p>Loading current reference context…</p>;
  const source = active ?? entity;
  const resources = loaded!.entities.filter((e) => e.resource);
  const refs = loaded!.relationships.filter((r) => r.source === source.id && r.reference);
  const saved = () => {
    setSelected(undefined);
    setGeneration((v) => v + 1);
    setNotice("Reference saved.");
    onChanged();
  };
  return (
    <section className="reference-workspace" aria-label="Record references">
      <h2>References · {label(source)}</h2>
      {notice && <p role="status">{notice}</p>}
      {!active && (
        <p role="alert">
          The reference subject is unavailable. Your draft is retained; saving is disabled.
        </p>
      )}
      {refs.map((link) => (
        <ReferenceDetails
          key={`${link.id}:${generation}`}
          link={link}
          editing={guarded}
          onChanged={onChanged}
          onDirty={drafts.path}
          onEdit={(value) => {
            if (drafts.dirty && !window.confirm("Discard unsaved reference information?")) return;
            setGeneration((n) => n + 1);
            setSelected(value);
          }}
        />
      ))}
      <ReferenceEditor
        key={`${source.id}:${generation}:${selected?.relationship.id ?? "new"}`}
        context={{
          source,
          schema,
          resources,
          link: selected?.relationship,
          observation: selected?.latestObservation,
        }}
        editing={guarded}
        onSaved={saved}
        onDirty={drafts.editor}
      />
      {selected && (
        <>
          <button
            type="button"
            onClick={() => {
              setSelected(undefined);
              setGeneration((v) => v + 1);
            }}
          >
            Cancel reference edit
          </button>
          <ReferenceEvaluation
            key={`${selected.relationship.id}:${generation}`}
            source={source}
            link={selected.relationship}
            data={selected}
            entities={loaded!.entities}
            editing={guarded}
            onDirty={drafts.evaluation}
            onSaved={(id) => {
              setNotice(`Recorded evaluation ${id}. Original inputs and outcome are retained.`);
              onChanged();
            }}
          />
        </>
      )}
    </section>
  );
}
