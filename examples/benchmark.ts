import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { benchmarkEvidence } from "./benchmark-evidence.ts";
import type { Operation } from "../src/application/commands.ts";

// Disposable representative workload, not a release gate or a server benchmark.
const directory = mkdtempSync(join(tmpdir(), "tracer-benchmark-"));
const path = join(directory, "benchmark.sqlite");
const repository = new SQLiteRepository(path);
const count = 10000,
  linkCount = 100000,
  ids = Array.from({ length: count }, () => crypto.randomUUID());
const origin = { actor: "benchmark" };
let closed = false;
try {
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string", required: true } } } },
      relationshipTypes: { depends: { fields: {} } },
    },
    0,
    origin,
  );
  const seed = performance.now();
  for (let offset = 0; offset < count; offset += 1000) {
    const operations: Operation[] = ids.slice(offset, offset + 1000).map((id, index) => ({
      op: "entity.create",
      id,
      input: {
        type: "item",
        key: "ITEM-" + (offset + index),
        fields: { title: "Item " + (offset + index) },
      },
    }));
    await tracer.applyChangeset({ expectedSchemaVersion: 1, operations }, origin);
  }
  for (let offset = 0; offset < linkCount; offset += 1000) {
    const operations: Operation[] = Array.from({ length: 1000 }, (_, index) => {
      const i = offset + index;
      return {
        op: "relationship.create",
        input: {
          type: "depends",
          source: ids[i % count],
          target: ids[(i + 1 + Math.floor(i / count) * 97) % count],
          fields: {},
        },
      };
    });
    await tracer.applyChangeset({ expectedSchemaVersion: 1, operations }, origin);
  }
  const seedMs = performance.now() - seed;
  let started = performance.now();
  const entities = await tracer.queryEntities({ type: "item", limit: 100 });
  const entityPageMs = performance.now() - started;
  started = performance.now();
  const incident = await tracer.queryRelationships({ incident: ids[0], limit: 100 });
  const incidentMs = performance.now() - started;
  started = performance.now();
  const traced = await tracer.traverse(ids[0], { maxDepth: 2 });
  const traversalMs = performance.now() - started;
  const evidenceImpact = await benchmarkEvidence(tracer, ids);
  repository.close();
  closed = true;
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        entities: count,
        relationships: linkCount,
        seedMs,
        entityPageMs,
        incidentMs,
        traversalDepth2Ms: traversalMs,
        entityPageSize: entities.items.length,
        incidentSize: incident.items.length,
        tracedNodes: traced.length,
        evidenceImpact,
        databaseBytes: statSync(path).size,
      },
      null,
      2,
    ),
  );
} finally {
  if (!closed) repository.close();
  rmSync(directory, { recursive: true, force: true });
}
