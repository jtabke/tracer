import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import type { ChangesetInput } from "../src/application/commands.ts";
import type { ViewSave } from "../src/application/saved-views.ts";
import type { CoverageSet, CoverageEvaluationQuery } from "../src/core/coverage.ts";
import type { ReceiptInput, ReviewInput } from "../src/core/evidence.ts";
import type { Entity, Schema } from "../src/core/model.ts";
import { validateProvenance } from "../src/core/model.ts";

const actor = { actor: "queued-input-qa", reason: "Original invocation" };

test("provenance rejects own visible/hidden accessors without invocation or public command writes while ignoring unrelated metadata", async () => {
  const { repository, tracer, root, output } = await fixture();
  try {
    let reads = 0;
    const before = await tracer.history(),
      head = (await tracer.timeline()).head;
    for (const name of ["actor", "reason"])
      for (const enumerable of [true, false]) {
        const origin = Object.defineProperty({ actor: actor.actor }, name, {
          enumerable,
          get() {
            reads++;
            throw new Error("Caller getter must not run");
          },
        });
        assert.throws(() => validateProvenance(origin), { code: "validation" });
        await assert.rejects(tracer.setSchema(structuredClone(schema), 1, origin), {
          code: "validation",
        });
        assert.throws(
          () =>
            tracer.evidence.recordReceipt(
              { outputId: output.id, outcome: "Must not capture", inputs: [{ entityId: root.id }] },
              origin,
            ),
          { code: "validation" },
        );
      }
    const inherited = Object.create(
      Object.defineProperty({}, "actor", {
        get() {
          reads++;
          return actor.actor;
        },
      }),
    );
    assert.throws(() => validateProvenance(inherited), { code: "validation" });
    assert.equal(reads, 0);
    assert.deepEqual(await tracer.history(), before);
    assert.equal((await tracer.timeline()).head, head);
    assert.deepEqual((await tracer.evidence.list("receipt")).items, []);
    const extra = Object.defineProperty({ ...actor }, "ignoredDiagnostic", {
      enumerable: true,
      get() {
        reads++;
        throw new Error("Unknown provenance is not read");
      },
    });
    assert.deepEqual(validateProvenance(extra), actor);
    const captured = await tracer.evidence.recordReceipt(
      { outputId: output.id, outcome: "Explicit valid capture", inputs: [{ entityId: root.id }] },
      extra,
    );
    assert.equal(captured.actor, actor.actor);
    assert.equal(captured.reason, actor.reason);
    assert.equal(reads, 0);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});
const schema: Schema = {
  entityTypes: {
    item: {
      fields: { title: { type: "string" }, note: { type: "string" }, payload: { type: "json" } },
    },
    other: { fields: { title: { type: "string" } } },
  },
  relationshipTypes: { dependency: { fields: {} }, references: { fields: {} } },
};
async function fixture() {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, actor);
  const entities: Entity[] = [];
  for (const title of ["Root", "Other", "Output"])
    entities.push(await tracer.createEntity({ type: "item", fields: { title } }, 1, actor));
  return { repository, tracer, root: entities[0], other: entities[1], output: entities[2] };
}

/** Holds the real SQLite transaction queue; invocation and caller mutation happen before release. */
async function queued<T>(
  repository: SQLiteRepository,
  invoke: () => Promise<T>,
  mutate: () => void,
): Promise<T> {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  const blocker = repository.transaction(async () => {
    entered();
    await gate;
  });
  await started;
  let result!: Promise<T>;
  try {
    result = invoke();
    mutate();
  } finally {
    release();
    await blocker;
  }
  return result;
}

test("queued schema validation and persistence use one detached input even when the caller replaces fields with getters", async () => {
  const { repository, tracer } = await fixture();
  try {
    const next = structuredClone(schema),
      origin = { ...actor };
    next.entityTypes.item.fields.added = { type: "boolean" };
    let reads = 0;
    const saved = await queued(
      repository,
      () => tracer.setSchema(next, 1, origin),
      () => {
        Object.defineProperty(next.entityTypes.item.fields.title, "type", {
          enumerable: true,
          get() {
            reads++;
            return "invalid";
          },
        });
        next.entityTypes.other.fields.title.type = "number";
        origin.actor = "Mutated actor";
      },
    );
    assert.equal(reads, 0);
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.entityTypes.item.fields.title, { type: "string" });
    assert.deepEqual(saved.entityTypes.other.fields.title, { type: "string" });
    assert.deepEqual(saved.entityTypes.item.fields.added, { type: "boolean" });
    assert.deepEqual(await tracer.getSchema(), saved);
    assert.equal((await tracer.changesets()).at(-1)?.actor, actor.actor);
  } finally {
    repository.close();
  }
});

