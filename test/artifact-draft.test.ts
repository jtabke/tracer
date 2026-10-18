import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTextDraft,
  cancelTextDraft,
  textDraftChanged,
  remainingTextDraft,
} from "../ui/workbench/artifact-draft.ts";

const record = {
  title: "Original title",
  statement: "Original statement",
  fields: { title: "Original title", statement: "Original statement" },
  version: 3,
};

test("opening optional text editors produces neither dirty state nor empty stored attributes", () => {
  const draft = {
    title: record.title,
    statement: record.statement,
    acceptance: "",
    expectedVersion: 3,
    expectedLocal: 0,
  };
  assert.equal(textDraftChanged(record, draft), false);
  assert.deepEqual(
    applyTextDraft(record, draft, ["title", "statement", "acceptance"]),
    record.fields,
  );
  assert.deepEqual(
    applyTextDraft(record, { ...draft, acceptance: "New criterion" }, ["statement"]),
    record.fields,
  );
  assert.equal(textDraftChanged(undefined, draft), true);
});

test("a confirmed single-field save retains other edits with only its own new version", () => {
  const draft = {
    title: "Pending title",
    statement: "Saved statement",
    acceptance: "Pending criterion",
    expectedVersion: 3,
    expectedLocal: 0,
  };
  const saved = {
    ...record,
    statement: "Saved statement",
    fields: { ...record.fields, statement: "Saved statement" },
    version: 4,
  };
  assert.deepEqual(applyTextDraft(record, draft, ["statement"]), saved.fields);
  const remaining = remainingTextDraft(saved, draft, "statement")!;
  assert.equal(remaining.title, "Pending title");
  assert.equal(remaining.acceptance, "Pending criterion");
  assert.equal(remaining.expectedVersion, 4);
  assert.equal(draft.expectedVersion, 3);
  assert.equal(textDraftChanged(saved, remaining), true);
  assert.equal(
    remainingTextDraft(saved, { ...draft, title: saved.title, acceptance: "" }, "statement"),
    null,
  );
  assert.equal(
    remainingTextDraft({ ...saved, localGeneration: 2 }, draft, "statement")!.expectedLocal,
    2,
  );
});

test("cancelling a field retains other proposals without adopting a newer captured version", () => {
  const draft = {
    title: "Pending title",
    statement: "Discarded statement",
    expectedVersion: 2,
    expectedLocal: 0,
  };
  const remaining = cancelTextDraft(record, draft, "statement")!;
  assert.equal(remaining.title, "Pending title");
  assert.equal(remaining.statement, record.statement);
  assert.equal(remaining.expectedVersion, 2);
  assert.equal(cancelTextDraft(record, { ...draft, title: record.title }, "statement"), null);
});
