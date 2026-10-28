import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/index.ts";
import type { Entity, NextWorkQuery, Repository, Schema, Transaction } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";

const origin = { actor: "next-work engineer", reason: "Inspect separate engineering queues" };
async function fixture(run: (tracer: Tracer, repository: SQLiteRepository) => Promise<void>) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository, undefined, async () => {
      throw new Error("Queue reads must not observe external sources");
    });
    await tracer.setSchema(projectTemplates.engineering.schema, 0, origin);
    await run(tracer, repository);
  } finally {
    repository.close();
  }
}
const requirement = (tracer: Tracer, key: string, statement?: string) =>
  tracer.createEntity(
    {
      type: "requirement",
      key,
      fields: { title: key, ...(statement === undefined ? {} : { statement }) },
    },
    1,
    origin,
  );
const output = (tracer: Tracer, key = "TEST-1") =>
  tracer.createEntity({ type: "test", key, fields: { title: "SIMULATED result" } }, 1, origin);
async function review(
  tracer: Tracer,
  id: string,
  decision: "accepted" | "acknowledged" | "needs_reevaluation",
) {
  return tracer.evidence.review(
    {
      receiptId: id,
      decision,
      rationale: `Recorded ${decision}`,
      expectedComparison: (await tracer.evidence.compareReceipt(id)).token,
    },
    origin,
  );
}
function decorate(
  repository: SQLiteRepository,
  wrap: (tx: Transaction) => Transaction,
): Repository {
  return { close() {}, transaction: (work) => repository.transaction((tx) => work(wrap(tx))) };
}

test("Engineering statement, allocation and plan gaps are independent, exhaustive and read only", async () =>
  fixture(async (tracer) => {
    const absent = await requirement(tracer, "REQ-ABSENT");
    await requirement(tracer, "REQ-WHITESPACE", " \n\t ");
    const complete = await requirement(tracer, "REQ-READY", "Measure CO₂ at 1 Hz");
    const design = await tracer.createEntity(
      { type: "design", key: "DES-1", fields: { title: "Sensor design" } },
      1,
      origin,
    );
    const plan = await output(tracer);
    const connect = (source: string, target: string) =>
      tracer.createRelationship({ type: "mapped_to", source, target, fields: {} }, 1, origin);
    await connect(complete.id, design.id);
    await connect(complete.id, design.id);
    await connect(complete.id, plan.id);
    const before = await tracer.exportProject();
    let value = await tracer.getNextWork();
    const keys = (items: { key?: string }[]) => items.map((item) => item.key).sort();
    assert.deepEqual(keys(value.queues.statements.items), ["REQ-ABSENT", "REQ-WHITESPACE"]);
    assert.deepEqual(keys(value.queues.allocation.items), ["REQ-ABSENT", "REQ-WHITESPACE"]);
    assert.deepEqual(keys(value.queues.verification.items), ["REQ-ABSENT", "REQ-WHITESPACE"]);
    assert.equal(value.queues.statements.evaluated, 3);
    assert.equal(value.queues.reviews.items.length, 0);
    assert.deepEqual(await tracer.exportProject(), before);
    await tracer.updateEntity(
      absent.id,
      1,
      { fields: { title: "Requirement", statement: "Detect elevated CO₂" } },
      1,
      origin,
    );
    await connect(absent.id, design.id);
    value = await tracer.getNextWork();
    assert.equal(value.queues.statements.items.length, 1);
    assert.equal(value.queues.allocation.items.length, 1);
    assert.equal(value.queues.verification.items.length, 2);
    await connect(absent.id, plan.id);
    assert.equal((await tracer.getNextWork()).queues.verification.items.length, 1);
  }));

