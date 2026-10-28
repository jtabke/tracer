import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Tracer } from "../src/index.ts";
import type { Json } from "../src/core/model.ts";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { decodeRead } from "../src/interfaces/api-endpoints.ts";
import {
  configurationCaptureFixture,
  configurationActor as actor,
} from "./configuration-capture-fixture.ts";

test("fixed configuration comparison retains exact changes and unchanged context through live deletion, schema drift and restart without writes or IO", async () => {
  const f = await configurationCaptureFixture();
  try {
    const before = await f.tracer.configurations.captureExact(await f.input(), actor);
    const part = await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Changed part", value: { nested: [null, 1] } } },
      1,
      actor,
    );
    const added = await f.tracer.createEntity(
      { type: "item", fields: { title: "New item", value: 3 } },
      1,
      actor,
    );
    const io = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "b".repeat(64),
    }));
    const observation = await io.evidence.observe(
      { entityId: f.material.id, locator: f.observation.locator },
      actor,
    );
    const input = await f.input();
    input.members[1].version = part.version;
    input.members.push({ entityId: added.id, version: added.version });
    input.relationships = [];
    input.content[0].observationId = observation.id;
    const after = await f.tracer.configurations.captureExact(input, actor),
      pair = { beforeId: before.id, afterId: after.id };
    const result = await f.tracer.configurations.compare(pair);
    assert.equal(result.members.find((x) => x.id === f.part.id)!.state, "modified");
    assert.deepEqual(
      result.members.find((x) => x.id === f.part.id)!.changes.map((x) => x.path),
      [
        ["fields", "title"],
        ["fields", "value"],
      ],
    );
    assert.equal(result.members.find((x) => x.id === added.id)!.state, "added");
    assert.equal(result.members.find((x) => x.id === f.root.id)!.state, "unchanged");
    assert.equal(result.relationships[0].state, "removed");
    assert.equal(result.content[0].content, "different");
    assert.deepEqual(result.before, before);
    assert.deepEqual(result.after, after);
    assert.equal(result.completeness.projectDeletion, "not_inferred");
    assert.equal(result.completeness.passage, "not_assessed");
    await f.tracer.removeRelationship(f.link.id, 1, 1, actor);
    await f.tracer.removeEntity(f.root.id, 1, 1, actor);
    await f.tracer.setSchema(
      { ...f.schema, entityTypes: { ...f.schema.entityTypes, other: { fields: {} } } },
      1,
      actor,
    );
    f.reopen();
    const snapshot = await f.tracer.exportProject();
    const noIO = new Tracer(f.repository, undefined, async () => {
      throw Error("comparison must not observe");
    });
    assert.deepEqual(await noIO.configurations.compare(pair), result);
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    assert.notEqual(
      (await noIO.configurations.compare({ beforeId: after.id, afterId: before.id })).basis.digest,
      result.basis.digest,
    );
  } finally {
    f.close();
  }
});

test("configuration field comparison preserves missing/null, nested JSON, ordered arrays and version-only revisions", async () => {
  const f = await configurationCaptureFixture();
  try {
    let version = 1;
    for (const [a, b] of [
      [{}, { n: null }],
      [
        [1, 2],
        [2, 1],
      ],
      [
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ],
    ] as [Json, Json][]) {
      const p = await f.tracer.updateEntity(
        f.part.id,
        version,
        { fields: { title: "Part", value: a } },
        1,
        actor,
      );
      version = p.version;
      const first = await f.input();
      first.members[1].version = version;
      const before = await f.tracer.configurations.captureExact(first, actor);
      const q = await f.tracer.updateEntity(
        f.part.id,
        version,
        { fields: { title: "Part", value: b } },
        1,
        actor,
      );
      version = q.version;
      const second = await f.input();
      second.members[1].version = version;
      const after = await f.tracer.configurations.captureExact(second, actor);
      const delta = (
        await f.tracer.configurations.compare({ beforeId: before.id, afterId: after.id })
      ).members.find((x) => x.id === f.part.id)!;
      assert.equal(delta.state, "modified");
      assert.equal(
        delta.versionOnly,
        !Array.isArray(a) && a !== null && typeof a === "object" && Object.hasOwn(a, "a"),
      );
      if (!delta.versionOnly)
        assert.deepEqual(delta.changes[0], {
          path: ["fields", "value"],
          before: { present: true, value: a },
          after: { present: true, value: b },
        });
    }
    const old = await f.input();
    old.members[1].version = version;
    const before = await f.tracer.configurations.captureExact(old, actor);
    await f.tracer.updateEntity(f.part.id, version, { fields: { title: "Part" } }, 1, actor);
    const next = await f.input();
    next.members[1].version = version + 1;
    const after = await f.tracer.configurations.captureExact(next, actor);
    const delta = (
      await f.tracer.configurations.compare({ beforeId: before.id, afterId: after.id })
    ).members.find((x) => x.id === f.part.id)!;
    assert.deepEqual(delta.changes[0].after, { present: false });
  } finally {
    f.close();
  }
});

