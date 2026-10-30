import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/index.ts";
import type { Field, Fields } from "../src/core/model.ts";
import type { ChangesetInput, ChangesetResult } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";
import { createClient } from "../src/client.ts";
import type { ApiCapabilities, CompatibilityRequirements } from "../src/client.ts";

const provenance = { actor: "headless-acceptance", reason: "Criterion-scoped interface audit" };
const cliPath = resolve("src/interfaces/cli.ts");
async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-headless-acceptance-"));
  const definitions: {
    id: string;
    type: string;
    fields: Fields;
    definition: Record<string, Field>;
  }[] = [
    {
      id: "default",
      type: "requirement",
      fields: { title: "Control" },
      definition: { title: { type: "string" as const, required: true } },
    },
    {
      id: "research",
      type: "experiment",
      fields: { score: 42 },
      definition: { score: { type: "number" as const, required: true } },
    },
  ];
  const projects = definitions.map((project) => {
    const path = join(directory, project.id + ".sqlite");
    const repository = new SQLiteRepository(path);
    return { ...project, path, repository, tracer: new Tracer(repository) };
  });
  for (const project of projects)
    await project.tracer.setSchema(
      { entityTypes: { [project.type]: { fields: project.definition } }, relationshipTypes: {} },
      0,
      provenance,
    );
  const start = () =>
    startHeadlessServer(projects[0].tracer, {
      port: 0,
      provenance,
      projects: [{ id: "research", title: "Research", tracer: projects[1].tracer }],
    });
  let server = await start();
  t.after(async () => {
    await server.close();
    for (const project of projects) project.repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  function invoke(project: (typeof projects)[number], ...args: string[]) {
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        cliPath,
        "--db",
        project.path,
        "--actor",
        provenance.actor,
        "--reason",
        provenance.reason,
        ...args,
      ],
      { cwd: directory, encoding: "utf8", timeout: 10000 },
    );
    assert.ifError(result.error);
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    if (result.status === 1) {
      assert.equal(result.stdout, "");
      const error = JSON.parse(result.stderr);
      throw Object.assign(new Error(error.message), { code: error.error, details: error.details });
    }
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout);
  }
  const client = (project = projects[0], options: Parameters<typeof createClient>[0] = {}) =>
    createClient({ ...options, baseUrl: server.origin, project: project.id });
  async function writers(project = projects[0]) {
    const http = client(project);
    await http.connect();
    return [
      (input: ChangesetInput): Promise<ChangesetResult> =>
        project.tracer.applyChangeset(input, provenance),
      async (input: ChangesetInput): Promise<ChangesetResult> =>
        invoke(project, "changeset", "apply", JSON.stringify(input)),
      (input: ChangesetInput) => http.write("/api/changesets", input),
    ];
  }
  async function restart() {
    await server.close();
    for (const project of projects) {
      project.repository.close();
      project.repository = new SQLiteRepository(project.path);
      project.tracer = new Tracer(project.repository);
    }
    server = await start();
  }
  return { directory, projects, invoke, client, writers, restart };
}
function proposal(project: { type: string; fields: Fields }): ChangesetInput {
  return {
    expectedSchemaVersion: 1,
    operations: [{ op: "entity.create", input: { type: project.type, fields: project.fields } }],
  };
}

test("REQ-022 AC-1: core, subprocess CLI and HTTP operate without frontend assets in two configured domains", async (t) => {
  const f = await fixture(t);
  assert.equal(existsSync(join(f.directory, "dist")), false);
  for (const project of f.projects) {
    for (const write of await f.writers(project)) await write(proposal(project));
    const http = f.client(project);
    const snapshot = await http.read("/api/project-snapshot", {});
    assert.equal(snapshot.entities.length, 3);
    assert.ok(snapshot.entities.every((entity) => entity.type === project.type));
    assert.deepEqual(snapshot, await project.tracer.getProjectSnapshot());
    const exported = await project.tracer.exportProject();
    assert.deepEqual(await http.read("/api/project-export", {}), exported);
    assert.deepEqual(f.invoke(project, "project", "export"), exported);
    const page = await project.tracer.queryEntities({ type: project.type, limit: 1 });
    assert.ok(page.nextAfter);
    assert.deepEqual(await http.read("/api/entities", { type: project.type, limit: 1 }), page);
    assert.deepEqual(
      f.invoke(project, "entity", "list", JSON.stringify({ type: project.type, limit: 1 })),
      page,
    );
  }
});

