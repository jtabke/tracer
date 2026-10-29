import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/index.ts";
import type { Relationship } from "../src/index.ts";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import { verificationFixture } from "./verification-fixture.ts";
import { scopedInputState } from "../src/application/receipt-comparison.ts";
import {
  configurationCaptureFixture,
  configurationActor as actor,
} from "./configuration-capture-fixture.ts";

test("selected receipt inputs reuse native field, observed content, path and direct relationship rules independently of live head", async () => {
  const f = await configurationCaptureFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Original failed result remains failed",
        inputs: [
          { entityId: f.part.id, facet: "native", fields: ["value"], path: [f.link.id] },
          { entityId: f.material.id, facet: "content", observationId: f.observation.id },
        ],
        relationshipInputs: [{ id: f.link.id, role: "Independent topology dependency" }],
      },
      actor,
    );
    const before = await f.tracer.configurations.captureExact(await f.input(), actor);
    await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Only annotation changed", value: 1 } },
      1,
      actor,
    );
    await f.tracer.updateEntity(
      f.material.id,
      1,
      { fields: { title: "New resource annotation", value: 2 } },
      1,
      actor,
    );
    const changed = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "b".repeat(64),
    }));
    const observation = await changed.evidence.observe(
      { entityId: f.material.id, locator: f.observation.locator },
      actor,
    );
    await f.tracer.updateRelationship(
      f.link.id,
      1,
      { type: "depends", source: f.root.id, target: f.material.id, fields: {} },
      1,
      actor,
    );
    const input = await f.input();
    input.members[1].version = 2;
    input.members[2].version = 2;
    input.content[0].observationId = observation.id;
    input.relationships[0].version = 2;
    const after = await f.tracer.configurations.captureExact(input, actor);
    const earlier = { configurationId: before.id, receiptId: receipt.id },
      later = { configurationId: after.id, receiptId: receipt.id };
    const original = await f.tracer.configurations.compareReceipt(earlier),
      candidate = await f.tracer.configurations.compareReceipt(later);
    assert.equal(original.comparison.state, "current");
    assert.equal(candidate.comparison.state, "changed");
    assert.equal(original.receipt.outcome, "Original failed result remains failed");
    assert.equal(original.comparison.inputs[0].current.entity!.version, 1);
    assert.deepEqual(original.comparison.inputs[1].current.observation, f.observation);
    assert.equal(candidate.comparison.inputs[0].hasChanged, true); // The declared path changed despite equal selected fields.
    assert.equal(candidate.comparison.relationshipInputs![0].hasChanged, true);
    assert.equal(candidate.comparison.inputs[1].hasChanged, true);
    assert.notEqual(candidate.token, original.token);
    assert.equal(original.completeness.engineeringImpact, "not_assessed");
    await f.tracer.removeRelationship(f.link.id, 2, 1, actor);
    await f.tracer.removeEntity(f.material.id, 2, 1, actor);
    await f.tracer.removeEntity(f.root.id, 1, 1, actor);
    f.reopen();
    const snapshot = await f.tracer.exportProject();
    const noIO = new Tracer(f.repository, undefined, async () => {
      throw Error("Selected reads must not observe");
    });
    assert.deepEqual(await noIO.configurations.compareReceipt(earlier), original);
    assert.deepEqual(await noIO.configurations.compareReceipt(later), candidate);
    assert.equal((await noIO.evidence.compareReceipt(receipt.id)).state, "unknown");
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
  } finally {
    f.close();
  }
});