test("legacy omissions stay unknown; explicit membership removal is not live deletion and scope/schema differences are qualified", async () => {
  const f = await configurationCaptureFixture();
  try {
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy",
        subjectId: f.root.id,
        expectedSubjectVersion: 1,
        members: [
          { entityId: f.root.id, version: 1 },
          { entityId: f.part.id, version: 1 },
        ],
      },
      actor,
    );
    const input = await f.input();
    input.scope.coverage = "partial";
    input.content[0] = {
      entityId: f.material.id,
      observationId: null,
      reason: "Unavailable source",
    };
    const controlled = await f.tracer.configurations.captureExact(input, actor);
    const comparison = await f.tracer.configurations.compare({
      beforeId: legacy.id,
      afterId: controlled.id,
    });
    assert.equal(comparison.relationships[0].state, "unknown");
    assert.equal(comparison.content[0].content, "unknown");
    assert.equal(comparison.completeness.topology, "unknown");
    assert.equal(comparison.completeness.content, "unknown");
    assert.equal(comparison.comparability.state, "qualified");
    await f.tracer.setSchema(
      { ...f.schema, entityTypes: { ...f.schema.entityTypes, extra: { fields: {} } } },
      1,
      actor,
    );
    const smaller = await f.input();
    smaller.members = smaller.members.filter((x) => x.entityId !== f.part.id);
    smaller.relationships = [];
    const after = await f.tracer.configurations.captureExact(smaller, actor),
      result = await f.tracer.configurations.compare({
        beforeId: controlled.id,
        afterId: after.id,
      });
    assert.equal(result.members.find((x) => x.id === f.part.id)!.state, "removed");
    assert.ok(await f.tracer.getEntity(f.part.id));
    assert.ok(result.comparability.issues.some((x) => x.code === "schema_changed"));
    assert.ok(result.comparability.issues.some((x) => x.code === "partial_scope"));
    const other = await f.input();
    other.subjectId = f.part.id;
    const unrelated = await f.tracer.configurations.captureExact(other, actor);
    assert.equal(
      (await f.tracer.configurations.compare({ beforeId: controlled.id, afterId: unrelated.id }))
        .comparability.state,
      "incompatible",
    );
  } finally {
    f.close();
  }
});

test("same hashes retain distinct observation identities and cannot assert passage relevance or retained bytes", async () => {
  const f = await configurationCaptureFixture();
  try {
    const before = await f.tracer.configurations.captureExact(await f.input(), actor);
    const observation = await f.tracer.evidence.observe(
      { entityId: f.material.id, locator: f.observation.locator },
      actor,
    );
    const input = await f.input();
    input.content[0].observationId = observation.id;
    const after = await f.tracer.configurations.captureExact(input, actor);
    const result = await f.tracer.configurations.compare({
      beforeId: before.id,
      afterId: after.id,
    });
    assert.equal(result.content[0].content, "same");
    assert.equal(result.content[0].selectionChanged, true);
    assert.notEqual(
      result.before.capture!.content[0].observation!.id,
      result.after.capture!.content[0].observation!.id,
    );
    assert.equal(result.completeness.externalBytes, "not_retained");
    assert.equal(result.comparability.engineeringMeaning, "not_assessed");
  } finally {
    f.close();
  }
});

