import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { decodeRead } from "../src/interfaces/api-decoders.ts";
import type { ConfigurationInput } from "../src/core/configuration.ts";

const actor = { actor: "configuration-topology-test" };
async function setup(path = ":memory:") {
  const repository = new SQLiteRepository(path),
    tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" } } } },
      relationshipTypes: {
        connected: {
          fields: { interface: { type: "string" } },
          source: ["item"],
          target: ["item"],
        },
      },
    },
    0,
    actor,
  );
  const make = (title: string) =>
    tracer.createEntity({ type: "item", fields: { title } }, 1, actor);
  const hardware = await make("Hardware A"),
    software = await make("Software A"),
    alternative = await make("Alternative hardware"),
    build = await make("Integrated build");
  const link = await tracer.createRelationship(
    {
      type: "connected",
      source: software.id,
      target: hardware.id,
      fields: { interface: "Protocol A" },
    },
    1,
    actor,
  );
  const input: ConfigurationInput = {
    name: "Selected mixed build",
    subjectId: build.id,
    expectedSubjectVersion: 1,
    members: [
      { entityId: hardware.id, version: 1 },
      { entityId: software.id, version: 1 },
    ],
    relationships: [{ relationshipId: link.id, version: 1 }],
  };
  return { repository, tracer, hardware, software, alternative, build, link, input };
}

