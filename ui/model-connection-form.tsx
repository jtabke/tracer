import { useEffect, useRef, useState } from "react";
import type { RelationshipDefinition, Schema } from "../src/core/model.ts";

export function ModelConnectionForm({
  schema,
  source,
  target,
  busy,
  version,
  draftOnly = false,
  onCreate,
  onCancel,
}: {
  schema: Schema;
  source: string;
  target: string;
  busy: boolean;
  version: number;
  draftOnly?: boolean;
  onCreate(name: string, definition: RelationshipDefinition): Promise<boolean>;
  onCancel(): void;
}) {
  const [name, setName] = useState("");
  const [invalid, setInvalid] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const save = async () => {
    const key = name.trim();
    if (!key || Object.hasOwn(schema.relationshipTypes, key)) {
      setInvalid(
        draftOnly
          ? "Enter a new, unique connection name. Select an existing connection to edit its rules."
          : "Enter a new, unique connection name. Existing connections can be edited in Configure model.",
      );
      input.current?.focus();
      return;
    }
    if (!Object.hasOwn(schema.entityTypes, source) || !Object.hasOwn(schema.entityTypes, target)) {
      setInvalid("A selected type is no longer in this draft. Cancel and choose current types.");
      return;
    }
    if (
      await onCreate(key, {
        source: [source],
        target: [target],
        fields: {},
        workflow: [{ source, target, direction: "forward", label: key.replaceAll("_", " ") }],
      })
    )
      onCancel();
  };
  return (
    <form
      className="model-link-composer"
      aria-label="Link model types"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3>New connection</h3>
      <fieldset disabled={busy}>
        <legend className="sr-only">Connection draft</legend>
        <div className="model-link-preview">
          <strong>{source.replaceAll("_", " ")}</strong>
          <span aria-hidden="true">→</span>
          <label>
            Connection name
            <input ref={input} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <span aria-hidden="true">→</span>
          <strong>{target.replaceAll("_", " ")}</strong>
        </div>
        <p className="muted">
          {draftOnly
            ? "Adds a permitted connection to this draft. Save model to save all changes."
            : `Adds a permitted source → target link to schema v${version}. Actual item links are recorded in the workspace.`}
        </p>
        {invalid && <p role="alert">{invalid}</p>}
        <div className="toolbar">
          <button className="primary" type="submit">
            {draftOnly ? "Add connection" : "Save connection"}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
