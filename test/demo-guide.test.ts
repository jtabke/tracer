import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoGuide, readDemoGuide } from "../src/interfaces/demo-guide.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const raw = {
  title: "Example <script>literal</script>",
  description: "An explicit guide, not a product policy.",
  sources: [{ path: "/private/source-path" }],
  keys: { secret: "unrelated" },
  tasks: [
    {
      title: "Inspect a family",
      root: "REQ-1",
      rootId: "item-id",
      relationship: "contributes_to",
      explanation: "Compare siblings.",
      url: "javascript:alert(1)",
    },
  ],
  chains: [
    {
      title: "Trace",
      query: {
        type: "requirement",
        search: "REQ-1",
        steps: [{ type: "design", relationshipType: "mapped_to" }],
      },
    },
  ],
};

test("demo metadata is bounded and normalized without raw locators or executable navigation", () => {
  const guide = demoGuide(raw);
  assert.equal(guide.tasks[0].direction, "outgoing");
  assert.equal(guide.chains[0].query.steps[0].direction, "outgoing");
  assert.equal(Object.hasOwn(guide.tasks[0], "url"), false);
  assert.equal(Object.hasOwn(guide, "sources"), false);
  assert.throws(() => demoGuide({ ...raw, tasks: Array(13).fill(raw.tasks[0]) }), {
    code: "usage",
  });
  assert.throws(() => demoGuide({ ...raw, tasks: [{ ...raw.tasks[0], direction: "both" }] }), {
    code: "usage",
  });
  assert.throws(
    () =>
      demoGuide({
        ...raw,
        chains: [
          {
            title: "Too deep",
            query: { type: "requirement", steps: Array(8).fill(raw.chains[0].query.steps[0]) },
          },
        ],
      }),
    { code: "usage" },
  );
});

test("explicit guide files reject malformed and oversized contents", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-demo-guide-"));
  try {
    const file = join(directory, "tasks.json");
    writeFileSync(file, JSON.stringify(raw));
    assert.deepEqual(await readDemoGuide(file), demoGuide(raw));
    writeFileSync(file, "{");
    await assert.rejects(readDemoGuide(file), /valid JSON/);
    writeFileSync(file, " ".repeat(256 * 1024 + 1));
    await assert.rejects(readDemoGuide(file), { code: "usage" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ordinary projects expose no guide; explicit guides obey local origin and filter boundaries", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const directory = mkdtempSync(join(tmpdir(), "tracer-demo-server-"));
  const plain = await startLocalServer(tracer, directory, 0);
  const guided = await startLocalServer(tracer, directory, 0, demoGuide(raw));
  try {
    assert.equal(await (await fetch(plain.origin + "/api/demo-guide")).json(), null);
    assert.deepEqual(await (await fetch(guided.origin + "/api/demo-guide")).json(), demoGuide(raw));
    assert.equal(
      (await fetch(guided.origin + "/api/demo-guide?path=/private/source-path")).status,
      400,
    );
    assert.equal(
      (
        await fetch(guided.origin + "/api/demo-guide", {
          headers: { Origin: "https://unrelated.example" },
        })
      ).status,
      403,
    );
    assert.equal(await tracer.getSchema(), undefined);
  } finally {
    await plain.close();
    await guided.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