test("mixed configuration topology retains exact native relationships, historical schema and endpoints after relink/deletion/reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-topology-")),
    path = join(directory, "project.sqlite");
  const fixture = await setup(path),
    { repository, tracer, hardware, software, alternative, link } = fixture;
  let closed = false;
  try {
    const firmware = await tracer.updateEntity(
      software.id,
      1,
      { fields: { title: "Software B" } },
      1,
      actor,
    );
    await tracer.updateRelationship(
      link.id,
      1,
      { ...link, target: alternative.id, fields: { interface: "Protocol B" } },
      1,
      actor,
    );
    await tracer.removeEntity(hardware.id, 1, 1, actor);
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string" }, note: { type: "string" } } } },
        relationshipTypes: {
          connected: { fields: { interface: { type: "string" }, change: { type: "string" } } },
        },
      },
      1,
      actor,
    );
    const before = await tracer.history(),
      head = (await tracer.timeline()).head;
    const captured = await tracer.configurations.capture(
      {
        ...fixture.input,
        members: [
          { entityId: hardware.id, version: 1 },
          { entityId: firmware.id, version: 2 },
        ],
      },
      actor,
    );
    assert.deepEqual(
      captured.members.map((pin) => pin.entity.version),
      [1, 2],
    );
    const pinned = captured.relationships![0];
    assert.deepEqual(pinned.relationship, link);
    assert.equal(pinned.schema.version, 1);
    assert.equal(pinned.schema.relationshipTypes.connected.fields.change, undefined);
    const revision = before.items.find((item) => item.revisionId === pinned.revisionId)!;
    assert.equal(pinned.changesetId, revision.changesetId);
    assert.equal(pinned.projectRevision, revision.projectRevision);
    assert.deepEqual(revision.snapshot, link);
    assert.deepEqual(await tracer.history(), before);
    assert.equal((await tracer.timeline()).head, head);
    repository.close();
    closed = true;
    const reopened = new SQLiteRepository(path);
    try {
      assert.deepEqual(await new Tracer(reopened).configurations.get(captured.id), captured);
    } finally {
      reopened.close();
    }
  } finally {
    if (!closed) repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("configuration relationship selection rejects incomplete endpoints, duplicate pins and invalid revisions atomically", async () => {
  const { repository, tracer, input, hardware, software, alternative, link } = await setup();
  try {
    await tracer.removeRelationship(link.id, 1, 1, actor);
    const before = await tracer.history(),
      head = (await tracer.timeline()).head;
    const invalid: unknown[] = [
      {
        ...input,
        members: [
          { entityId: software.id, version: 1 },
          { entityId: alternative.id, version: 1 },
        ],
      },
      { ...input, relationships: [input.relationships![0], input.relationships![0]] },
      { ...input, relationships: [{ relationshipId: link.id, version: 2 }] },
      { ...input, relationships: [{ relationshipId: link.id, version: 9 }] },
      { ...input, relationships: [{ relationshipId: hardware.id, version: 1 }] },
      { ...input, relationships: [{ relationshipId: link.id, version: 0 }] },
      { ...input, relationships: [{ ...input.relationships![0], inferred: true }] },
      { ...input, relationships: Array.from({ length: 201 }, () => input.relationships![0]) },
      { ...input, relationships: null },
      { ...input, relationships: [null] },
    ];
    for (const proposal of invalid) {
      await assert.rejects(tracer.configurations.capture(proposal as ConfigurationInput, actor));
      assert.deepEqual((await tracer.configurations.list()).items, []);
      assert.deepEqual(await tracer.history(), before);
      assert.equal((await tracer.timeline()).head, head);
    }
    const pinned = await tracer.configurations.capture(input, actor);
    assert.deepEqual(pinned.relationships![0].relationship, link);
    const { relationships: _unused, ...legacyInput } = input;
    const legacy = await tracer.configurations.capture(legacyInput, actor);
    assert.equal(Object.hasOwn(legacy, "relationships"), false);
    const explicitEmpty = await tracer.configurations.capture(
      { ...legacyInput, relationships: [] },
      actor,
    );
    assert.deepEqual(explicitEmpty.relationships, []);
  } finally {
    repository.close();
  }
});

test("configuration HTTP and response decoding preserve explicit parallel/self-loop relationships without inferring links", async () => {
  const { repository, tracer, input, hardware, build, link } = await setup();
  const parallel = await tracer.createRelationship(
    { ...link, fields: { interface: "Parallel" } },
    1,
    actor,
  );
  const loop = await tracer.createRelationship(
    { type: "connected", source: hardware.id, target: hardware.id, fields: {} },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  try {
    const { token } = await (await fetch(server.origin + "/api/session")).json();
    const before = await tracer.history();
    const response = await fetch(server.origin + "/api/configurations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: server.origin,
        "X-Tracer-Token": token,
      },
      body: JSON.stringify({
        ...input,
        relationships: [link, parallel, loop].map((value) => ({
          relationshipId: value.id,
          version: value.version,
        })),
      }),
    });
    assert.equal(response.status, 200);
    const captured = await response.json(),
      query = { id: captured.id };
    const readback = decodeRead(
      "/api/configuration",
      query,
      await (await fetch(`${server.origin}/api/configuration?id=${captured.id}`)).json(),
    );
    assert.deepEqual(readback, captured);
    assert.deepEqual(
      readback.relationships!.map((pin) => pin.relationship),
      [link, parallel, loop],
    );
    assert.throws(() =>
      decodeRead("/api/configuration", query, {
        ...captured,
        relationships: [
          { ...captured.relationships[0], relationship: { ...link, version: "bad" } },
        ],
      }),
    );
    assert.deepEqual(await tracer.history(), before);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: build.id,
        configurationId: captured.id,
        outcome: "Only explicitly declared entity inputs were evaluated",
        inputs: captured.members.map((pin: { entity: { id: string } }) => ({
          entityId: pin.entity.id,
        })),
      },
      actor,
    );
    await tracer.updateRelationship(
      link.id,
      1,
      { ...link, fields: { interface: "Changed only the connection" } },
      1,
      actor,
    );
    const changedHistory = await tracer.history();
    assert.equal((await tracer.evidence.compareReceipt(receipt.id)).state, "current");
    assert.deepEqual(await tracer.configurations.get(captured.id), captured);
    assert.deepEqual(await tracer.history(), changedHistory);
  } finally {
    await server.close();
    repository.close();
  }
});
