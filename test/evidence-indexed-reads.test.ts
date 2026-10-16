import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { Repository, Transaction } from "../src/persistence/contracts.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { migrate } from "../src/persistence/migrations.ts";
import { EvidenceService } from "../src/application/evidence.ts";
import { Tracer } from "../src/application/service.ts";
import type { Receipt, Observation, ReceiptInput, Locator } from "../src/core/evidence.ts";

const origin = { actor: "indexed evidence engineer" };
async function fixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" } } } },
      relationshipTypes: { uses: { fields: {} } },
    },
    0,
    origin,
  );
  const output = await tracer.createEntity(
    { type: "item", fields: { title: "Output" } },
    1,
    origin,
  );
  const input = await tracer.createEntity({ type: "item", fields: { title: "Input" } }, 1, origin);
  const captured = await tracer.evidence.recordReceipt(
    { outputId: output.id, inputs: [{ entityId: input.id }], outcome: "Passed" },
    origin,
  );
  return { repository, tracer, output, input, captured };
}
function instrument(repository: Repository, change: (tx: Transaction) => Transaction): Repository {
  return {
    transaction: (work) => repository.transaction((tx) => work(change(tx))),
    close: () => repository.close(),
  };
}

test("comparison returns every exact superseding ID in append order without reading unrelated receipt payloads", async () => {
  const { repository, tracer, captured } = await fixture();
  try {
    const ids = [
      "z-replacement",
      "a-replacement",
      "m-replacement",
      "b-replacement",
      "q-replacement",
      "c-replacement",
      "d-replacement",
    ];
    await repository.transaction(async (tx) => {
      for (let index = 0; index < 1005; index++)
        await tx.appendEvidence("receipt", captured.output.id, {
          ...captured,
          id: `unrelated-${index}`,
        });
      for (const id of ids)
        await tx.appendEvidence("receipt", captured.output.id, {
          ...captured,
          id,
          supersedes: captured.id,
        });
    });
    const before = await tracer.history();
    let lookups = 0;
    const guarded = instrument(repository, (tx) => ({
      ...tx,
      evidence: async () => {
        throw new Error("comparison must not deserialize receipt/observation catalogues");
      },
      supersedingReceiptIds: async (id) => {
        lookups++;
        return tx.supersedingReceiptIds(id);
      },
    }));
    const service = new EvidenceService(guarded, () => crypto.randomUUID());
    const compared = await service.compareReceipt(captured.id);
    assert.deepEqual(compared.supersededBy, ids);
    assert.equal(compared.state, "current");
    assert.equal(lookups, 1);
    assert.deepEqual(await tracer.history(), before);
    assert.equal((await tracer.evidence.getReceipt(captured.id)).supersedes, undefined);
  } finally {
    repository.close();
  }
});

test("graph external provenance selects the last appended observation directly, including unknown and absent states", async () => {
  const { repository, tracer, input, output } = await fixture();
  try {
    await tracer.evidence.bindExternal(
      { entityId: input.id, system: "file", externalId: "external-input", ownership: "external" },
      origin,
    );
    await tracer.evidence.bindExternal(
      { entityId: output.id, system: "file", externalId: "external-output", ownership: "external" },
      origin,
    );
    const observation = (index: number): Observation => ({
      id: `observation-${index}`,
      entityId: input.id,
      locator: { system: "file", path: "example.txt" },
      availability: "available",
      hash: "sha256:" + "a".repeat(64),
      at: `${2030 - index}-01-01T00:00:00Z`,
      actor: origin.actor,
    });
    const unknown: Observation = {
      ...observation(1005),
      availability: "unknown",
      reason: "Unavailable",
    };
    await repository.transaction(async (tx) => {
      for (let index = 0; index < 1005; index++)
        await tx.appendEvidence("observation", input.id, observation(index));
      await tx.appendEvidence("observation", input.id, unknown);
    });
    let latestReads = 0;
    const guarded = instrument(repository, (tx) => ({
      ...tx,
      evidence: async (kind, query) => {
        assert.notEqual(kind, "observation", "graph must not load observation history");
        assert.equal(query.limit, 50, "graph receipt projection remains bounded");
        return tx.evidence(kind, query);
      },
      latestEvidence: async (kind, id) => {
        if (kind === "observation") latestReads++;
        return tx.latestEvidence(kind, id);
      },
    }));
    const service = new EvidenceService(guarded, () => crypto.randomUUID());
    const before = await repository.transaction((tx) => tx.impactEvidenceRevision());
    const graph = await guarded.transaction((tx) =>
      service.graphEvidence(tx, [input.id, output.id]),
    );
    assert.deepEqual(
      graph.external.map((entry) => entry.observation),
      [unknown, null],
    );
    assert.equal(latestReads, 2);
    assert.equal(await repository.transaction((tx) => tx.impactEvidenceRevision()), before);
  } finally {
    repository.close();
  }
});