test("custom model choices honor policy direction, populations and target filters without calling partial allocations unallocated", async () => {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    const schema: Schema = {
      entityTypes: {
        need: { fields: { description: { type: "string" }, applicable: { type: "boolean" } } },
        solution: { fields: { approved: { type: "boolean" } } },
      },
      relationshipTypes: { satisfies: { source: ["solution"], target: ["need"], fields: {} } },
      coverageExpectations: {
        allocations: {
          name: "Approved solutions",
          subject: { type: "need", filter: { field: "applicable", equals: true } },
          related: { type: "solution", filter: { field: "approved", equals: true } },
          relationshipType: "satisfies",
          direction: "incoming",
          minimumDistinctTargets: 2,
        },
      },
    };
    await tracer.setSchema(schema, 0, origin);
    const need = await tracer.createEntity(
      { type: "need", fields: { applicable: true } },
      1,
      origin,
    );
    await tracer.createEntity({ type: "need", fields: { applicable: false } }, 1, origin);
    const solution = await tracer.createEntity(
      { type: "solution", fields: { approved: false } },
      1,
      origin,
    );
    await tracer.createRelationship(
      { type: "satisfies", source: solution.id, target: need.id, fields: {} },
      1,
      origin,
    );
    const defaults = await tracer.getNextWork();
    assert.equal(defaults.queues.statements.available, false);
    assert.equal(defaults.queues.allocation.available, false);
    const query = {
      requirementType: "need",
      statementField: "description",
      allocationExpectationId: "allocations",
      verificationExpectationId: "",
    };
    let selected = await tracer.getNextWork(query);
    assert.equal(selected.queues.statements.items.length, 2);
    assert.equal(selected.queues.allocation.evaluated, 1);
    assert.deepEqual(
      selected.queues.allocation.items.map((item) => item.id),
      [need.id],
    );
    await tracer.updateEntity(solution.id, 1, { fields: { approved: true } }, 1, origin);
    selected = await tracer.getNextWork(query);
    assert.equal(selected.queues.allocation.items.length, 0);
    assert.equal(
      (await tracer.coverage.evaluate({ expectationId: "allocations" })).rows.items[0].state,
      "missing",
    );
    assert.equal(selected.queues.verification.available, false);
    assert.equal(
      (await tracer.getNextWork({ requirementType: "need" })).queues.statements.available,
      false,
    );
  } finally {
    repository.close();
  }
});

test("changed declared inputs, outcomes and unresolved decisions stay distinct, including retired tokens and supersession", async () =>
  fixture(async (tracer) => {
    const input = await requirement(tracer, "REQ-1", "Original statement");
    const testOutput = await output(tracer);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: testOutput.id,
        outcome: "SIMULATED failed",
        inputs: [{ entityId: input.id, fields: ["statement"] }],
      },
      origin,
    );
    assert.equal((await tracer.getNextWork()).queues.changedEvidence.items.length, 0);
    assert.equal((await tracer.getNextWork()).queues.reviews.items.length, 1);
    await review(tracer, receipt.id, "needs_reevaluation");
    assert.equal(
      (await tracer.getNextWork()).queues.reviews.items[0].reviewState,
      "needs_reevaluation",
    );
    await review(tracer, receipt.id, "accepted");
    await tracer.updateEntity(
      input.id,
      1,
      { fields: { title: "Unrelated title edit", statement: "Original statement" } },
      1,
      origin,
    );
    assert.equal((await tracer.getNextWork()).queues.changedEvidence.items.length, 0);
    assert.equal((await tracer.getNextWork()).queues.reviews.items.length, 0);
    await tracer.updateEntity(
      input.id,
      2,
      { fields: { title: "Tightened requirement", statement: "Changed statement" } },
      1,
      origin,
    );
    let work = await tracer.getNextWork();
    assert.equal(work.queues.changedEvidence.items[0].changedInputs, 1);
    assert.equal(work.queues.reviews.items[0].reviewState, "unreviewed");
    assert.match(
      work.queues.reviews.items[0].reviewReason,
      /Previous accepted decision no longer applies/,
    );
    await review(tracer, receipt.id, "needs_reevaluation");
    work = await tracer.getNextWork();
    assert.equal(work.queues.changedEvidence.items.length, 1);
    assert.equal(work.queues.reviews.items.length, 1);
    await review(tracer, receipt.id, "acknowledged");
    work = await tracer.getNextWork();
    assert.equal(work.queues.changedEvidence.items.length, 1);
    assert.equal(work.queues.changedEvidence.items[0].outcome, "SIMULATED failed");
    assert.equal(work.queues.reviews.items.length, 0);
    const replacement = await tracer.evidence.recordReceipt(
      {
        outputId: testOutput.id,
        outcome: "SIMULATED replacement",
        supersedes: receipt.id,
        inputs: [{ entityId: input.id }],
      },
      origin,
    );
    work = await tracer.getNextWork();
    assert.equal(work.queues.changedEvidence.items.length, 0);
    assert.deepEqual(
      work.queues.reviews.items.map((item) => item.receiptId),
      [replacement.id],
    );
    assert.equal((await tracer.evidence.getReceipt(receipt.id)).inputs[0].entity.version, 1);
  }));