test("REQ-022 AC-2: all interfaces share schema/object/head guards and select only the configured database", async (t) => {
  const f = await fixture(t);
  for (const project of f.projects) {
    const writes = await f.writers(project);
    const created = await writes[0](proposal(project));
    const id = created.results[0].id;
    await writes[1]({
      expectedSchemaVersion: 1,
      operations: [
        { op: "entity.update", id, expectedVersion: 1, input: { fields: project.fields } },
      ],
    });
    const current = (await project.tracer.getSchema())!;
    await project.tracer.setSchema(current, 1, provenance);
    const before = await project.tracer.exportProject();
    for (const write of writes) {
      await assert.rejects(write(proposal(project)), { code: "schema_conflict" });
      await assert.rejects(
        write({
          expectedSchemaVersion: 2,
          operations: [
            { op: "entity.update", id, expectedVersion: 1, input: { fields: project.fields } },
          ],
        }),
        { code: "conflict", details: { kind: "entity", id, expectedVersion: 1, actualVersion: 2 } },
      );
      await assert.rejects(
        write({ ...proposal(project), expectedSchemaVersion: 2, expectedProjectRevision: 1 }),
        { code: "conflict" },
      );
      await assert.rejects(
        write({
          expectedSchemaVersion: 2,
          operations: [{ op: "entity.create", input: { type: project.type, fields: {} } }],
        }),
        { code: "validation" },
      );
    }
    assert.deepEqual(await project.tracer.exportProject(), before);
    assert.equal((await project.tracer.getProjectSnapshot()).entities.length, 1);
  }
  // Selecting the second project above cannot write the first project's schema or population.
  assert.notDeepEqual(
    await f.projects[0].tracer.getSchema(),
    await f.projects[1].tracer.getSchema(),
  );
});

test("REQ-023 AC-1: lost-response recovery survives restart and repeated core/CLI/HTTP inspection allocates no writes", async (t) => {
  const f = await fixture(t);
  const project = f.projects[0];
  const input = {
    ...proposal(project),
    commandId: "uncertain-command",
    expectedProjectRevision: 1,
  };
  assert.equal(await project.tracer.getChangesetOutcome(input.commandId), null);
  let posts = 0;
  const interrupted = f.client(project, {
    fetch: async (...args) => {
      const response = await fetch(...args);
      if (args[1]?.method === "POST") {
        posts++;
        await response.arrayBuffer();
        throw new Error("Lost response after commit");
      }
      return response;
    },
  });
  await interrupted.connect();
  await assert.rejects(interrupted.write("/api/changesets", input), { code: "outcome_unknown" });
  assert.equal(posts, 1);
  await f.restart();
  const original = await project.tracer.getChangesetOutcome(input.commandId);
  assert.ok(original);
  // Original recovery must survive both stale guards and later changes to its output.
  await project.tracer.removeEntity(original.results[0].id, 1, 1, provenance);
  await project.tracer.setSchema((await project.tracer.getSchema())!, 1, provenance);
  const before = await project.tracer.exportProject();
  const http = f.client(project);
  for (let read = 0; read < 3; read++) {
    assert.deepEqual(await project.tracer.getChangesetOutcome(input.commandId), original);
    assert.deepEqual(f.invoke(project, "changeset", "outcome", input.commandId), original);
    assert.deepEqual(
      await http.read("/api/changeset-outcome", { commandId: input.commandId }),
      original,
    );
  }
  for (const write of await f.writers(project)) assert.deepEqual(await write(input), original);
  assert.equal(
    await f.client(f.projects[1]).read("/api/changeset-outcome", { commandId: input.commandId }),
    null,
  );
  assert.deepEqual(await project.tracer.exportProject(), before);
});

