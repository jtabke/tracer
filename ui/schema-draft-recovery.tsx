import type { SchemaObject } from "../src/core/model.ts";

export function SchemaDraftRecovery({
  schema,
  text,
  version,
  busy,
  onRestart,
}: {
  schema: SchemaObject | null;
  text: string;
  version: number;
  busy: boolean;
  onRestart(): void;
}) {
  const exportProposal = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `model-proposal-v${version}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  if (version === (schema?.version ?? 0)) return null;
  return (
    <aside aria-label="Stale model proposal">
      <p>
        This proposal is based on an older schema. Editing or retrying Save cannot commit from this
        base. Export it before starting from the current model, then manually reapply the changes
        you still want. Nothing is merged or saved automatically.
      </p>
      <div className="toolbar">
        <button disabled={busy} onClick={exportProposal}>
          Export proposal JSON
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Replace this unsaved proposal with the current model? Export it first to keep a copy. Nothing will be saved.",
              )
            )
              onRestart();
          }}
        >
          Start from current model
        </button>
      </div>
    </aside>
  );
}
