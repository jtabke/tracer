import type { Schema, SchemaObject } from "../../../src/core/model.ts";
import { ModelConnectionForm } from "../../../ui/model-connection-form.tsx";
import { nativeDraft } from "../../../ui/schema-draft.ts";
export type ModelLinkDraft = { source: string; target: string; schema: SchemaObject };

export function ModelLinkComposer({
  draft,
  busy,
  onSave,
  onCancel,
}: {
  draft: ModelLinkDraft;
  busy: boolean;
  onSave(schema: Schema, version: number): Promise<boolean>;
  onCancel(): void;
}) {
  return (
    <ModelConnectionForm
      schema={draft.schema}
      source={draft.source}
      target={draft.target}
      busy={busy}
      version={draft.schema.version}
      onCancel={onCancel}
      onCreate={(name, definition) =>
        onSave(
          {
            ...nativeDraft(draft.schema),
            relationshipTypes: { ...draft.schema.relationshipTypes, [name]: definition },
          },
          draft.schema.version,
        )
      }
    />
  );
}
