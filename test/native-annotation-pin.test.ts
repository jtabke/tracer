import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";

test("explicit native annotations preserve historical external identity without weakening native-input pins or observing bytes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-annotation-pin-")),
    database = join(directory, "project.sqlite"),
    repository = new SQLiteRepository(database);
  let observations = 0,
    server;
  const tracer = new Tracer(repository, undefined, async () => {
      observations++;
      throw Error("Read must not observe content");
    }),
    actor = { actor: "annotation-pin-test" };
  try {
    const schema = {
      entityTypes: { item: { fields: { title: { type: "string" as const } } } },
      relationshipTypes: {},
    };
    await tracer.setSchema(schema, 0, actor);
    const resource = await tracer.createEntity(
      {
        type: "@resource",
        fields: {},
        resource: {
          label: "External annotations",
          source: { system: "file", externalId: "/synthetic/native-annotations" },
        },
      },
      1,
      actor,
    );
    const legacy = await tracer.createEntity(
      { type: "item", fields: { title: "Legacy externally bound annotations" } },
      1,
      actor,
    );
    await tracer.evidence.bindExternal(
      {
        entityId: legacy.id,
        system: "file",
        externalId: "/synthetic/legacy-annotations",
        ownership: "external",
      },
      actor,
    );
    const originals = await Promise.all(
      [resource, legacy].map((e) => tracer.getNativePin(e.id, 1, "annotations")),
    );
    await tracer.setSchema(
      {
        ...schema,
        entityTypes: {
          item: { fields: { ...schema.entityTypes.item.fields, notes: { type: "string" } } },
        },
      },
      1,
      actor,
    );
    await tracer.removeEntity(resource.id, 1, 2, actor);
    await tracer.removeEntity(legacy.id, 1, 2, actor);
    const before = await tracer.exportProject();
    server = await startHeadlessServer(tracer, { port: 0 });
    const client = createClient({
      baseUrl: server.origin,
      require: { features: ["native-annotation-pins"] },
    });
    await client.connect();
    for (const original of originals) {
      const id = original.entity.id;
      assert.equal(original.schema.version, 1);
      await assert.rejects(tracer.getNativePin(id, 1), {
        code: "validation",
        message: /do not capture external content/,
      });
      assert.deepEqual(await tracer.getNativePin(id, 1, "annotations"), original);
      assert.deepEqual(
        await client.read("/api/native-pin", { id, version: 1, facet: "annotations" }),
        original,
      );
      await assert.rejects(client.read("/api/native-pin", { id, version: 1 }), {
        code: "validation",
      });
      const cli = spawnSync(
        process.execPath,
        ["src/interfaces/cli.ts", "--db", database, "native-pin", "annotations", id, "1"],
        { encoding: "utf8" },
      );
      assert.equal(cli.status, 0, cli.stderr);
      assert.deepEqual(JSON.parse(cli.stdout), original);
    }
    assert.equal(
      (await fetch(`${server.origin}/api/native-pin?id=${resource.id}&version=1&facet=content`))
        .status,
      400,
    );
    assert.equal(
      (
        await fetch(
          `${server.origin}/api/native-pin?id=${resource.id}&version=1&facet=annotations&facet=annotations`,
        )
      ).status,
      400,
    );
    await assert.rejects(tracer.getNativePin(resource.id, 1, "content" as "annotations"), {
      code: "validation",
    });
    assert.deepEqual(await tracer.exportProject(), before);
    assert.equal(observations, 0);
  } finally {
    await server?.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