test("subject-scoped evidence pages use the complete subject index and retain absent/nullish/empty cursor behavior", async () => {
  const { repository, captured } = await fixture();
  const prepare = DatabaseSync.prototype.prepare;
  const statements: string[] = [];
  try {
    await repository.transaction(async (tx) => {
      await tx.appendEvidence("receipt", "another-output", { ...captured, id: "unrelated" });
      await tx.appendEvidence("receipt", captured.output.id, { ...captured, id: "second" });
    });
    DatabaseSync.prototype.prepare = function (sql) {
      statements.push(sql);
      return prepare.call(this, sql);
    };
    const first = await repository.transaction((tx) =>
      tx.evidence("receipt", { subject: captured.output.id, limit: 1 }),
    );
    assert.deepEqual(first.items, [captured]);
    assert.ok(first.nextAfter);
    const scopedSQL = statements[0];
    const second = await repository.transaction((tx) =>
      tx.evidence("receipt", { subject: captured.output.id, after: first.nextAfter, limit: 1 }),
    );
    assert.deepEqual(
      second.items.map((value) => value.id),
      ["second"],
    );
    assert.equal(second.nextAfter, undefined);
    const all = await repository.transaction((tx) => tx.evidence("receipt", { limit: 10 }));
    assert.deepEqual(
      all.items.map((value) => value.id),
      [captured.id, "unrelated", "second"],
    );
    assert.deepEqual(
      await repository.transaction((tx) =>
        tx.evidence("receipt", { subject: null, limit: 10 } as unknown as Parameters<
          Transaction["evidence"]
        >[1]),
      ),
      all,
    );
    assert.deepEqual(
      await repository.transaction((tx) => tx.evidence("receipt", { subject: "", limit: 10 })),
      { items: [] },
    );
    DatabaseSync.prototype.prepare = prepare;
    const planDB = new DatabaseSync(":memory:");
    try {
      migrate(planDB);
      const plan = planDB
        .prepare("EXPLAIN QUERY PLAN " + scopedSQL)
        .all("receipt", captured.output.id, 0, 2)
        .map((row) => String(row.detail))
        .join("\n");
      assert.match(plan, /evidence_subject \(kind=\? AND subject_id=\? AND sequence>\?\)/);
      assert.doesNotMatch(plan, /TEMP B-TREE/);
      const supersessionPlan = planDB
        .prepare(
          "EXPLAIN QUERY PLAN SELECT id FROM evidence WHERE kind='receipt' AND json_extract(payload_json,'$.supersedes')=? ORDER BY sequence",
        )
        .all(captured.id)
        .map((row) => String(row.detail))
        .join("\n");
      assert.match(supersessionPlan, /SEARCH evidence USING INDEX receipt_supersedes/);
    } finally {
      planDB.close();
    }
  } finally {
    DatabaseSync.prototype.prepare = prepare;
    repository.close();
  }
});

async function queuedMutation<T>(
  repository: Repository,
  start: () => Promise<T>,
  mutate: () => void,
) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = repository.transaction(async () => {
    await gate;
  });
  const result = start();
  mutate();
  release();
  await held;
  return result;
}

