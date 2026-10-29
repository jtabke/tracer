import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import { referenceUseFixture } from "./reference-use-fixture.ts";
import { verificationActor } from "./verification-fixture.ts";
import { Configurations } from "../src/application/configurations.ts";
import {
  configurationCaptureFixture,
  configurationActor as actor,
} from "./configuration-capture-fixture.ts";

test("pair discovery distinguishes changed declared fields, unchanged uses and excluded output-only connections", async () => {
  const f = await configurationCaptureFixture();
  try {
    const changed = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "failed remains failed",
        inputs: [{ entityId: f.part.id, fields: ["value"] }],
        relationshipInputs: [],
      },
      actor,
    );
    const unaffected = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "not_run remains not_run",
        inputs: [{ entityId: f.part.id, fields: ["title"] }],
        relationshipInputs: [],
      },
      actor,
    );
    const unrelated = await f.tracer.createEntity(
      { type: "item", fields: { title: "Outside pair", value: 1 } },
      1,
      actor,
    );
    const excluded = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Output membership is not a declared dependency",
        inputs: [{ entityId: unrelated.id }],
      },
      actor,
    );
    const before = await f.tracer.configurations.captureExact(await f.input(), actor);
    await f.tracer.updateEntity(f.part.id, 1, { fields: { ...f.part.fields, value: 2 } }, 1, actor);
    const input = await f.input();
    input.members[1].version = 2;
    const after = await f.tracer.configurations.captureExact(input, actor);
    const query = { beforeId: before.id, afterId: after.id };
    const snapshot = await f.tracer.exportProject();
    const result = await f.tracer.configurations.compareDependencies(query);
    assert.equal(result.evaluations.items.length, 2);
    assert.ok(!result.evaluations.items.some((x) => x.receipt.id === excluded.id));
    const c = result.evaluations.items.find((x) => x.receipt.id === changed.id)!;
    assert.equal(c.before.state, "current");
    assert.equal(c.after.state, "changed");
    assert.equal(c.dependencyChange, "changed");
    assert.equal(c.receipt.outcome, changed.outcome);
    assert.deepEqual(c.inclusion, { entityIds: [f.part.id], relationshipIds: [] });
    assert.equal(
      result.evaluations.items.find((x) => x.receipt.id === unaffected.id)!.dependencyChange,
      "unchanged",
    );
    assert.equal(result.completeness.engineeringImpact, "not_assessed");
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    await f.tracer.removeRelationship(f.link.id, 1, 1, actor);
    await f.tracer.removeEntity(f.part.id, 2, 1, actor);
    f.reopen();
    assert.deepEqual(await f.tracer.configurations.compareDependencies(query), result);
    const later = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Later recorded work",
        inputs: [{ entityId: f.material.id, facet: "content", observationId: f.observation.id }],
      },
      actor,
    );
    const refreshed = await f.tracer.configurations.compareDependencies(query);
    assert.deepEqual(refreshed.pair, result.pair);
    assert.notEqual(refreshed.discovery.digest, result.discovery.digest);
    assert.ok(refreshed.evaluations.items.some((x) => x.receipt.id === later.id));
    assert.ok(refreshed.discovery.evidenceRevision > result.discovery.evidenceRevision);
    assert.deepEqual(refreshed.evaluations.items.slice(0, 2), result.evaluations.items);
  } finally {
    f.close();
  }
});

