import type { Fields } from "../../src/core/model.ts";

export const textFields = ["title", "statement", "acceptance"] as const;
export type TextField = (typeof textFields)[number];
type TextRecord = {
  title: string;
  statement: string;
  fields: Fields;
  version: number;
  localGeneration?: number;
};
export type TextDraft = Partial<Record<TextField, string>> & {
  expectedVersion?: number;
  expectedLocal?: number;
};

function recordedValue(record: TextRecord, field: TextField) {
  if (field === "title") return record.title;
  if (field === "statement") return record.statement;
  return String(record.fields[field] ?? "");
}

export function textDraftChanged(record: TextRecord | undefined, draft: TextDraft) {
  if (!record) return true;
  return textFields.some(
    (field) => draft[field] !== undefined && draft[field] !== recordedValue(record, field),
  );
}

// Opening an editor must not turn absent optional fields into empty stored fields.
export function applyTextDraft(record: TextRecord, draft: TextDraft, editable: TextField[]) {
  const fields = { ...record.fields };
  for (const field of editable) {
    if (draft[field] === undefined || draft[field] === recordedValue(record, field)) continue;
    fields[field] = draft[field];
  }
  return fields;
}

export function cancelTextDraft(record: TextRecord, draft: TextDraft, field: TextField) {
  const remaining = { ...draft, [field]: recordedValue(record, field) };
  return textDraftChanged(record, remaining) ? remaining : null;
}

// Only a confirmed save of this draft may advance its captured version.
export function remainingTextDraft(record: TextRecord, draft: TextDraft, savedField: TextField) {
  const remaining = cancelTextDraft(record, draft, savedField);
  return remaining
    ? {
        ...remaining,
        expectedVersion: record.version,
        expectedLocal: record.localGeneration ?? 0,
      }
    : null;
}
