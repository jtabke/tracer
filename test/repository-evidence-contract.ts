import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/application/service.ts";
import { compareCapturedInputs, comparisonToken } from "../src/application/receipt-comparison.ts";
import type { RepositoryFixture } from "./repository-contract.ts";
import type { Entity } from "../src/core/model.ts";
import type { EvidenceAppend, ObservedState, Receipt } from "../src/core/evidence.ts";
import type { Transaction } from "../src/application/ports/repository.ts";

const actor = { actor: "portable-capture-contract", reason: "Synthetic adapter behavior" };
async function setup(t: TestContext, open: () => Promise<RepositoryFixture>) {
  const fixture = await open();
  t.after(() => fixture.dispose());
  let state: ObservedState = { availability: "available", hash: "sha256:" + "a".repeat(64) };
  const service = () =>
    new Tracer(fixture.repository, undefined, async () => {
      // Observer work must run outside the service's repository callback.
      await fixture.repository.transaction(async (tx) => {
        assert.equal(typeof (await tx.headRevision()), "number");
      });
      return { ...state };
    });
  let tracer = service();
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" }, note: { type: "string" } } } },
      relationshipTypes: {
        uses: { fields: { purpose: { type: "string" } } },
        cites: { source: ["item"], target: [], resourceTarget: true, reference: true, fields: {} },
      },
    },
    0,
    actor,
  );
  const criterion = await tracer.createEntity(
    { type: "item", fields: { title: "Limit 20", note: "Original annotation" } },
    1,
    actor,
  );
  const output = await tracer.createEntity(
    { type: "item", fields: { title: "Assessment" } },
    1,
    actor,
  );
  const source = await tracer.createEntity(
    {
      type: "@resource",
      fields: {},
      resource: {
        label: "External specification",
        source: { system: "file", externalId: "specification" },
      },
    },
    1,
    actor,
  );
  const external = await tracer.evidence.bindExternal(
    { entityId: source.id, system: "file", externalId: "specification", ownership: "external" },
    actor,
  );
  const observation = await tracer.evidence.observe(
    { entityId: source.id, locator: { system: "file", path: "/synthetic/specification" } },
    actor,
  );
  const link = await tracer.createRelationship(
    { type: "uses", source: output.id, target: criterion.id, fields: { purpose: "Criterion" } },
    1,
    actor,
  );
  const reference = await tracer.createRelationship(
    {
      type: "cites",
      source: output.id,
      target: source.id,
      fields: {},
      reference: {
        role: "definition",
        selector: { kind: "section", value: "4.2" },
        state: { mode: "pinned", observationId: observation.id },
      },
    },
    1,
    actor,
  );
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: output.id,
      outcome: "SIMULATED PASS under captured inputs",
      inputs: [
        { entityId: criterion.id, fields: ["title"] },
        { entityId: source.id, observationId: observation.id },
      ],
      relationshipInputs: [{ id: link.id }, { id: reference.id }],
    },
    actor,
  );
  const initial = await tracer.evidence.compareReceipt(receipt.id);
  const review = await tracer.evidence.review(
    {
      receiptId: receipt.id,
      decision: "accepted",
      rationale: "Original scope",
      expectedComparison: initial.token,
    },
    actor,
  );
  return {
    get tracer() {
      return tracer;
    },
    get repository() {
      return fixture.repository;
    },
    criterion,
    output,
    source,
    external,
    observation,
    link,
    reference,
    receipt,
    review,
    observe(next: ObservedState) {
      state = next;
      return tracer.evidence.observe({ entityId: source.id, locator: observation.locator }, actor);
    },
    async reopen() {
      await fixture.reopen();
      tracer = service();
      return tracer;
    },
  };
}