test("unselected native/content/topology inputs remain unknown and never fall back to live state", async () => {
  const f = await configurationCaptureFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Synthetic original result",
        inputs: [
          { entityId: f.part.id, fields: ["value"], path: [f.link.id] },
          { entityId: f.material.id, facet: "content", observationId: f.observation.id },
        ],
        relationshipInputs: [{ id: f.link.id }],
      },
      actor,
    );
    const input = await f.input();
    input.relationships = [];
    input.content[0] = {
      entityId: f.material.id,
      observationId: null,
      reason: "No selected source state",
    };
    input.scope.coverage = "partial";
    const partial = await f.tracer.configurations.captureExact(input, actor),
      result = await f.tracer.configurations.compareReceipt({
        configurationId: partial.id,
        receiptId: receipt.id,
      });
    assert.equal(result.comparison.state, "unknown");
    assert.ok(result.comparison.inputs[0].current.entity);
    assert.equal(result.comparison.inputs[0].hasUnknown, true); // Missing selected path, although both endpoints exist live.
    assert.equal(result.comparison.inputs[0].current.links[0], null);
    assert.equal(
      scopedInputState(result.comparison.inputs[0], false, new Set([f.link.id]), "configuration")
        .hasUnknown,
      true,
    );
    assert.equal(result.comparison.inputs[1].current.observation, null);
    assert.ok(
      result.comparison.inputs[1].reasons.some((reason) =>
        reason.includes("explicit new configuration capture"),
      ),
    );
    assert.equal(result.comparison.relationshipInputs![0].current, null);
    assert.match(result.comparison.relationshipInputs![0].reasons[0], /not selected/);
    assert.equal(result.scope.coverage, "partial");
    const narrower = await f.input();
    narrower.members = [{ entityId: f.root.id, version: 1 }];
    narrower.relationships = [];
    narrower.content = [];
    const absent = await f.tracer.configurations.captureExact(narrower, actor),
      missing = await f.tracer.configurations.compareReceipt({
        configurationId: absent.id,
        receiptId: receipt.id,
      });
    assert.equal(missing.comparison.inputs[0].current.entity, null);
    assert.match(missing.comparison.inputs[0].reasons[0], /not selected/);
    assert.ok(await f.tracer.getEntity(f.part.id));
    assert.equal((await f.tracer.evidence.compareReceipt(receipt.id)).state, "current");
  } finally {
    f.close();
  }
});

test("post-capture receipts can match the selected candidate without adding execution identity to membership or changing outcomes", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      target = await f.tracer.configurations.captureExact(input, actor);
    await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Unrelated annotation edit", value: 1 } },
      1,
      actor,
    );
    const report = await f.tracer.createEntity(
      { type: "item", fields: { title: "Later execution identity", value: 1 } },
      1,
      actor,
    );
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: report.id,
        outcome: "not_run remains an unexecuted outcome",
        inputs: [
          { entityId: f.part.id, facet: "native", revision: 2, fields: ["value"] },
          { entityId: f.material.id, facet: "content", observationId: f.observation.id },
        ],
      },
      actor,
    );
    const snapshot = await f.tracer.exportProject(),
      result = await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: receipt.id,
      });
    assert.equal(result.comparison.state, "current");
    assert.equal(result.receipt.outcome, "not_run remains an unexecuted outcome");
    assert.equal(result.comparison.inputs[0].recorded.entity.version, 2);
    assert.equal(result.comparison.inputs[0].current.entity!.version, 1);
    assert.ok(!target.members.some((pin) => pin.entity.id === report.id));
    assert.deepEqual(await f.tracer.configurations.get(target.id), target);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy native-only",
        subjectId: f.root.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.root.id, version: 1 }],
      },
      actor,
    );
    await assert.rejects(
      f.tracer.configurations.compareReceipt({ configurationId: legacy.id, receiptId: receipt.id }),
      { code: "validation", message: /legacy scope/ },
    );
    await assert.rejects(
      f.tracer.configurations.compareReceipt({ configurationId: target.id, receiptId: "absent" }),
      { code: "not_found" },
    );
    await assert.rejects(
      f.tracer.configurations.compareReceipt({ configurationId: "absent", receiptId: receipt.id }),
      { code: "not_found" },
    );
    await assert.rejects(
      f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: receipt.id,
        extra: true,
      } as { configurationId: string; receiptId: string }),
      { code: "validation" },
    );
  } finally {
    f.close();
  }
});

