import test from "node:test";
import assert from "node:assert/strict";
import {
  initialReferenceDraft,
  referenceOperation,
  referenceQualification,
  canPinReference,
} from "../ui/reference-draft.ts";
import type { ReferenceContext } from "../ui/reference-draft.ts";
const context: ReferenceContext = {
  source: { id: "subject", type: "need", version: 2, fields: {} },
  schema: {
    id: "project",
    version: 3,
    entityTypes: { need: { fields: {} } },
    relationshipTypes: { cites: { reference: true, resourceTarget: true, fields: {} } },
  },
  resources: [
    {
      id: "resource",
      type: "@resource",
      resource: { label: "Native source" },
      version: 4,
      fields: {},
    },
  ],
};
test("reference draft captures endpoint versions, native pins and unknown selectors without implicit retargeting", () => {
  const draft = {
    ...initialReferenceDraft(context, "stable-command"),
    resourceId: "resource",
    mode: "pinned" as const,
    scope: "Section A",
  };
  assert.equal(canPinReference(context, draft), true);
  assert.deepEqual(referenceQualification(context, draft).state, { mode: "pinned", revision: 4 });
  const op = referenceOperation(context, draft);
  assert.equal(op.op, "reference.create");
  if (op.op !== "reference.create") return;
  assert.equal(op.input.sourceVersion, 2);
  assert.equal(op.input.targetVersion, 4);
  const pinned = {
    ...context,
    link: {
      id: "ref",
      type: "cites",
      version: 6,
      source: "subject",
      target: "resource",
      fields: {},
      reference: {
        role: "support",
        selector: { kind: "future", value: { opaque: ["A", 7] } },
        state: { mode: "pinned" as const, revision: 1 },
      },
    },
  };
  const edit = {
    ...initialReferenceDraft(pinned, "next"),
    explanation: "Only interpretation changes",
  };
  assert.deepEqual(referenceQualification(pinned, edit).selector, pinned.link.reference.selector);
  assert.deepEqual(referenceQualification(pinned, edit).state, { mode: "pinned", revision: 1 });
  assert.deepEqual(referenceQualification(pinned, { ...edit, pinLatest: true }).state, {
    mode: "pinned",
    revision: 4,
  });
  assert.equal(referenceOperation(pinned, edit).op, "relationship.update");
  const current = { ...draft, mode: "current" as const };
  assert.deepEqual(referenceQualification(context, current).state, { mode: "current" });
  const external = {
    ...context,
    resources: [
      {
        ...context.resources[0],
        resource: {
          label: "External",
          source: { system: "file" as const, externalId: "external" },
        },
      },
    ],
  };
  assert.equal(canPinReference(external, draft), false);
  assert.throws(() => referenceQualification(external, draft), /Observe/);
});