test("path-only inclusion retains unknown out-of-scope terminal dependencies and selected missing topology", async () => {
  const f = await configurationCaptureFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Synthetic path result",
        inputs: [{ entityId: f.part.id, fields: ["value"], path: [f.link.id] }],
        relationshipInputs: [{ id: f.link.id }],
      },
      actor,
    );
    const before = await f.tracer.configurations.captureExact(await f.input(), actor);
    const input = await f.input();
    input.relationships = [];
    input.scope.coverage = "partial";
    const after = await f.tracer.configurations.captureExact(input, actor);
    const result = await f.tracer.configurations.compareDependencies({
      beforeId: before.id,
      afterId: after.id,
    });
    const row = result.evaluations.items.find((x) => x.receipt.id === receipt.id)!;
    assert.deepEqual(row.inclusion.relationshipIds, [f.link.id]);
    assert.equal(row.dependencyChange, "unknown");
    assert.equal(row.after.relationshipInputs![0].current, null);
    assert.equal(row.after.inputs[0].current.links[0], null);
    assert.equal(result.pair.comparability.state, "qualified");
    assert.ok(await f.tracer.getRelationship(f.link.id));
  } finally {
    f.close();
  }
});

test("pair discovery preserves supersession separately from fixed dependency correspondence", async () => {
  const f = await configurationCaptureFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Original result",
        inputs: [{ entityId: f.part.id }],
        relationshipInputs: [],
      },
      actor,
    );
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    const query = { beforeId: target.id, afterId: target.id };
    const original = await f.tracer.configurations.compareDependencies(query);
    const replacement = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Replacement result",
        inputs: [{ entityId: f.part.id }],
        relationshipInputs: [],
        supersedes: receipt.id,
      },
      actor,
    );
    const current = await f.tracer.configurations.compareDependencies(query);
    assert.deepEqual(current.pair, original.pair);
    const row = current.evaluations.items.find((x) => x.receipt.id === receipt.id)!;
    assert.deepEqual(row.before, original.evaluations.items[0].before);
    assert.equal(row.dependencyChange, "unchanged");
    assert.deepEqual(row.supersession, { count: 1, ids: [replacement.id] });
    assert.notEqual(current.discovery.digest, original.discovery.digest);
  } finally {
    f.close();
  }
});

test("legacy missing direct-input metadata remains unknown even for an identical pair", async () => {
  const f = await configurationCaptureFixture();
  try {
    await f.tracer.evidence.recordReceipt(
      { outputId: f.root.id, outcome: "Legacy result", inputs: [{ entityId: f.part.id }] },
      actor,
    );
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    const result = await f.tracer.configurations.compareDependencies({
      beforeId: target.id,
      afterId: target.id,
    });
    assert.equal(result.evaluations.items[0].before.state, "current");
    assert.equal(result.evaluations.items[0].after.state, "current");
    assert.equal(result.evaluations.items[0].dependencyChange, "unknown");
    assert.equal(result.evaluations.items[0].before.relationshipInputs, undefined);
  } finally {
    f.close();
  }
});

test("pair discovery has core, typed HTTP/client and CLI parity and rejects inconsistent wire context", async () => {
  const f = await configurationCaptureFixture();
  let server;
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Synthetic adapter result",
        inputs: [{ entityId: f.part.id }],
        relationshipInputs: [],
      },
      actor,
    );
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Second page",
        inputs: [{ entityId: f.part.id }],
        relationshipInputs: [],
      },
      actor,
    );
    const query = { beforeId: target.id, afterId: target.id, limit: 1 };
    const expected = await f.tracer.configurations.compareDependencies(query);
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["configuration-impact"] },
    });
    await client.connect();
    assert.deepEqual(await client.read("/api/configuration-impact", query), expected);
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "configuration",
        "impact",
        target.id,
        target.id,
        JSON.stringify({ limit: 1 }),
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), expected);
    const continuation = { ...query, after: expected.evaluations.nextAfter };
    const second = await f.tracer.configurations.compareDependencies(continuation);
    assert.deepEqual(await client.read("/api/configuration-impact", continuation), second);
    const nextCli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "configuration",
        "impact",
        target.id,
        target.id,
        JSON.stringify({ limit: 1, after: expected.evaluations.nextAfter }),
      ],
      { encoding: "utf8" },
    );
    assert.equal(nextCli.status, 0, nextCli.stderr);
    assert.deepEqual(JSON.parse(nextCli.stdout), second);
    const row = expected.evaluations.items.find((x) => x.receipt.id === receipt.id)!;
    for (const altered of [
      { ...expected, basis: { ...expected.basis, afterId: "wrong" } },
      { ...expected, discovery: { ...expected.discovery, entityIds: [] } },
      {
        ...expected,
        evaluations: { items: [{ ...row, inclusion: { entityIds: [], relationshipIds: [] } }] },
      },
      { ...expected, evaluations: { items: [{ ...row, dependencyChange: "changed" }] } },
      { ...expected, evaluations: { items: [{ ...row, after: { ...row.after, inputs: [] } }] } },
      { ...expected, evaluations: { items: [row, row] } },
    ])
      assert.throws(() => decodeRead("/api/configuration-impact", query, altered));
  } finally {
    await server?.close();
    f.close();
  }
});

