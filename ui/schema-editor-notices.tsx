import type { Schema } from "../src/core/model.ts";
import { pendingChanges, rootExtensions } from "./schema-draft.ts";
export function SchemaEditorNotices({
  base,
  draft,
  invalid,
}: {
  base: Schema;
  draft: Schema;
  invalid: string;
}) {
  const changes = pendingChanges(base, draft);
  const extensions = rootExtensions(draft);
  return (
    <>
      {invalid && <p role="alert">Invalid native JSON: {invalid}. Your text is retained.</p>}
      {!!extensions.length && (
        <p role="alert">
          Root extensions ({extensions.join(", ")}) are not preserved by the native save service.
          Remove them explicitly in Advanced JSON before saving; nested properties are preserved.
        </p>
      )}
      <h3>Pending changes</h3>
      {changes.length ? (
        <ul>
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      ) : (
        <p>No changes</p>
      )}
    </>
  );
}