test("unknown native/external inputs require a review without being mislabeled as confirmed content changes", async () =>
  fixture(async (tracer, repository) => {
    const input = await requirement(tracer, "REQ-UNKNOWN", "Input");
    const plan = await output(tracer);
    await tracer.evidence.bindExternal(
      { entityId: input.id, system: "file", externalId: "external-file", ownership: "external" },
      origin,
    );
    const observer = new Tracer(repository, undefined, async () => ({
      availability: "unknown",
      reason: "File unavailable",
    }));
    const observation = await observer.evidence.observe(
      { entityId: input.id, locator: { system: "file", path: "/not/present.csv" } },
      origin,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: plan.id,
        outcome: "SIMULATED unknown",
        inputs: [{ entityId: input.id, observationId: observation.id }],
      },
      origin,
    );
    await tracer.removeEntity(input.id, 1, 1, origin);
    const work = await tracer.getNextWork();
    assert.equal(work.queues.changedEvidence.items.length, 0);
    assert.equal(work.queues.reviews.items[0].unknownInputs, 1);
    await assert.rejects(review(tracer, receipt.id, "accepted"), /Cannot accept/);
    await review(tracer, receipt.id, "acknowledged");
    assert.equal((await tracer.getNextWork()).queues.reviews.items.length, 0);
  }));

test("every native/coverage/evidence page contributes to complete independent queue counts", async () =>
  fixture(async (tracer) => {
    const requirements: Entity[] = [];
    for (let index = 0; index < 101; index++)
      requirements.push(await requirement(tracer, `REQ-${index}`));
    const design = await tracer.createEntity(
      { type: "design", fields: { title: "Shared design" } },
      1,
      origin,
    );
    const plan = await output(tracer);
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: requirements.slice(0, 100).flatMap((item) =>
          [design, plan].map((target) => ({
            op: "relationship.create" as const,
            input: { type: "mapped_to", source: item.id, target: target.id, fields: {} },
          })),
        ),
      },
      origin,
    );
    for (let index = 0; index < 101; index++)
      await tracer.evidence.recordReceipt(
        { outputId: plan.id, outcome: "SIMULATED", inputs: [{ entityId: requirements[100].id }] },
        origin,
      );
    await tracer.updateEntity(requirements[100].id, 1, { fields: { title: "Changed" } }, 1, origin);
    const work = await tracer.getNextWork();
    assert.equal(work.queues.statements.items.length, 101);
    assert.equal(work.queues.allocation.items.length, 1);
    assert.equal(work.queues.verification.items.length, 1);
    assert.equal(work.queues.allocation.items[0].id, requirements[100].id);
    assert.equal(work.queues.changedEvidence.items.length, 101);
    assert.equal(work.queues.reviews.items.length, 101);
  }));