test("pair discovery exhausts bounded pages and refuses stale or foreign continuation without writes", async () => {
  const f = await configurationCaptureFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    for (let i = 0; i < 26; i++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: `Synthetic result ${i}`,
          inputs: [{ entityId: f.part.id, fields: ["value"] }],
          relationshipInputs: [],
        },
        actor,
      );
    const query = { beforeId: target.id, afterId: target.id, limit: 25 };
    const first = await f.tracer.configurations.compareDependencies(query);
    assert.equal(first.evaluations.items.length, 25);
    assert.ok(first.evaluations.nextAfter);
    const continuation = { ...query, after: first.evaluations.nextAfter };
    const second = await f.tracer.configurations.compareDependencies(continuation);
    assert.equal(second.evaluations.items.length, 1);
    assert.equal(second.evaluations.nextAfter, undefined);
    assert.equal(
      new Set([...first.evaluations.items, ...second.evaluations.items].map((x) => x.receipt.id))
        .size,
      26,
    );
    assert.deepEqual(decodeRead("/api/configuration-impact", continuation, second), second);
    assert.throws(() => decodeRead("/api/configuration-impact", query, second));
    assert.throws(() =>
      decodeRead("/api/configuration-impact", query, {
        ...first,
        discovery: { ...first.discovery, limit: 1 },
      }),
    );
    const other = await f.tracer.configurations.captureExact(await f.input(), actor);
    await assert.rejects(
      f.tracer.configurations.compareDependencies({ ...continuation, afterId: other.id }),
      {
        code: "conflict",
        message: /another pair/,
      },
    );
    await f.tracer.evidence.recordReceipt(
      { outputId: f.root.id, outcome: "Later work", inputs: [{ entityId: f.part.id }] },
      actor,
    );
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(f.tracer.configurations.compareDependencies(continuation), {
      code: "conflict",
      message: /evidence population/,
    });
    await assert.rejects(
      f.tracer.configurations.compareDependencies({
        ...query,
        expectedEvidenceRevision: first.discovery.evidenceRevision,
      }),
      { code: "conflict", message: /Evidence changed/ },
    );
    const restarted = await f.tracer.configurations.compareDependencies(query);
    assert.deepEqual(restarted.pair, first.pair);
    assert.ok(restarted.discovery.evidenceRevision > first.discovery.evidenceRevision);
    for (const invalid of [
      { limit: 26 },
      { limit: 0 },
      { after: "bad" },
      { after: "{}" },
      { expectedEvidenceRevision: -1 },
      { extra: true },
    ])
      await assert.rejects(f.tracer.configurations.compareDependencies({ ...query, ...invalid }), {
        code: "validation",
      });
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

for (const [domain, external] of [
  ["engineering", true],
  ["research", false],
] as const)
  test(`${domain}: pair impact resolves independent pinned reference uses without equating default drift to passage impact`, async () => {
    const x = await referenceUseFixture(domain, external),
      { f } = x;
    try {
      const receipt = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.requirement.id,
          outcome: "Synthetic supporting result, not controlled verification",
          inputs: [x.input(0), x.input(1), x.input(2)],
          relationshipInputs: x.relationships([0, 1, 2]),
        },
        verificationActor,
      );
      const before = await x.capture();
      const after = await x.capture([], true);
      const query = { beforeId: before.id, afterId: after.id };
      const result = await f.tracer.configurations.compareDependencies(query);
      const row = result.evaluations.items.find((x) => x.receipt.id === receipt.id)!;
      assert.equal(row.before.state, "current");
      assert.equal(row.after.state, "current");
      assert.equal(row.dependencyChange, "unchanged");
      assert.ok(row.after.inputs.every((x) => x.referenceUse?.passage === "unknown"));
      if (external) {
        assert.ok(
          row.after.inputs.every((x) => x.referenceUse?.resourceDefault.observation === null),
        );
        assert.deepEqual(
          row.after.inputs.map((x) => x.current.observation!.id),
          [x.B!.id, x.C!.id, x.B!.id],
        );
      }
      const missing = await x.capture([0], true);
      const unknown = await f.tracer.configurations.compareDependencies({
        beforeId: before.id,
        afterId: missing.id,
      });
      assert.equal(unknown.evaluations.items[0].dependencyChange, "unknown");
      assert.ok(unknown.evaluations.items[0].after.inputs[0].hasUnknown);
      await x.changeSource();
      await f.tracer.removeRelationship(x.refs[0].id, 1, 2, verificationActor);
      f.reopen();
      const current = await f.tracer.configurations.compareDependencies(query);
      assert.deepEqual(current.pair, result.pair);
      assert.deepEqual(current.evaluations.items, result.evaluations.items);
      assert.equal(current.discovery.digest, result.discovery.digest);
      assert.ok(current.discovery.evidenceRevision >= result.discovery.evidenceRevision);
    } finally {
      f.close();
    }
  });