test("queued evidence commands use call-time deep input snapshots through receipt paths, observations, bindings and reviews", async () => {
  const { repository, tracer, input, output } = await fixture();
  try {
    const path = await tracer.createRelationship(
      { type: "uses", source: output.id, target: input.id, fields: {} },
      1,
      origin,
    );
    const command: ReceiptInput = {
      outputId: output.id,
      outcome: "Original outcome",
      inputs: [
        { entityId: input.id, fields: ["title"], path: [path.id], expectedPathVersions: [1] },
      ],
    };
    const recorded = await queuedMutation(
      repository,
      () => tracer.evidence.recordReceipt(command, origin),
      () => {
        command.outcome = "Mutated";
        command.inputs[0].entityId = output.id;
        command.inputs[0].fields!.push("absent");
        command.inputs[0].path![0] = "absent";
        command.inputs[0].expectedPathVersions![0] = 0;
      },
    );
    assert.equal(recorded.outcome, "Original outcome");
    assert.equal(recorded.inputs[0].entityId, input.id);
    assert.deepEqual(recorded.inputs[0].fields, ["title"]);
    assert.deepEqual(recorded.inputs[0].links, [path]);
    const binding = {
      entityId: input.id,
      system: "file" as const,
      externalId: "original-source",
      ownership: "external" as const,
    };
    const bound = await queuedMutation(
      repository,
      () => tracer.evidence.bindExternal(binding, origin),
      () => {
        binding.entityId = output.id;
        binding.externalId = "mutated";
      },
    );
    assert.equal(bound.id, input.id);
    assert.equal(bound.externalId, "original-source");
    const observedLocations: Locator[] = [];
    const evidence = new EvidenceService(
      repository,
      () => crypto.randomUUID(),
      async (location) => {
        observedLocations.push(location);
        return { availability: "available", hash: "sha256:" + "a".repeat(64) };
      },
    );
    const observeCommand = {
      entityId: input.id,
      locator: { system: "file" as const, path: "original.txt" },
    };
    const observed = await queuedMutation(
      repository,
      () => evidence.observe(observeCommand, origin),
      () => {
        observeCommand.entityId = output.id;
        observeCommand.locator.path = "mutated.txt";
      },
    );
    assert.equal(observed.entityId, input.id);
    assert.deepEqual(observedLocations, [{ system: "file", path: "original.txt" }]);
    const compared = await tracer.evidence.compareReceipt(recorded.id);
    const reviewCommand = {
      receiptId: recorded.id,
      decision: "accepted" as const,
      rationale: "Original rationale",
      expectedComparison: compared.token,
    };
    const review = await queuedMutation(
      repository,
      () => tracer.evidence.review(reviewCommand, origin),
      () => {
        reviewCommand.receiptId = "absent";
        reviewCommand.rationale = "Mutated";
        reviewCommand.expectedComparison = "stale";
      },
    );
    assert.equal(review.receiptId, recorded.id);
    assert.equal(review.rationale, "Original rationale");
    assert.equal((await tracer.evidence.compareReceipt(recorded.id)).review.state, "accepted");
    const query = { subject: output.id, limit: 1 };
    const listed = await queuedMutation(
      repository,
      () => tracer.evidence.list("receipt", query),
      () => {
        query.subject = "absent";
        query.limit = 1000;
      },
    );
    assert.equal(listed.items.length, 1);
    assert.equal((listed.items[0] as Receipt).output.id, output.id);
    assert.ok(listed.nextAfter);
  } finally {
    repository.close();
  }
});

test("an observer cannot mutate recorded locator intent or its returned state after validation while the append waits", async () => {
  const { repository, tracer, input } = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let queued!: () => void;
  const appendQueued = new Promise<void>((resolve) => {
    queued = resolve;
  });
  let held: Promise<void> | undefined;
  try {
    await tracer.evidence.bindExternal(
      { entityId: input.id, system: "file", externalId: "provider-input", ownership: "external" },
      origin,
    );
    let transactions = 0;
    const observedRepository: Repository = {
      transaction: (work) => {
        if (++transactions === 2) queued();
        return repository.transaction(work);
      },
      close: () => repository.close(),
    };
    const state = {
      availability: "available" as const,
      hash: "sha256:" + "a".repeat(64),
      metadata: { phase: "original", details: ["original"] },
    };
    const command = {
      entityId: input.id,
      locator: { system: "file" as const, path: "intended.txt" },
    };
    const evidence = new EvidenceService(
      observedRepository,
      () => crypto.randomUUID(),
      async (location) => {
        assert.equal(Object.getPrototypeOf(location), Object.prototype);
        assert.deepEqual(location, command.locator);
        assert.notEqual(location, command.locator);
        location.path = "provider-mutated.txt";
        held = repository.transaction(async () => {
          await gate;
        });
        return state;
      },
    );
    const pending = evidence.observe(command, origin);
    await appendQueued;
    state.hash = "sha256:" + "b".repeat(64);
    state.metadata.phase = "provider-mutated";
    state.metadata.details.push("provider-mutated");
    release();
    const captured = await pending;
    await held;
    assert.deepEqual(captured.locator, { system: "file", path: "intended.txt" });
    assert.equal(captured.hash, "sha256:" + "a".repeat(64));
    assert.deepEqual((captured as Observation & { metadata: typeof state.metadata }).metadata, {
      phase: "original",
      details: ["original"],
    });
    assert.deepEqual((await tracer.evidence.list("observation", { subject: input.id })).items, [
      captured,
    ]);
    assert.deepEqual(command.locator, { system: "file", path: "intended.txt" });
  } finally {
    release();
    await held;
    repository.close();
  }
});
