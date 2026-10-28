import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { unlinkSync, writeFileSync } from "node:fs";
import { evidenceCycleFixture, cycleActor } from "./evidence-cycle-fixture.ts";

test("resource and contextual reference specialize existing entity and relationship identities", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer;
    const promoted = await t.updateEntity(
      f.definition.id,
      1,
      { type: "component", fields: { title: "Managed specification", revision: "C" } },
      1,
      cycleActor,
    );
    assert.equal(promoted.id, f.definition.id);
    assert.deepEqual(promoted.resource, f.definition.resource);
    assert.deepEqual(await t.getRelationship(f.definitionReference.id), f.definitionReference);
    assert.equal((await t.getReference(f.definitionReference.id)).resource.id, promoted.id);
    const second = await t.createRelationship(
      {
        ...f.definitionReference,
        reference: {
          ...f.definitionReference.reference!,
          selector: { kind: "section", value: "5" },
        },
      },
      1,
      cycleActor,
    );
    assert.notEqual(second.id, f.definitionReference.id);
    assert.equal(second.target, f.definitionReference.target);
    assert.deepEqual(
      (await t.history({ kind: "entity", id: promoted.id })).items.map((r) => r.version),
      [1, 2],
    );
    assert.equal(
      (await t.evidence.compareReceipt(f.receipt.id)).state,
      "current",
      "Promoting native annotations does not change an explicitly declared external content input",
    );
  } finally {
    f.close();
  }
});

test("a generic record or execution outcome does not supply comparison-scoped review guarantees", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer,
      initial = await t.evidence.compareReceipt(f.receipt.id);
    await t.createEntity(
      { type: "note", fields: { title: "Accepted " + f.receipt.id } },
      1,
      cycleActor,
    );
    await t.evidence.recordReceipt(
      { outputId: f.conclusion.id, outcome: "accepted", inputs: [{ entityId: f.requirement.id }] },
      cycleActor,
    );
    assert.equal((await t.evidence.compareReceipt(f.receipt.id)).review.state, "unreviewed");
    await t.updateEntity(
      f.requirement.id,
      1,
      { fields: { ...f.requirement.fields, limit_W: 18 } },
      1,
      cycleActor,
    );
    const before = await t.exportProject();
    await assert.rejects(
      t.evidence.review(
        {
          receiptId: f.receipt.id,
          decision: "accepted",
          rationale: "Stale review",
          expectedComparison: initial.token,
        },
        cycleActor,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await t.exportProject(), before);
    const changed = await t.evidence.compareReceipt(f.receipt.id);
    const review = await t.evidence.review(
      {
        receiptId: f.receipt.id,
        decision: "accepted",
        rationale: "Applies only to the captured 20 W criterion",
        expectedComparison: changed.token,
      },
      cycleActor,
    );
    assert.equal(review.receiptId, f.receipt.id);
    const { token, review: priorReview, supersededBy, ...captured } = changed;
    assert.equal(review.token, token);
    assert.equal(priorReview.state, "unreviewed");
    assert.deepEqual(supersededBy, []);
    assert.deepEqual(review.comparison, captured);
    assert.equal((await t.evidence.compareReceipt(f.receipt.id)).state, "changed");
  } finally {
    f.close();
  }
});

test("observation, evaluation and applicability review share append-only capture without sharing their semantics", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer,
      comparison = await t.evidence.compareReceipt(f.receipt.id);
    const review = await t.evidence.review(
      {
        receiptId: f.receipt.id,
        decision: "accepted",
        rationale: "Original comparison",
        expectedComparison: comparison.token,
      },
      cycleActor,
    );
    const head = (await t.timeline()).head;
    writeFileSync(f.definitionFile, "Changed source\n");
    const observation = await t.evidence.observe(
      { entityId: f.definition.id, locator: { system: "file", path: f.definitionFile } },
      cycleActor,
    );
    const changed = await t.evidence.compareReceipt(f.receipt.id);
    assert.equal(changed.review.state, "unreviewed");
    assert.equal(changed.review.previous?.id, review.id);
    assert.equal(changed.state, "changed");
    unlinkSync(f.definitionFile);
    await t.evidence.observe(
      { entityId: f.definition.id, locator: { system: "file", path: f.definitionFile } },
      cycleActor,
    );
    const unknown = await t.evidence.compareReceipt(f.receipt.id),
      before = await t.exportProject();
    await assert.rejects(
      t.evidence.review(
        {
          receiptId: f.receipt.id,
          decision: "accepted",
          rationale: "Cannot manufacture known information",
          expectedComparison: unknown.token,
        },
        cycleActor,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await t.exportProject(), before);
    assert.equal((await t.timeline()).head, head);
    const db = new DatabaseSync(f.database);
    try {
      for (const [kind, id] of [
        ["observation", observation.id],
        ["receipt", f.receipt.id],
        ["review", review.id],
      ]) {
        assert.throws(
          () =>
            db.prepare("UPDATE evidence SET payload_json='{}' WHERE kind=? AND id=?").run(kind, id),
          /Immutable evidence/,
        );
        assert.throws(
          () => db.prepare("DELETE FROM evidence WHERE kind=? AND id=?").run(kind, id),
          /Immutable evidence/,
        );
      }
    } finally {
      db.close();
    }
    assert.deepEqual(await t.evidence.getReceipt(f.receipt.id), f.receipt);
    assert.equal(
      (await t.getReference(f.definitionReference.id)).selectedObservation?.id,
      f.definitionObservation.id,
    );
  } finally {
    f.close();
  }
});

test("selected configurations, commit baselines and live view recipes have different capture scope", async () => {
  const f = await evidenceCycleFixture();
  try {
    const t = f.tracer;
    const configuration = await t.configurations.capture(
      {
        name: "Article selection",
        subjectId: f.conclusion.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.article.id, version: 1 }],
      },
      cycleActor,
    );
    const head = (await t.timeline()).head;
    await t.savedViews.save({
      name: "Current articles",
      expectedVersion: 0,
      expectedSchemaVersion: 1,
      definition: { kind: "chain", type: "component", steps: [] },
    });
    assert.equal((await t.timeline()).head, head);
    await t.updateEntity(
      f.article.id,
      1,
      { fields: { ...f.article.fields, revision: "B" } },
      1,
      cycleActor,
    );
    assert.equal(
      (await t.configurations.get(configuration.id)).members[0].entity.fields.revision,
      "A",
    );
    const baseline = await t.baselines.contents({
      baselineId: f.baseline.id,
      kind: "entity",
      limit: 100,
    });
    assert.equal(baseline.objects.items.find((e) => e.id === f.article.id)?.fields.revision, "A");
    assert.ok(baseline.objects.items.some((e) => e.id === f.plan.id));
    assert.equal(
      configuration.members.some((m) => m.entity.id === f.plan.id),
      false,
    );
    assert.equal(
      (await t.queryEntities({ type: "component" })).items.find((e) => e.id === f.article.id)
        ?.fields.revision,
      "B",
    );
  } finally {
    f.close();
  }
});