test("selected topology explains relinking and qualified reference edits with original endpoints and schemas", async () => {
  const f = await configurationCaptureFixture();
  try {
    await f.tracer.setSchema(
      {
        ...f.schema,
        relationshipTypes: {
          ...f.schema.relationshipTypes,
          cites: { fields: {}, reference: true },
        },
      },
      1,
      actor,
    );
    const reference = await f.tracer.createRelationship(
      {
        type: "cites",
        source: f.root.id,
        target: f.material.id,
        fields: {},
        reference: {
          role: "definition",
          selector: { kind: "section", value: "4.2" },
          state: { mode: "pinned", observationId: f.observation.id },
        },
      },
      2,
      actor,
    );
    const input = await f.input();
    input.relationships.push({ relationshipId: reference.id, version: 1 });
    const before = await f.tracer.configurations.captureExact(input, actor);
    await f.tracer.updateRelationship(
      f.link.id,
      1,
      { type: "depends", source: f.root.id, target: f.material.id, fields: {} },
      2,
      actor,
    );
    await f.tracer.updateRelationship(
      reference.id,
      1,
      {
        type: "cites",
        source: f.root.id,
        target: f.material.id,
        fields: {},
        reference: {
          role: "rationale",
          explanation: "Supporting context",
          selector: { kind: "quote", value: { exact: "Operating power" } },
          state: { mode: "current" },
        },
      },
      2,
      actor,
    );
    const next = await f.input();
    next.relationships = [
      { relationshipId: f.link.id, version: 2 },
      { relationshipId: reference.id, version: 2 },
    ];
    const after = await f.tracer.configurations.captureExact(next, actor),
      result = await f.tracer.configurations.compare({ beforeId: before.id, afterId: after.id });
    assert.deepEqual(result.relationships.find((x) => x.id === f.link.id)!.changes, [
      {
        path: ["target"],
        before: { present: true, value: f.part.id },
        after: { present: true, value: f.material.id },
      },
    ]);
    const delta = result.relationships.find((x) => x.id === reference.id)!;
    assert.deepEqual(
      delta.changes.map((x) => x.path),
      [["reference"]],
    );
    assert.equal(
      result.before.relationships!.find((x) => x.relationship.id === reference.id)!.relationship
        .reference!.role,
      "definition",
    );
    assert.equal(
      result.after.relationships!.find((x) => x.relationship.id === reference.id)!.relationship
        .reference!.state.mode,
      "current",
    );
    assert.equal(result.before.relationships![0].schema.version, 1);
    assert.equal(result.after.relationships![0].schema.version, 2);
  } finally {
    f.close();
  }
});

test("comparison is shared by HTTP/client/CLI and responses must belong to the requested exact pair", async () => {
  const f = await configurationCaptureFixture();
  let server;
  try {
    const before = await f.tracer.configurations.captureExact(await f.input(), actor),
      after = await f.tracer.configurations.captureExact(await f.input(), actor),
      pair = { beforeId: before.id, afterId: after.id },
      expected = await f.tracer.configurations.compare(pair),
      snapshot = await f.tracer.exportProject();
    server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["configuration-comparison"] },
    });
    await client.connect();
    assert.deepEqual(await client.read("/api/configuration-comparison", pair), expected);
    const cli = spawnSync(
      process.execPath,
      [
        "src/interfaces/cli.ts",
        "--db",
        f.database,
        "configuration",
        "compare",
        before.id,
        after.id,
      ],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), expected);
    assert.throws(() =>
      decodeRead(
        "/api/configuration-comparison",
        { beforeId: after.id, afterId: before.id },
        expected,
      ),
    );
    for (const altered of [
      { ...expected, members: [] },
      { ...expected, relationships: [] },
      { ...expected, content: [] },
      { ...expected, comparability: { ...expected.comparability, state: "incompatible" } },
      { ...expected, basis: { ...expected.basis, beforeDigest: "unbound" } },
    ])
      assert.throws(() => decodeRead("/api/configuration-comparison", pair, altered));
    assert.deepEqual(await f.tracer.exportProject(), snapshot);
    await assert.rejects(f.tracer.configurations.compare({ ...pair, extra: true } as typeof pair), {
      code: "validation",
    });
    await assert.rejects(f.tracer.configurations.compare({ ...pair, afterId: "missing" }), {
      code: "not_found",
    });
  } finally {
    await server?.close();
    f.close();
  }
});

test("captured subject context changes remain explicit when the subject is outside selected membership", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input();
    input.members = [{ entityId: f.part.id, version: 1 }];
    input.relationships = [];
    input.content = [];
    const before = await f.tracer.configurations.captureExact(input, actor);
    await f.tracer.updateEntity(
      f.root.id,
      1,
      { fields: { title: "Changed context only", value: null } },
      1,
      actor,
    );
    const next = await f.input();
    next.expectedSubjectVersion = 2;
    next.members = input.members;
    next.relationships = [];
    next.content = [];
    const after = await f.tracer.configurations.captureExact(next, actor),
      pair = { beforeId: before.id, afterId: after.id },
      result = await f.tracer.configurations.compare(pair);
    assert.equal(result.members.length, 1);
    assert.equal(result.members[0].state, "unchanged");
    assert.deepEqual(result.contextChanges, [
      {
        path: ["context", "subject"],
        before: { present: true, value: before.subject },
        after: { present: true, value: after.subject },
      },
    ]);
    assert.throws(() =>
      decodeRead("/api/configuration-comparison", pair, { ...result, contextChanges: [] }),
    );
  } finally {
    f.close();
  }
});

test("comparison refuses oversized complete inputs rather than truncating a legally captured configuration", async () => {
  const f = await configurationCaptureFixture();
  try {
    const part = await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Large declared value", value: "x".repeat(1100000) } },
      1,
      actor,
    );
    const input = await f.input();
    input.members[1].version = part.version;
    const capture = await f.tracer.configurations.captureExact(input, actor),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.configurations.compare({ beforeId: capture.id, afterId: capture.id }),
      { code: "validation", message: /1 MiB/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
