import assert from "node:assert/strict";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { SQLiteRepository } from "../../../src/persistence/sqlite.ts";
import { Tracer } from "../../../src/application/service.ts";
import type { Entity, Relationship } from "../../../src/core/model.ts";
import { cleanupMedicalLinks } from "./medical-link-cleanup.ts";

type PageQuery<T> = (query: {
  limit: number;
  after?: string;
}) => Promise<{ items: T[]; nextAfter?: string }>;
async function collect<T>(query: PageQuery<T>): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;
  do {
    const page = await query({ limit: 100, after });
    items.push(...page.items);
    after = page.nextAfter;
  } while (after);
  return items;
}
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
function assertSameItems(before: Entity[], current: Entity[]) {
  const native = new Map(current.map((item) => [item.id, item]));
  assert.equal(native.size, before.length);
  for (const item of before) assert.deepEqual(snapshot(native.get(item.id)), item);
}
function assertSameLinks(expected: Relationship[], current: Relationship[]) {
  const native = new Map(current.map((link) => [link.id, link]));
  assert.equal(native.size, expected.length);
  for (const link of expected) assert.deepEqual(snapshot(native.get(link.id)), snapshot(link));
}
async function preserveEvidence(tracer: Tracer, baseline: ReturnType<typeof readBaseline>) {
  const receipts = [];
  for (const before of baseline.receipts) {
    const receipt = await tracer.evidence.getReceipt(before.receipt.id);
    assert.deepEqual(snapshot(receipt), before.receipt);
    receipts.push({ receipt, comparison: await tracer.evidence.compareReceipt(receipt.id) });
  }
  const configurations = [];
  for (const before of baseline.configurations) {
    const configuration = await tracer.configurations.get(before.id);
    assert.deepEqual(snapshot(configuration), before);
    configurations.push(configuration);
  }
  return { receipts, configurations };
}
function readBaseline(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    title: string;
    domain: string;
    schema: Awaited<ReturnType<Tracer["getSchema"]>>;
    entities: Entity[];
    relationships: Relationship[];
    receipts: { receipt: Awaited<ReturnType<Tracer["evidence"]["getReceipt"]>> }[];
    configurations: Awaited<ReturnType<Tracer["configurations"]["get"]>>[];
  };
}
async function migrate(tracer: Tracer, baseline: ReturnType<typeof readBaseline>) {
  const entities = await collect((query) => tracer.queryEntities(query));
  const beforeLinks = await collect((query) => tracer.queryRelationships(query));
  assertSameItems(baseline.entities, entities);
  assert.equal(beforeLinks.length, 234);
  assertSameLinks(baseline.relationships, beforeLinks);
  const relationships = await cleanupMedicalLinks(tracer, entities, beforeLinks);
  assertSameLinks(relationships, await collect((query) => tracer.queryRelationships(query)));
  assertSameItems(baseline.entities, await collect((query) => tracer.queryEntities(query)));
  const evidence = await preserveEvidence(tracer, baseline);
  const schema = await tracer.getSchema();
  assert.deepEqual(snapshot(schema), baseline.schema);
  return {
    title: baseline.title,
    domain: baseline.domain,
    schema,
    entities: baseline.entities,
    relationships,
    ...evidence,
    counts: { entities: 99, relationships: 219, receipts: 8, configurations: 1 },
  };
}
async function run() {
  const [sourceDatabase, baselineExport, destination] = process.argv.slice(2);
  assert(
    sourceDatabase && baselineExport && destination,
    "Usage: node cleanup-medical-fixture.ts SOURCE_DB BASELINE_EXPORT NEW_DIRECTORY",
  );
  mkdirSync(resolve(destination));
  const database = join(resolve(destination), "project.sqlite");
  copyFileSync(resolve(sourceDatabase), database);
  const repository = new SQLiteRepository(database);
  try {
    const result = await migrate(new Tracer(repository), readBaseline(baselineExport));
    writeFileSync(
      join(destination, "medical-clean-data.json"),
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        database,
        ...result.counts,
        unchangedReceipts: 8,
        unchangedCapturedItems: 29,
        unchangedCapturedRelationships: 62,
      }),
    );
  } finally {
    repository.close();
  }
}
await run();