test("queued changesets retain operation count, nested fields and original entity/schema guards", async () => {
  const { repository, tracer, root } = await fixture();
  try {
    const fields = { title: "Requested record", payload: { values: [1] } },
      input: ChangesetInput = {
        expectedSchemaVersion: 1,
        operations: [{ op: "entity.create", input: { type: "item", fields } }],
      };
    const saved = await queued(
      repository,
      () => tracer.applyChangeset(input, actor),
      () => {
        fields.title = "Caller changed title";
        fields.payload.values.push(2);
        input.operations.push(
          ...Array.from({ length: 1000 }, (): ChangesetInput["operations"][number] => ({
            op: "entity.create",
            input: { type: "item", fields: { title: "Not requested" } },
          })),
        );
      },
    );
    assert.equal(saved.results.length, 1);
    assert.deepEqual((saved.results[0] as Entity).fields, {
      title: "Requested record",
      payload: { values: [1] },
    });
    assert.equal((await tracer.queryEntities()).items.length, 4);
    const edit = {
      op: "entity.update" as const,
      id: root.id,
      expectedVersion: 1,
      input: { fields: { title: "Original queued update" } },
    };
    let prior!: Promise<Entity>;
    const head = (await tracer.timeline()).head;
    await assert.rejects(
      queued(
        repository,
        () => {
          prior = tracer.updateEntity(
            root.id,
            1,
            { fields: { title: "Earlier queued update" } },
            1,
            actor,
          );
          return tracer.applyChangeset({ expectedSchemaVersion: 1, operations: [edit] }, actor);
        },
        () => {
          edit.expectedVersion = 2;
          edit.input.fields.title = "Silently rebased caller update";
        },
      ),
      { code: "conflict" },
    );
    assert.equal((await prior).version, 2);
    assert.equal((await tracer.timeline()).head, head + 1);
    assert.equal(
      (await tracer.queryEntities({ key: root.key })).items.find((item) => item.id === root.id)
        ?.fields.title,
      "Earlier queued update",
    );
    const stale: ChangesetInput = {
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.create", input: { type: "item", fields: { title: "Must remain stale" } } },
      ],
    };
    let schemaWrite!: ReturnType<Tracer["setSchema"]>;
    await assert.rejects(
      queued(
        repository,
        () => {
          schemaWrite = tracer.setSchema(structuredClone(schema), 1, actor);
          return tracer.applyChangeset(stale, actor);
        },
        () => {
          stale.expectedSchemaVersion = 2;
        },
      ),
      { code: "schema_conflict" },
    );
    await schemaWrite;
    assert.equal((await tracer.queryEntities()).items.length, 4);
  } finally {
    repository.close();
  }
});

test("queued receipts/reviews capture original declarations and judgments without silently rebasing stale tokens", async () => {
  const { repository, tracer, root, output } = await fixture();
  try {
    const input: ReceiptInput = {
      outputId: output.id,
      expectedOutputVersion: 1,
      outcome: "PASS",
      inputs: [{ entityId: root.id, expectedVersion: 1, fields: ["title"] }],
    };
    const receipt = await queued(
      repository,
      () => tracer.evidence.recordReceipt(input, actor),
      () => {
        input.outcome = "";
        input.inputs.length = 0;
        input.outputId = root.id;
      },
    );
    assert.equal(receipt.outcome, "PASS");
    assert.equal(receipt.output.id, output.id);
    assert.equal(receipt.inputs.length, 1);
    assert.deepEqual(receipt.inputs[0].fields, ["title"]);
    const comparison = await tracer.evidence.compareReceipt(receipt.id);
    const reviewInput: ReviewInput = {
      receiptId: receipt.id,
      decision: "accepted",
      rationale: "Original judgment",
      expectedComparison: comparison.token,
    };
    const review = await queued(
      repository,
      () => tracer.evidence.review(reviewInput, actor),
      () => {
        reviewInput.decision = "needs_reevaluation";
        reviewInput.rationale = "";
        reviewInput.expectedComparison = "changed-after-invocation";
      },
    );
    assert.equal(review.decision, "accepted");
    assert.equal(review.rationale, "Original judgment");
    assert.equal(review.token, comparison.token);
    await tracer.updateEntity(root.id, 1, { fields: { title: "Relevant native drift" } }, 1, actor);
    const fresh = await tracer.evidence.compareReceipt(receipt.id),
      stale: ReviewInput = {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Must stay stale",
        expectedComparison: comparison.token,
      };
    await assert.rejects(
      queued(
        repository,
        () => tracer.evidence.review(stale, actor),
        () => {
          stale.expectedComparison = fresh.token;
        },
      ),
      { code: "conflict" },
    );
    assert.equal((await tracer.evidence.list("review")).items.length, 1);
    await tracer.updateEntity(output.id, 1, { fields: { title: "Output changed" } }, 1, actor);
    const staleCapture: ReceiptInput = {
      outputId: output.id,
      expectedOutputVersion: 1,
      outcome: "Must stay stale",
      inputs: [{ entityId: root.id }],
    };
    await assert.rejects(
      queued(
        repository,
        () => tracer.evidence.recordReceipt(staleCapture, actor),
        () => {
          staleCapture.expectedOutputVersion = 2;
        },
      ),
      { code: "conflict" },
    );
    assert.deepEqual((await tracer.evidence.list("receipt")).items, [receipt]);
  } finally {
    repository.close();
  }
});