test("invalid selections, unknown properties and exceeded bounds reject without partial queues or writes", async () =>
  fixture(async (tracer, repository) => {
    const input = await requirement(tracer, "REQ-1");
    const before = await tracer.exportProject();
    for (const query of [
      null,
      [],
      { requirementTypo: "requirement" },
      { requirementType: "absent" },
      { statementField: "acceptance_typo" },
      { allocationExpectationId: "design_verification" },
      { allocationExpectationId: "constructor" },
      { requirementType: 1 },
      { requirementType: "x".repeat(201) },
    ])
      await assert.rejects(tracer.getNextWork(query as NextWorkQuery), { code: "validation" });
    const tooMany = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        query: async () => ({ items: Array(10_001).fill(input) }),
      })),
    );
    await assert.rejects(tooMany.getNextWork(), /10,000 requirements/);
    const bytes = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        query: async () => ({
          items: Array(600).fill({ ...input, fields: { title: "x".repeat(16_384) } }),
        }),
      })),
    );
    await assert.rejects(bytes.getNextWork(), /8 MiB/);
    const unknownCoverage = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        coveragePage: async () => ({
          items: [
            {
              subject: input,
              distinctTargets: null,
              matchingRelationships: null,
              unresolvedRelationships: 1,
              samples: [],
              samplesComplete: false,
            },
          ],
        }),
      })),
    );
    await assert.rejects(unknownCoverage.getNextWork(), /cannot resolve/);
    const plan = await output(tracer);
    const receipt = await tracer.evidence.recordReceipt(
      { outputId: plan.id, outcome: "SIMULATED", inputs: [{ entityId: input.id }] },
      origin,
    );
    const receipts = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        evidence: async (kind, query) => {
          const page = await tx.evidence(kind, query);
          return kind === "receipt"
            ? { ...page, items: Array.from({ length: 2001 }, () => page.items[0]) }
            : page;
        },
      })),
    );
    await assert.rejects(receipts.getNextWork(), /2,000 recorded results/);
    const largeInputs = {
      ...receipt,
      inputs: Array(10_001).fill({ entityId: input.id, entity: input, links: [] }),
    };
    const inputs = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        evidence: async (kind, query) => {
          const page = await tx.evidence(kind, query);
          return kind === "receipt"
            ? { ...page, items: page.items.map((row) => ({ ...row, inputs: largeInputs.inputs })) }
            : page;
        },
      })),
    );
    await assert.rejects(inputs.getNextWork(), /10,000 declared inputs/);
    assert.equal(
      (await tracer.exportProject()).provenance.changesets.length,
      before.provenance.changesets.length + 1,
    );
  }));

test("queue snapshot cannot mix an intervening native write, while read failures leave history usable", async () =>
  fixture(async (tracer, repository) => {
    const input = await requirement(tracer, "REQ-1");
    const before = await tracer.getNextWork();
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reader = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        query: async (kind, query) => {
          enter();
          await released;
          return tx.query(kind, query);
        },
      })),
    );
    const pending = reader.getNextWork();
    await entered;
    const writing = tracer.updateEntity(
      input.id,
      1,
      { fields: { title: "Complete", statement: "Complete" } },
      1,
      origin,
    );
    release();
    assert.deepEqual(await pending, before);
    await writing;
    assert.equal((await tracer.getNextWork()).queues.statements.items.length, 0);
    const broken = new Tracer(
      decorate(repository, (tx) => ({
        ...tx,
        coveragePage: async () => {
          throw new Error("Read failed");
        },
      })),
    );
    await assert.rejects(broken.getNextWork(), { code: "storage" });
    assert.equal((await tracer.getNextWork()).projectRevision, before.projectRevision + 1);
  }));

test("empty projects distinguish unconfigured queues from zero work and CLI/HTTP preserve the shared result", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-next-work-"));
  const path = join(directory, "project.sqlite");
  const repository = new SQLiteRepository(path),
    otherRepository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository),
    other = new Tracer(otherRepository);
  const server = await startLocalServer(tracer, directory, 0, undefined, [
    { id: "other", title: "Other", tracer: other },
  ]);
  try {
    const empty = await tracer.getNextWork();
    assert.equal(empty.queues.statements.available, false);
    assert.equal(empty.queues.reviews.available, true);
    assert.equal(empty.queues.reviews.items.length, 0);
    assert.equal(empty.projectRevision, 0);
    await tracer.setSchema(projectTemplates.engineering.schema, 0, origin);
    await requirement(tracer, "REQ-1");
    const work = await tracer.getNextWork();
    assert.deepEqual(await (await fetch(server.origin + "/api/next-work")).json(), work);
    assert.deepEqual(
      await (
        await fetch(server.origin + "/api/next-work", { headers: { "x-tracer-project": "other" } })
      ).json(),
      empty,
    );
    assert.equal((await fetch(server.origin + "/api/next-work?queue=unknown")).status, 400);
    assert.equal(
      (await fetch(server.origin + "/api/next-work?statementField=statement&statementField=title"))
        .status,
      400,
    );
    assert.deepEqual(decodeRead("/api/next-work", {}, work), work);
    assert.throws(
      () => decodeRead("/api/next-work", {}, { ...work, queues: {} }),
      /Invalid API response/,
    );
    const cli = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        path,
        "next-work",
        "get",
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), work);
    assert.equal((await tracer.getNextWork()).projectRevision, work.projectRevision);
  } finally {
    await server.close();
    repository.close();
    otherRepository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