test("selected input comparison has one core/HTTP/client/CLI meaning and rejects wrong-context or incomplete responses", async () => {
  const f = await configurationCaptureFixture();
  let server;
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor),
      receipt = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: "Original software fixture observation",
          inputs: [{ entityId: f.part.id }],
          relationshipInputs: [{ id: f.link.id }],
        },
        actor,
      );
    const query = { configurationId: target.id, receiptId: receipt.id },
      expected = await f.tracer.configurations.compareReceipt(query),
      before = await f.tracer.exportProject();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["configuration-input-comparison"] },
    });
    await client.connect();
    assert.deepEqual(await client.read("/api/configuration-receipt-comparison", query), expected);
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "configuration",
        "compare-receipt",
        target.id,
        receipt.id,
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), expected);
    const sameStates = await f.tracer.configurations.captureExact(await f.input(), actor);
    const rebound = await f.tracer.configurations.compareReceipt({
      configurationId: sameStates.id,
      receiptId: receipt.id,
    });
    assert.deepEqual(rebound.comparison, expected.comparison);
    assert.notEqual(rebound.token, expected.token);
    for (const altered of [
      { ...expected, basis: { ...expected.basis, configurationId: "another" } },
      { ...expected, comparison: { ...expected.comparison, inputs: [] } },
      { ...expected, comparison: { ...expected.comparison, relationshipInputs: [] } },
      { ...expected, token: "not-bound" },
    ])
      assert.throws(() => decodeRead("/api/configuration-receipt-comparison", query, altered));
    const after = await f.tracer.exportProject();
    assert.deepEqual(after.current, before.current);
    assert.deepEqual(after.provenance, before.provenance);
    assert.deepEqual(after.evidence, before.evidence);
    assert.equal(after.configurations.length, before.configurations.length + 1);
  } finally {
    await server?.close();
    f.close();
  }
});

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: selected requirement/method dependencies retain exact semantics after live governing fields change`, async () => {
    const f = await verificationFixture(domain);
    try {
      const context = await f.tracer.configurations.captureContext();
      const target = await f.tracer.configurations.captureExact(
        {
          id: randomUUID(),
          name: "Explicit configured candidate",
          subjectId: f.requirement.id,
          expectedSubjectVersion: 1,
          members: [f.requirement, f.method, f.profile].map((e) => ({
            entityId: e.id,
            version: 1,
          })),
          relationships: [{ relationshipId: f.relationship.id, version: 1 }],
          content: [],
          scope: {
            purpose: "Synthetic configured requirement/method scope",
            coverage: "complete",
            rationale: "Declared fixture population; no physical validation claim",
          },
          expectedSchemaVersion: context.schema.version,
          expectedProjectRevision: context.projectRevision,
          expectedEvidenceRevision: context.evidenceRevision,
        },
        actor,
      );
      const field = f.definition.requirement.fields.statement;
      const receipt = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: "Recorded result retained independently of input correspondence",
          inputs: [{ entityId: f.requirement.id, fields: [field] }],
          relationshipInputs: [{ id: f.relationship.id }],
        },
        actor,
      );
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        { fields: { ...f.requirement.fields, [field]: "Later live governing statement" } },
        1,
        actor,
      );
      assert.equal((await f.tracer.evidence.compareReceipt(receipt.id)).state, "changed");
      const result = await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: receipt.id,
      });
      assert.equal(result.comparison.state, "current");
      assert.equal(
        result.comparison.inputs[0].current.entity!.fields[field],
        f.requirement.fields[field],
      );
      assert.equal(result.completeness.engineeringImpact, "not_assessed");
    } finally {
      f.close();
    }
  });

test("selected input comparison exhausts 100 total declarations and 1000 path links or refuses the next dependency", async () => {
  const f = await configurationCaptureFixture();
  try {
    const nodes = [];
    for (let i = 0; i < 9; i++)
      nodes.push(
        await f.tracer.createEntity(
          { type: "item", fields: { title: `Path node ${i}`, value: i } },
          1,
          actor,
        ),
      );
    const path: Relationship[] = [],
      points = [f.root, ...nodes, f.part];
    for (let i = 0; i < points.length - 1; i++)
      path.push(
        await f.tracer.createRelationship(
          { type: "depends", source: points[i].id, target: points[i + 1].id, fields: {} },
          1,
          actor,
        ),
      );
    const links = [f.link, ...path];
    while (links.length < 100)
      links.push(
        await f.tracer.createRelationship(
          { type: "depends", source: f.root.id, target: f.part.id, fields: {} },
          1,
          actor,
        ),
      );
    const input = await f.input();
    input.members.push(...nodes.map((e) => ({ entityId: e.id, version: 1 })));
    input.relationships = links.map((r) => ({ relationshipId: r.id, version: 1 }));
    const target = await f.tracer.configurations.captureExact(input, actor),
      declarations = Array.from({ length: 100 }, (_, i) => ({
        entityId: f.part.id,
        fields: ["value"],
        path: path.map((r) => r.id),
        role: `Separate declared use ${i}`,
      }));
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Complete synthetic declared population",
        inputs: declarations,
      },
      actor,
    );
    const result = await f.tracer.configurations.compareReceipt({
      configurationId: target.id,
      receiptId: receipt.id,
    });
    assert.equal(result.comparison.state, "current");
    assert.equal(result.comparison.inputs.length, 100);
    const directReceipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "100 separately declared topology inputs",
        inputs: [],
        relationshipInputs: links.map((r) => ({ id: r.id })),
      },
      actor,
    );
    const direct = await f.tracer.configurations.compareReceipt({
      configurationId: target.id,
      receiptId: directReceipt.id,
    });
    assert.equal(direct.comparison.relationshipInputs!.length, 100);
    assert.equal(direct.comparison.state, "current");
    assert.equal(
      result.comparison.inputs.reduce((n, row) => n + row.current.links.length, 0),
      1000,
    );
    const extra = await f.tracer.createEntity(
        { type: "item", fields: { title: "One extra dependency", value: 1 } },
        1,
        actor,
      ),
      link = await f.tracer.createRelationship(
        { type: "depends", source: f.part.id, target: extra.id, fields: {} },
        1,
        actor,
      );
    const overflow = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: "1001 declared path links",
          inputs: [
            { ...declarations[0], entityId: extra.id, path: [...declarations[0].path, link.id] },
            ...declarations.slice(1),
          ],
        },
        actor,
      ),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: overflow.id,
      }),
      { code: "validation", message: /population budget/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("oversized original receipt refuses selected comparison without returning partial applicability", async () => {
  const f = await configurationCaptureFixture();
  try {
    const target = await f.tracer.configurations.captureExact(await f.input(), actor),
      receipt = await f.tracer.evidence.recordReceipt(
        { outputId: f.root.id, outcome: "x".repeat(1100000), inputs: [{ entityId: f.part.id }] },
        actor,
      ),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compareReceipt({ configurationId: target.id, receiptId: receipt.id }),
      { code: "validation", message: /1 MiB/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("repeated large selected snapshots refuse the aggregate work budget before expanding an oversized comparison", async () => {
  const f = await configurationCaptureFixture();
  try {
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        outcome: "Eight independent native uses",
        inputs: Array.from({ length: 8 }, (_, i) => ({
          entityId: f.part.id,
          role: `Original use ${i}`,
        })),
      },
      actor,
    );
    await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Large selected snapshot", value: "x".repeat(800000) } },
      1,
      actor,
    );
    const input = await f.input();
    input.members[1].version = 2;
    const target = await f.tracer.configurations.captureExact(input, actor),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compareReceipt({ configurationId: target.id, receiptId: receipt.id }),
      { code: "validation", message: /selected-read budget/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