test("queued configuration/baseline metadata capture original identities, names, revisions and guards", async () => {
  const { repository, tracer, root, other, output } = await fixture();
  try {
    const before = await tracer.history(),
      head = (await tracer.timeline()).head;
    const input = {
      name: "Original configuration",
      subjectId: output.id,
      expectedSubjectVersion: 1,
      members: [{ entityId: root.id, version: 1 }],
    };
    const configuration = await queued(
      repository,
      () => tracer.configurations.capture(input, actor),
      () => {
        input.name = "Changed";
        input.subjectId = other.id;
        input.expectedSubjectVersion = 0;
        input.members[0].entityId = other.id;
      },
    );
    assert.equal(configuration.name, "Original configuration");
    assert.equal(configuration.subject.id, output.id);
    assert.equal(configuration.members[0].entity.id, root.id);
    assert.equal(configuration.members[0].entity.version, 1);
    const proposal = {
      id: "original-queued-baseline",
      name: "Original baseline",
      expectedProjectRevision: head,
    };
    const baseline = await queued(
      repository,
      () => tracer.baselines.capture(proposal, actor),
      () => {
        proposal.id = "changed-identity";
        proposal.name = "Changed name";
        proposal.expectedProjectRevision = head + 100;
      },
    );
    assert.equal(baseline.id, "original-queued-baseline");
    assert.equal(baseline.name, "Original baseline");
    assert.equal(baseline.projectRevision, head);
    assert.deepEqual(await tracer.history(), before);
    await tracer.updateEntity(root.id, 1, { fields: { title: "Later native head" } }, 1, actor);
    const laterHead = (await tracer.timeline()).head,
      stale = { name: "Stale baseline", expectedProjectRevision: head };
    await assert.rejects(
      queued(
        repository,
        () => tracer.baselines.capture(stale, actor),
        () => {
          stale.expectedProjectRevision = laterHead;
        },
      ),
      { code: "conflict" },
    );
    assert.deepEqual((await tracer.baselines.list()).items, [baseline]);
  } finally {
    repository.close();
  }
});