test("REQ-023 AC-2: changed operations, guards and provenance cannot reuse an identity across interfaces", async (t) => {
  const f = await fixture(t);
  const project = f.projects[0];
  const writes = await f.writers(project);
  const input = { ...proposal(project), commandId: "original-intent", expectedProjectRevision: 1 };
  const original = await writes[1](input);
  const before = await project.tracer.exportProject();
  for (const write of writes) {
    for (const changed of [
      { ...input, expectedSchemaVersion: 2 },
      { ...input, expectedProjectRevision: undefined },
      {
        ...input,
        operations: [
          {
            op: "entity.create" as const,
            input: { type: project.type, fields: { title: "Different" } },
          },
        ],
      },
    ])
      await assert.rejects(write(changed), { code: "conflict", details: { path: ["commandId"] } });
  }
  for (const changed of [
    { ...provenance, actor: "different" },
    { ...provenance, reason: "different" },
  ])
    await assert.rejects(project.tracer.applyChangeset(input, changed), { code: "conflict" });
  assert.deepEqual(await project.tracer.getChangesetOutcome(input.commandId), original);
  assert.deepEqual(await project.tracer.exportProject(), before);
  // Rejection must not reserve an identity; a deliberately corrected proposal can use it.
  const rejected = {
    ...proposal(project),
    commandId: "rejected-command",
    expectedSchemaVersion: 2,
  };
  for (const write of writes) {
    await assert.rejects(write(rejected), { code: "schema_conflict" });
    assert.equal(await project.tracer.getChangesetOutcome(rejected.commandId), null);
  }
  await writes[2]({ ...rejected, expectedSchemaVersion: 1 });
});

test("REQ-024 AC-1: actual discovery blocks missing/incompatible requirements before HTTP writes", async (t) => {
  const f = await fixture(t);
  const project = f.projects[0];
  const before = await project.tracer.exportProject();
  const cases: [Partial<ApiCapabilities>, CompatibilityRequirements][] = [
    [{}, { features: ["unsupported"] }],
    [{}, { operations: [{ method: "POST", path: "/api/missing" }] }],
    [{}, { minimumLimits: { maxChangesetOperations: 1001 } }],
    [{ api: "another-api" }, {}],
    [{ contractVersion: 1 }, {}],
    [{ contractVersion: 3 }, {}],
  ];
  for (const [override, require] of cases) {
    const requests: string[] = [];
    const client = f.client(project, {
      require,
      fetch: async (...args) => {
        requests.push(`${args[1]?.method} ${new URL(String(args[0])).pathname}`);
        const response = await fetch(...args);
        return Response.json({ ...(await response.json()), ...override });
      },
    });
    assert.throws(() => client.write("/api/changesets", proposal(project)), {
      code: "incompatible_api",
    });
    await assert.rejects(client.connect(), { code: "incompatible_api" });
    assert.throws(() => client.write("/api/changesets", proposal(project)), {
      code: "incompatible_api",
    });
    assert.deepEqual(requests, ["GET /api/capabilities"]);
  }
  assert.deepEqual(await project.tracer.exportProject(), before);
});

test("REQ-024 AC-2: a held old success cannot restore readiness after local, malformed or cancelled invalidation", async (t) => {
  const f = await fixture(t);
  const project = f.projects[0];
  for (const invalidation of ["requirements", "malformed", "cancelled"] as const) {
    let release!: () => void;
    let arrived!: () => void;
    const held = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    let hold = false;
    let malformed = false;
    let posts = 0;
    const client = f.client(project, {
      fetch: async (...args) => {
        if (args[1]?.method === "POST") posts++;
        if (malformed) return Response.json({ broken: true });
        const response = await fetch(...args);
        if (!hold) return response;
        hold = false;
        return new Promise<Response>((resolve) => {
          release = () => resolve(response);
          arrived();
        });
      },
    });
    await client.connect();
    await client.checkCompatibility();
    hold = true;
    const older = client.checkCompatibility();
    await held;
    assert.throws(() => client.write("/api/changesets", proposal(project)), {
      code: "incompatible_api",
    });
    if (invalidation === "requirements")
      await assert.rejects(client.checkCompatibility({ features: "bad" } as never), {
        code: "validation",
      });
    else if (invalidation === "malformed") {
      malformed = true;
      await assert.rejects(client.checkCompatibility(), { code: "read_failed" });
      malformed = false;
    } else
      await assert.rejects(client.checkCompatibility({}, { signal: AbortSignal.abort() }), {
        code: "read_failed",
      });
    release();
    await assert.rejects(older, { code: "incompatible_api" });
    assert.throws(() => client.write("/api/changesets", proposal(project)), {
      code: "incompatible_api",
    });
    assert.equal(posts, 0);
    // Only a new successful explicit check may restore readiness.
    await client.checkCompatibility();
    await client.write("/api/changesets", proposal(project));
    assert.equal(posts, 1);
  }
});