/** Registered by repositoryContract for every provider; contains no adapter SQL or filesystem assumptions. */
export function repositoryEvidenceContract(name: string, open: () => Promise<RepositoryFixture>) {
  test(`${name}: review namespaces isolate owner, contract, version and basis while preserving unqualified reads`, async (t) => {
    const f = await setup(t, open);
    const qualification = {
      ownerId: "case-a",
      contract: "support",
      version: 1,
      basisDigest: "basis-a",
    };
    const alternatives = [
      qualification,
      { ...qualification, ownerId: "case-b" },
      { ...qualification, contract: "other" },
      { ...qualification, version: 2 },
      { ...qualification, basisDigest: "basis-b" },
    ];
    const rows = alternatives.map((qualification) => ({
      ...f.review,
      id: crypto.randomUUID(),
      qualification,
    }));
    await f.repository.transaction(async (tx) => {
      for (const row of rows) await tx.appendEvidence("review", f.receipt.id, row);
      assert.deepEqual(await tx.latestReview(f.receipt.id), f.review);
      for (const row of rows)
        assert.deepEqual(await tx.latestReview(f.receipt.id, row.qualification), row);
      assert.equal(await tx.latestReview("unrelated", qualification), undefined);
      const returned = await tx.latestReview(f.receipt.id, qualification);
      returned!.qualification!.ownerId = "caller-mutated";
      assert.deepEqual(await tx.latestReview(f.receipt.id, qualification), rows[0]);
    });
    const later = { ...f.review, id: crypto.randomUUID() };
    await f.repository.transaction((tx) => tx.appendEvidence("review", f.receipt.id, later));
    await f.reopen();
    await f.repository.transaction(async (tx) => {
      assert.deepEqual(await tx.latestReview(f.receipt.id), later);
      assert.deepEqual(await tx.latestReview(f.receipt.id, qualification), rows[0]);
    });
    const before = await f.tracer.exportProject();
    await assert.rejects(
      f.repository.transaction(async (tx) => {
        await tx.appendEvidence("review", f.receipt.id, {
          ...rows[0],
          id: crypto.randomUUID(),
          decision: "needs_reevaluation",
        });
        throw Error("Abort qualified decision");
      }),
      { code: "storage" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  });
  test(`${name}: evidence kind/subject reads own immutable payloads and duplicate captures never replace`, async (t) => {
    const f = await setup(t, open),
      before = await f.tracer.exportProject();
    const entries: EvidenceAppend[] = [
      ["external", f.source.id, f.external],
      ["observation", f.source.id, f.observation],
      ["receipt", f.output.id, f.receipt],
      ["review", f.receipt.id, f.review],
    ];
    for (const entry of entries) {
      const expected = structuredClone(entry[2]);
      entry[2].actor = "Caller altered returned capture";
      await assert.rejects(
        f.repository.transaction((tx) => tx.appendEvidence(...entry)),
        { code: "conflict" },
      );
      await f.repository.transaction(async (tx) => {
        const stored = await tx.getEvidence(entry[0], entry[2].id);
        assert.deepEqual(stored, expected);
        stored!.actor = "Caller altered read result";
        assert.deepEqual(await tx.getEvidence(entry[0], entry[2].id), expected);
        assert.equal(
          await tx.getEvidence(entry[0] === "receipt" ? "review" : "receipt", entry[2].id),
          undefined,
        );
        assert.deepEqual((await tx.evidence(entry[0], { subject: entry[1], limit: 1 })).items, [
          expected,
        ]);
        assert.deepEqual(
          (await tx.evidence(entry[0], { subject: "unrelated", limit: 1 })).items,
          [],
        );
      });
    }
    const receipt = await f.tracer.evidence.getReceipt(f.receipt.id);
    receipt.inputs[0].entity.fields.title = "Nested caller mutation";
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.deepEqual(await (await f.reopen()).exportProject(), before);
  });

  test(`${name}: native state, captures, dependency indexes and command outcomes roll back and commit together`, async (t) => {
    const f = await setup(t, open),
      before = await f.tracer.exportProject();
    const item: Entity = {
      id: crypto.randomUUID(),
      type: "item",
      version: 1,
      fields: { title: "Atomic candidate" },
    };
    const external = { ...f.external, id: item.id, externalId: "atomic-source" };
    const observation = { ...f.observation, id: crypto.randomUUID(), entityId: item.id };
    const receipt: Receipt = {
      ...f.receipt,
      id: crypto.randomUUID(),
      output: item,
      inputs: [
        ...f.receipt.inputs,
        { entityId: item.id, facet: "native", entity: item, links: [] },
      ],
    };
    const reviewId = crypto.randomUUID();
    const stage = async (tx: Transaction) => {
      const changeset = await tx.beginChangeset(crypto.randomUUID(), 1, actor);
      await tx.save("entity", item, 0);
      await tx.appendEvidence("external", item.id, external);
      await tx.appendEvidence("observation", item.id, observation);
      await tx.appendEvidence("receipt", item.id, receipt);
      const comparison = await compareCapturedInputs(tx, receipt);
      await tx.appendEvidence("review", receipt.id, {
        ...f.review,
        id: reviewId,
        receiptId: receipt.id,
        comparison,
        token: comparisonToken(comparison),
      });
      await tx.appendChangesetCommand("atomic-capture", "fixed-intent", {
        changeset,
        results: [item],
      });
      assert.deepEqual(
        (await tx.impactReceipts({ entityIds: [item.id], relationshipIds: [], limit: 10 })).items,
        [receipt],
      );
      assert.equal((await tx.latestEvidence("review", receipt.id))?.id, reviewId);
      assert.deepEqual(await tx.get("entity", item.id), item);
    };
    await assert.rejects(
      f.repository.transaction(async (tx) => {
        await stage(tx);
        throw new Error("Abort every kind");
      }),
      { code: "storage" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
    await f.repository.transaction(async (tx) => {
      assert.deepEqual(
        (await tx.impactReceipts({ entityIds: [item.id], relationshipIds: [], limit: 10 })).items,
        [],
      );
      assert.equal(await tx.getChangesetCommand("atomic-capture"), undefined);
      assert.equal(await tx.latestEvidence("review", receipt.id), undefined);
      assert.equal(await tx.getEvidence("external", item.id), undefined);
    });
    await f.repository.transaction(stage);
    const saved = await f.tracer.exportProject();
    assert.equal(saved.projectRevision, before.projectRevision + 1);
    assert.ok(saved.evidenceRevision > before.evidenceRevision);
    for (const collection of ["external", "observations", "receipts", "reviews"] as const)
      assert.equal(saved.evidence[collection].length, before.evidence[collection].length + 1);
    assert.deepEqual(await (await f.reopen()).exportProject(), saved);
    assert.deepEqual(await f.tracer.evidence.getReceipt(receipt.id), receipt);
    assert.equal((await f.tracer.getChangesetOutcome("atomic-capture"))?.results[0].id, item.id);
  });

  test(`${name}: exact entity/link/resource captures and native selections survive edits, deletion, schema changes and reopen`, async (t) => {
    const f = await setup(t, open),
      tracer = f.tracer;
    const configuration = await tracer.configurations.capture(
      {
        name: "Selected criterion",
        subjectId: f.output.id,
        expectedSubjectVersion: 1,
        members: [
          { entityId: f.criterion.id, version: 1 },
          { entityId: f.output.id, version: 1 },
        ],
        relationships: [{ relationshipId: f.link.id, version: 1 }],
      },
      actor,
    );
    const baseline = await tracer.baselines.capture(
      { name: "Original commit", expectedProjectRevision: (await tracer.timeline()).head },
      actor,
    );
    await tracer.updateEntity(
      f.criterion.id,
      1,
      { fields: { ...f.criterion.fields, title: "Limit 18" } },
      1,
      actor,
    );
    await tracer.updateRelationship(
      f.link.id,
      1,
      { ...f.link, fields: { purpose: "Changed interpretation" } },
      1,
      actor,
    );
    await tracer.removeRelationship(f.link.id, 2, 1, actor);
    const schema = await tracer.getSchema();
    assert.ok(schema);
    await tracer.setSchema(
      {
        entityTypes: { ...schema.entityTypes, extra: { fields: {} } },
        relationshipTypes: schema.relationshipTypes,
      },
      1,
      actor,
    );
    await tracer.removeEntity(f.source.id, 1, 2, actor, true);
    const saved = await tracer.exportProject(),
      reopened = await f.reopen();
    assert.deepEqual(await reopened.exportProject(), saved);
    assert.deepEqual(await reopened.evidence.getReceipt(f.receipt.id), f.receipt);
    assert.deepEqual((await reopened.getNativePin(f.criterion.id, 1)).entity, f.criterion);
    assert.equal((await reopened.getNativePin(f.criterion.id, 1)).schema.version, 1);
    assert.deepEqual(await reopened.configurations.get(configuration.id), configuration);
    const links = await reopened.baselines.contents({
      baselineId: baseline.id,
      kind: "relationship",
      limit: 100,
    });
    assert.deepEqual(
      links.objects.items.find((row) => row.id === f.reference.id),
      f.reference,
    );
    assert.deepEqual(
      links.objects.items.find((row) => row.id === f.link.id),
      f.link,
    );
    assert.equal(links.schema.version, 1);
    const entities = await reopened.baselines.contents({
      baselineId: baseline.id,
      kind: "entity",
      limit: 100,
    });
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    assert.deepEqual(
      entities.objects.items.toSorted(byId),
      [f.criterion, f.output, f.source].toSorted(byId),
    );
    assert.deepEqual(links.objects.items.toSorted(byId), [f.link, f.reference].toSorted(byId));
    assert.equal(configuration.members.length, 2);

    assert.deepEqual(
      (await reopened.history({ kind: "relationship", id: f.link.id })).items.map((row) => [
        row.version,
        row.snapshot === null,
      ]),
      [
        [1, false],
        [2, false],
        [3, true],
      ],
    );
    const comparison = await reopened.evidence.compareReceipt(f.receipt.id);
    assert.equal(comparison.hasChanged, true);
    assert.equal(comparison.hasUnknown, true);
    assert.equal(comparison.review.previous?.id, f.review.id);
  });

  test(`${name}: review applicability follows declared scope, rejects stale/unknown acceptance and survives reopen`, async (t) => {
    const f = await setup(t, open),
      tracer = f.tracer;
    const initial = await tracer.evidence.compareReceipt(f.receipt.id);
    const annotated = await tracer.updateEntity(
      f.criterion.id,
      1,
      { fields: { ...f.criterion.fields, note: "Unselected note" } },
      1,
      actor,
    );
    await f.observe({ availability: "available", hash: f.observation.hash });
    const matching = await tracer.evidence.compareReceipt(f.receipt.id);
    assert.equal(matching.token, initial.token);
    assert.equal(matching.review.decision?.id, f.review.id);
    await tracer.updateEntity(
      annotated.id,
      2,
      { fields: { ...annotated.fields, title: "Limit 18" } },
      1,
      actor,
    );
    const changed = await tracer.evidence.compareReceipt(f.receipt.id),
      beforeStale = await tracer.exportProject();
    assert.equal(changed.review.state, "unreviewed");
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: f.receipt.id,
          expectedComparison: initial.token,
          decision: "accepted",
          rationale: "Stale context",
        },
        actor,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await tracer.exportProject(), beforeStale);
    await tracer.evidence.review(
      {
        receiptId: f.receipt.id,
        expectedComparison: changed.token,
        decision: "accepted",
        rationale: "Historical scope only",
      },
      actor,
    );
    assert.equal((await tracer.evidence.compareReceipt(f.receipt.id)).state, "changed");
    await f.observe({ availability: "unknown", reason: "Synthetic source unavailable" });
    const unknown = await tracer.evidence.compareReceipt(f.receipt.id),
      beforeUnknown = await tracer.exportProject();
    assert.equal(unknown.hasChanged, true);
    assert.equal(unknown.hasUnknown, true);
    assert.equal(unknown.review.state, "unreviewed");
    await assert.rejects(
      tracer.evidence.review(
        {
          receiptId: f.receipt.id,
          expectedComparison: unknown.token,
          decision: "accepted",
          rationale: "Cannot accept unknown inputs",
        },
        actor,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await tracer.exportProject(), beforeUnknown);
    const head = (await tracer.timeline()).head;
    const review = await tracer.evidence.review(
      {
        receiptId: f.receipt.id,
        expectedComparison: unknown.token,
        decision: "needs_reevaluation",
        rationale: "Source unavailable and criterion differs",
      },
      actor,
    );
    assert.equal((await tracer.timeline()).head, head);
    const saved = await tracer.exportProject(),
      reopened = await f.reopen();
    assert.deepEqual(await reopened.exportProject(), saved);
    assert.equal(
      (await reopened.evidence.compareReceipt(f.receipt.id)).review.decision?.id,
      review.id,
    );
    assert.deepEqual(await reopened.evidence.getReceipt(f.receipt.id), f.receipt);
    const reviews = await reopened.evidence.list("review", { subject: f.receipt.id });
    assert.deepEqual(reviews.items[0], f.review);
  });

  test(`${name}: evidence pages apply kind/subject before limits and latest means append order`, async (t) => {
    const f = await setup(t, open),
      head = (await f.tracer.timeline()).head;
    const other = { ...f.observation, id: crypto.randomUUID(), entityId: f.criterion.id };
    const later = {
      ...f.observation,
      id: crypto.randomUUID(),
      at: "2000-01-01T00:00:00Z",
      hash: "sha256:" + "b".repeat(64),
    };
    await f.repository.transaction(async (tx) => {
      await tx.appendEvidence("observation", other.entityId, other);
      const expected = structuredClone(later);
      const append = tx.appendEvidence("observation", later.entityId, later);
      later.hash = "sha256:" + "c".repeat(64);
      await append;
      const first = await tx.evidence("observation", { subject: f.source.id, limit: 1 });
      assert.deepEqual(first.items, [f.observation]);
      assert.ok(first.nextAfter);
      const next = await tx.evidence("observation", {
        subject: f.source.id,
        after: first.nextAfter,
        limit: 1,
      });
      assert.deepEqual(next.items, [expected]);
      assert.equal(next.nextAfter, undefined);
      assert.deepEqual(await tx.latestEvidence("observation", f.source.id), expected);
      assert.deepEqual((await tx.evidence("review", { subject: f.receipt.id, limit: 1 })).items, [
        f.review,
      ]);
    });
    assert.equal((await f.tracer.timeline()).head, head);
  });
}