test("queued saved-view creation cannot mutate into an update of an existing identity/version", async () => {
  const { repository, tracer, root, other } = await fixture();
  try {
    const definition: ViewSave["definition"] = {
      kind: "family",
      rootId: root.id,
      direction: "outgoing",
      layout: "trace",
      columns: [{ relationshipType: "dependency", targetType: "item", direction: "outgoing" }],
    };
    const existing = await tracer.savedViews.save({
      name: "Existing",
      definition,
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    });
    const revised = await tracer.savedViews.save({
      id: existing.id,
      name: "Existing revised",
      definition,
      expectedVersion: 1,
      expectedSchemaVersion: 1,
    });
    const before = await tracer.history();
    const proposal: ViewSave = {
      name: "Original new view",
      definition: structuredClone(definition),
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    };
    const saved = await queued(
      repository,
      () => tracer.savedViews.save(proposal),
      () => {
        proposal.id = existing.id;
        proposal.expectedVersion = 2;
        proposal.name = "Changed name";
        if (proposal.definition.kind === "family") proposal.definition.rootId = other.id;
      },
    );
    assert.notEqual(saved.id, existing.id);
    assert.equal(saved.version, 1);
    assert.equal(saved.name, "Original new view");
    assert.deepEqual(saved.definition, definition);
    assert.deepEqual(
      (await tracer.savedViews.list()).find((view) => view.id === existing.id),
      revised,
    );
    assert.equal((await tracer.savedViews.list()).length, 2);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});

test("queued coverage policy/read and impact contexts retain one captured scope, head guard and historical boundary", async () => {
  const { repository, tracer, root, other } = await fixture();
  try {
    const old = await tracer.baselines.capture(
      {
        name: "Before policy and topology",
        expectedProjectRevision: (await tracer.timeline()).head,
      },
      actor,
    );
    const policy: CoverageSet = {
      expectedSchemaVersion: 1,
      expectations: {
        original: {
          name: "Original policy",
          subject: { type: "item" },
          relationshipType: "dependency",
          direction: "outgoing",
          related: { type: "item" },
          minimumDistinctTargets: 1,
        },
        alternate: {
          name: "Other population",
          subject: { type: "other" },
          relationshipType: "dependency",
          direction: "outgoing",
          related: { type: "item" },
          minimumDistinctTargets: 1,
        },
      },
    };
    const expected = structuredClone(policy.expectations);
    const saved = await queued(
      repository,
      () => tracer.coverage.set(policy, actor),
      () => {
        policy.expectedSchemaVersion = 2;
        policy.expectations.original.minimumDistinctTargets = 0;
        policy.expectations.original.subject.type = "other";
      },
    );
    assert.deepEqual(saved.coverageExpectations, expected);
    assert.equal(saved.version, 2);
    const link = await tracer.createRelationship(
      { type: "dependency", source: root.id, target: other.id, fields: {} },
      2,
      actor,
    );
    const head = (await tracer.timeline()).head,
      current = await tracer.baselines.capture(
        { name: "After policy and topology", expectedProjectRevision: head },
        actor,
      );
    let getterReads = 0;
    const coverageQuery: CoverageEvaluationQuery = {
      expectationId: "original",
      expectedProjectRevision: head,
      limit: 1,
    };
    const result = await queued(
      repository,
      () => tracer.coverage.evaluate(coverageQuery),
      () => {
        coverageQuery.expectationId = "alternate";
        coverageQuery.limit = 100;
        Object.defineProperty(coverageQuery, "expectedProjectRevision", {
          get() {
            getterReads++;
            return 0;
          },
        });
      },
    );
    assert.equal(result.expectationId, "original");
    assert.equal(result.rows.items.length, 1);
    assert.equal(result.context.projectRevision, head);
    const catalogueQuery = { baselineId: old.id };
    const catalogue = await queued(
      repository,
      () => tracer.coverage.list(catalogueQuery),
      () => {
        catalogueQuery.baselineId = current.id;
      },
    );
    assert.equal(catalogue.context.baseline?.id, old.id);
    assert.deepEqual(catalogue.expectations, {});
    const impactQuery = {
      baselineId: old.id,
      rootId: root.id,
      direction: "outgoing" as const,
      relationshipTypes: ["dependency"],
      expectedProjectRevision: head,
    };
    const impact = await queued(
      repository,
      () => tracer.getChangeImpact(impactQuery),
      () => {
        impactQuery.baselineId = current.id;
        impactQuery.rootId = other.id;
        impactQuery.relationshipTypes.length = 0;
        Object.defineProperty(impactQuery, "expectedProjectRevision", {
          get() {
            getterReads++;
            return 0;
          },
        });
      },
    );
    assert.equal(getterReads, 0);
    assert.equal(impact.context.baseline.id, old.id);
    assert.deepEqual(impact.scope, {
      rootId: root.id,
      direction: "outgoing",
      relationshipTypes: ["dependency"],
      depth: 2,
    });
    assert.equal(impact.native.relationships.find((value) => value.id === link.id)?.state, "added");
    assert.equal(impact.context.projectRevision, head);
  } finally {
    repository.close();
  }
});

test("queued native queries preserve invoked limits, filters and graph root instead of mixing live caller scope", async () => {
  const { repository, tracer, root, other } = await fixture();
  try {
    for (let i = 0; i < 22; i++)
      await tracer.createEntity({ type: "item", fields: { title: `Extra ${i}` } }, 1, actor);
    const before = await tracer.history(),
      chainQuery = { type: "item", steps: [], limit: 20 };
    const chain = await queued(
      repository,
      () => tracer.getChain(chainQuery),
      () => {
        chainQuery.limit = 1000;
      },
    );
    assert.equal(chain.roots.items.length, 20);
    assert.ok(chain.roots.nextAfter);
    const workQuery = { type: "item", field: "title", value: "Root", limit: 1 };
    const work = await queued(
      repository,
      () => tracer.getWorkingSet(workQuery),
      () => {
        workQuery.value = "Other";
        workQuery.limit = 1000;
      },
    );
    assert.deepEqual(
      work.entities.items.map((entity) => entity.id),
      [root.id],
    );
    const graphQuery = { rootId: root.id, depth: 1, expanded: [] as string[] };
    const graph = await queued(
      repository,
      () => tracer.getGraph(graphQuery),
      () => {
        graphQuery.rootId = other.id;
        graphQuery.depth = 6;
        graphQuery.expanded.push("unreached-caller-id");
      },
    );
    assert.equal(graph.rootId, root.id);
    assert.deepEqual(
      graph.nodes.map((entity) => entity.id),
      [root.id],
    );
    assert.equal(graph.trace?.depth, 1);
    assert.deepEqual(await tracer.history(), before);
  } finally {
    repository.close();
  }
});