test("pair impact rejects legacy configurations instead of substituting live content or topology", async () => {
  const f = await configurationCaptureFixture();
  try {
    const exact = await f.tracer.configurations.captureExact(await f.input(), actor);
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy",
        subjectId: f.root.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.root.id, version: 1 }],
      },
      actor,
    );
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compareDependencies({ beforeId: legacy.id, afterId: exact.id }),
      { code: "validation", message: /legacy scope/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

test("pair impact keeps payload budgets explicit and permits smaller pages without narrowing engineering membership", async () => {
  const f = await configurationCaptureFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    for (let i = 0; i < 5; i++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: "x".repeat(900000),
          inputs: [{ entityId: f.part.id }],
          relationshipInputs: [],
        },
        actor,
      );
    const query = { beforeId: target.id, afterId: target.id };
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(f.tracer.configurations.compareDependencies(query), {
      code: "validation",
      message: /4 MiB receipt population/,
    });
    const page = await f.tracer.configurations.compareDependencies({ ...query, limit: 1 });
    assert.equal(page.evaluations.items.length, 1);
    assert.ok(page.evaluations.nextAfter);
    assert.deepEqual(page.pair.before, target);
    assert.deepEqual(page.pair.after, target);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

test("pair impact refuses oversized individual receipts without returning a partial page", async () => {
  const f = await configurationCaptureFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    await f.tracer.evidence.recordReceipt(
      { outputId: f.root.id, outcome: "x".repeat(1100000), inputs: [{ entityId: f.part.id }] },
      actor,
    );
    const snapshot = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compareDependencies({
        beforeId: target.id,
        afterId: target.id,
        limit: 1,
      }),
      { code: "validation", message: /1 MiB/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

test("pair dependency service captures the caller's selection before queued work and allocates no identity", async () => {
  const f = await configurationCaptureFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor);
    const service = new Configurations(f.repository, () => {
      throw Error("Read must allocate no identity");
    });
    const query = { beforeId: target.id, afterId: target.id, limit: 1 };
    const snapshot = await f.tracer.exportProject();
    const pending = service.compareDependencies(query);
    query.afterId = "later caller mutation";
    query.limit = 26;
    const result = await pending;
    assert.equal(result.basis.afterId, target.id);
    assert.equal(result.discovery.limit, 1);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});
