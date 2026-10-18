import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, previewCsvImport, Tracer } from "../src/index.ts";
import type { CsvImportMapping, CsvImportPreview, Schema } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const schema: Schema = {
  entityTypes: {
    item: {
      fields: {
        title: { type: "string", required: true },
        count: { type: "number" },
        active: { type: "boolean" },
        data: { type: "json" },
      },
    },
    other: { fields: { title: { type: "string" } } },
  },
  relationshipTypes: {
    depends_on: { source: ["item"], target: ["item"], fields: { reason: { type: "string" } } },
    allocated: { source: ["item"], target: ["other"], fields: {} },
    required_link: { fields: { reason: { type: "string", required: true } } },
  },
};
const origin = { actor: "csv-import-test", reason: "Import reviewed CSV" };
const records: CsvImportMapping = {
  kind: "records",
  type: "item",
  keyColumn: 0,
  fields: { title: 1 },
  links: [{ type: "depends_on", targetColumn: 2, fields: {} }],
};
const links: CsvImportMapping = {
  kind: "links",
  type: "depends_on",
  sourceColumn: 0,
  targetColumn: 1,
  fields: {},
};
async function fixture(run: (tracer: Tracer) => Promise<void>) {
  const repository = new SQLiteRepository(":memory:");
  try {
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, origin);
    await run(tracer);
  } finally {
    repository.close();
  }
}
function command(preview: CsvImportPreview) {
  return { expectedSchemaVersion: preview.schemaVersion, operations: preview.operations };
}

test("CSV parser preserves quoted commas, quotes, CRLF/newlines, empty cells and physical row numbers", () => {
  const table = parseCsv(
    '\uFEFFkey,title,tail\r\nA,"First, ""quoted""\r\nline",\r\n\r\nB,second,=SUM(A1)\r\n',
  );
  assert.deepEqual(table.headers, ["key", "title", "tail"]);
  assert.deepEqual(table.rows, [
    { line: 2, cells: ["A", 'First, "quoted"\r\nline', ""] },
    { line: 5, cells: ["B", "second", "=SUM(A1)"] },
  ]);
  for (const text of [
    "",
    "key\n",
    "key,key\nA,B",
    ",title\nA,B",
    'key,title\nA,"unclosed',
    'key,title\nA,b"c',
    'key,title\nA,"b"x',
  ])
    assert.throws(() => parseCsv(text), { code: "validation" });
  assert.throws(() => parseCsv("x".repeat(512 * 1024 + 1)), /512 KiB/);
  assert.throws(
    () => parseCsv(Array.from({ length: 101 }, (_, i) => `c${i}`).join(",") + "\nA"),
    /100 columns/,
  );
  assert.throws(
    () => parseCsv("key\n" + Array.from({ length: 1001 }, (_, i) => String(i)).join("\n")),
    /1,000 data rows/,
  );
});

test("record preview resolves exact existing keys and forward references, then saves one native changeset", async () =>
  fixture(async (tracer) => {
    const existing = await tracer.createEntity(
      { type: "item", key: "EXISTING", fields: { title: "Existing target" } },
      1,
      origin,
    );
    const before = await tracer.getProjectSnapshot();
    const preview = previewCsvImport(
      'key,title,target,unused\nA,"First, title",B,discard me\nB,Second,EXISTING,discard too',
      records,
      before,
    );
    assert.deepEqual(preview.issues, []);
    assert.deepEqual(preview.counts, { records: 2, links: 2 });
    assert.deepEqual(preview.ignoredColumns, ["unused"]);
    assert.equal(preview.rows[0].links[0].target, "B");
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    const saved = await tracer.applyChangeset(command(preview), origin);
    assert.equal(saved.results.length, 4);
    assert.equal(saved.changeset.projectRevision, before.projectRevision + 1);
    const snapshot = await tracer.getProjectSnapshot();
    const a = snapshot.entities.find((entity) => entity.key === "A")!,
      b = snapshot.entities.find((entity) => entity.key === "B")!;
    assert.ok(snapshot.relationships.some((link) => link.source === a.id && link.target === b.id));
    assert.ok(
      snapshot.relationships.some((link) => link.source === b.id && link.target === existing.id),
    );
    const history = (await tracer.history()).items.filter(
      (revision) => revision.changesetId === saved.changeset.id,
    );
    assert.equal(history.length, 4);
    await assert.rejects(tracer.applyChangeset(command(preview), origin), { code: "conflict" });
    assert.deepEqual(await tracer.getProjectSnapshot(), snapshot);
  }));

test("typed columns retain false/zero and literal formula strings while invalid cells block every operation", async () =>
  fixture(async (tracer) => {
    const mapping: CsvImportMapping = {
      kind: "records",
      type: "item",
      keyColumn: 0,
      fields: { title: 1, count: 2, active: 3, data: 4 },
      links: [],
    };
    const snapshot = await tracer.getProjectSnapshot();
    const valid = previewCsvImport(
      'key,title,count,active,data\nA,=SUM(A1),0,FALSE,"{""x"":1}"',
      mapping,
      snapshot,
    );
    assert.deepEqual(valid.issues, []);
    assert.deepEqual(valid.rows[0].fields, {
      title: "=SUM(A1)",
      count: 0,
      active: false,
      data: { x: 1 },
    });
    await tracer.applyChangeset(command(valid), origin);
    for (const cells of [
      "B,title,1 ppm,yes,invalid",
      "C,,Infinity,false,{}",
      "D,title,1e999,false,{}",
    ]) {
      const bad = previewCsvImport("key,title,count,active,data\n" + cells, mapping, snapshot);
      assert.ok(bad.issues.some((issue) => issue.line === 2));
      assert.deepEqual(bad.operations, []);
    }
  }));

test("duplicate keys, case differences, unresolved keys, wrong endpoint types and malformed widths are row errors", async () =>
  fixture(async (tracer) => {
    await tracer.createEntity(
      { type: "item", key: "EXACT", fields: { title: "Existing" } },
      1,
      origin,
    );
    await tracer.createEntity({ type: "other", key: "OTHER", fields: {} }, 1, origin);
    const before = await tracer.getProjectSnapshot();
    const preview = previewCsvImport(
      "key,title,target\nEXACT,Collision,EXACT\nA,First,exact\nA,Duplicate,OTHER\n,Missing key,EXACT\nB,Too,many,cells",
      records,
      before,
    );
    assert.ok(preview.issues.some((issue) => issue.message.includes("Key already exists")));
    assert.ok(preview.issues.some((issue) => issue.message.includes("Unknown target key: exact")));
    assert.ok(preview.issues.some((issue) => issue.message.includes("target type other")));
    assert.ok(
      preview.issues.some((issue) => issue.line === 5 && issue.message.includes("Missing key")),
    );
    assert.ok(
      preview.issues.some(
        (issue) => issue.line === 6 && issue.message.includes("Expected 3 cells"),
      ),
    );
    assert.deepEqual(preview.operations, []);
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
  }));

test("link-only preview maps metadata, rejects existing/repeated links and checks missing required fields", async () =>
  fixture(async (tracer) => {
    await tracer.createEntity({ type: "item", key: "A", fields: { title: "A" } }, 1, origin);
    await tracer.createEntity({ type: "item", key: "B", fields: { title: "B" } }, 1, origin);
    let snapshot = await tracer.getProjectSnapshot();
    const mapping: CsvImportMapping = { ...links, fields: { reason: 2 } };
    const preview = previewCsvImport("source,target,why\nA,B,Shared design", mapping, snapshot);
    assert.deepEqual(preview.issues, []);
    assert.equal(preview.rows[0].links[0].fields.reason, "Shared design");
    await tracer.applyChangeset(command(preview), origin);
    snapshot = await tracer.getProjectSnapshot();
    const duplicate = previewCsvImport(
      "source,target\nA,B\nB,A\nB,A\n,A\nA,missing",
      links,
      snapshot,
    );
    assert.ok(duplicate.issues.length >= 4);
    assert.deepEqual(duplicate.operations, []);
    assert.deepEqual(await tracer.getProjectSnapshot(), snapshot);
    const missing = previewCsvImport(
      "source,target\nA,B",
      { ...links, type: "required_link" },
      snapshot,
    );
    assert.ok(missing.issues.some((issue) => issue.message.includes("Required field: reason")));
  }));

test("empty optional targets create no link, but orphaned link fields produce an error", async () =>
  fixture(async (tracer) => {
    const snapshot = await tracer.getProjectSnapshot();
    const simple = previewCsvImport("key,title,target\nA,title,", records, snapshot);
    assert.deepEqual(simple.counts, { records: 1, links: 0 });
    assert.deepEqual(simple.issues, []);
    const extra: CsvImportMapping = {
      ...records,
      links: [{ type: "depends_on", targetColumn: 2, fields: { reason: 3 } }],
    };
    const invalid = previewCsvImport(
      "key,title,target,reason\nA,title,,Lost attribute",
      extra,
      snapshot,
    );
    assert.ok(invalid.issues.some((issue) => issue.message.includes("target key is empty")));
    assert.deepEqual(invalid.operations, []);
  }));

test("invalid mapping, absent models, required columns and batch limits never expose a partial commit", async () =>
  fixture(async (tracer) => {
    const snapshot = await tracer.getProjectSnapshot();
    for (const mapping of [
      { ...records, keyColumn: -1 },
      { ...records, type: "missing" },
      { ...records, fields: { typo: 1 } },
      { ...records, links: [{ type: "missing", targetColumn: 2, fields: {} }] },
      { ...records, kind: "typo" },
    ]) {
      const bad = previewCsvImport(
        "key,title,target\nA,title,",
        mapping as CsvImportMapping,
        snapshot,
      );
      assert.ok(bad.issues.length > 0);
      assert.deepEqual(bad.operations, []);
    }
    const unknown = previewCsvImport(
      "key,title\nA,title",
      { ...records, links: [] },
      { ...snapshot, schema: null },
    );
    assert.match(unknown.issues[0].message, /Configure/);
    const many =
      "key,title,target\n" +
      Array.from({ length: 501 }, (_, i) => `K${i},Title,K${(i + 1) % 501}`).join("\n");
    const capped = previewCsvImport(many, records, snapshot);
    assert.ok(capped.issues.some((issue) => issue.message.includes("1,000 combined")));
    assert.deepEqual(capped.operations, []);

    const tooLarge = previewCsvImport(
      "value\n" + "x".repeat(510 * 1024),
      { ...records, keyColumn: 0, fields: { title: 0 }, links: [] },
      snapshot,
    );
    assert.ok(tooLarge.issues.some((issue) => issue.message.includes("request size")));
    assert.deepEqual(tooLarge.operations, []);
  }));

test("a concurrent endpoint edit rejects a late link and rolls back earlier imported records and history", async () =>
  fixture(async (tracer) => {
    const target = await tracer.createEntity(
      { type: "item", key: "TARGET", fields: { title: "Old" } },
      1,
      origin,
    );
    const preview = previewCsvImport(
      "key,title,target\nA,First,TARGET\nB,Second,TARGET",
      records,
      await tracer.getProjectSnapshot(),
    );
    await tracer.updateEntity({
      id: target.id,
      fields: { title: "Changed after preview" },
      expectedVersion: 1,
      expectedSchemaVersion: 1,
      provenance: origin,
    });
    const before = await tracer.getProjectSnapshot(),
      history = await tracer.history();
    await assert.rejects(tracer.applyChangeset(command(preview), origin), { code: "conflict" });
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    assert.deepEqual(await tracer.history(), history);
  }));

test("schema changes and concurrently created stable keys reject the entire captured import", async () =>
  fixture(async (tracer) => {
    const preview = previewCsvImport(
      "key,title,target\nA,First,B\nB,Second,",
      records,
      await tracer.getProjectSnapshot(),
    );
    await tracer.createEntity(
      { type: "item", key: "B", fields: { title: "Concurrent B" } },
      1,
      origin,
    );
    const before = await tracer.getProjectSnapshot();
    await assert.rejects(tracer.applyChangeset(command(preview), origin), { code: "conflict" });
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    await tracer.setSchema(schema, 1, origin);
    const newer = await tracer.getProjectSnapshot();
    await assert.rejects(tracer.applyChangeset(command(preview), origin), {
      code: "schema_conflict",
    });
    assert.deepEqual(await tracer.getProjectSnapshot(), newer);
  }));

test("a link created after preview is rejected atomically rather than duplicated", async () =>
  fixture(async (tracer) => {
    const a = await tracer.createEntity(
      { type: "item", key: "A", fields: { title: "A" } },
      1,
      origin,
    );
    const b = await tracer.createEntity(
      { type: "item", key: "B", fields: { title: "B" } },
      1,
      origin,
    );
    const plan = previewCsvImport(
      "source,target\nB,A\nA,B",
      links,
      await tracer.getProjectSnapshot(),
    );
    await tracer.createRelationship(
      { type: "depends_on", source: a.id, target: b.id, fields: {} },
      1,
      origin,
    );
    const before = await tracer.getProjectSnapshot(),
      history = await tracer.history();
    await assert.rejects(tracer.applyChangeset(command(plan), origin), { code: "conflict" });
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    assert.deepEqual(await tracer.history(), history);
  }));

test("preview blocks imports that would make the complete workspace unreadable", async () =>
  fixture(async (tracer) => {
    const snapshot = await tracer.getProjectSnapshot();
    const full = {
      ...snapshot,
      entities: Array.from({ length: 10_000 }, (_, index) => ({
        id: crypto.randomUUID(),
        type: "item",
        key: `OLD-${index}`,
        fields: { title: "Existing" },
        version: 1,
      })),
    };
    const record = previewCsvImport("key,title\nNEW,New record", { ...records, links: [] }, full);
    assert.ok(record.issues.some((issue) => issue.message.includes("10,000 records")));
    assert.deepEqual(record.operations, []);
    const [a, b] = full.entities;
    const connections = {
      ...snapshot,
      entities: [a, b],
      relationships: Array.from({ length: 100_000 }, () => ({
        id: crypto.randomUUID(),
        type: "depends_on",
        source: a.id,
        target: a.id,
        fields: {},
        version: 1,
      })),
    };
    const link = previewCsvImport(`source,target\n${a.key},${b.key}`, links, connections);
    assert.ok(link.issues.some((issue) => issue.message.includes("100,000 connections")));
    assert.deepEqual(link.operations, []);

    const plan = previewCsvImport("key,title\nNEW,New record", { ...records, links: [] }, snapshot);
    await tracer.createEntity(
      { type: "item", key: "UNRELATED", fields: { title: "Concurrent work" } },
      1,
      origin,
    );
    const before = await tracer.getProjectSnapshot();
    await assert.rejects(
      tracer.applyChangeset(
        { ...command(plan), expectedProjectRevision: plan.projectRevision },
        origin,
      ),
      { code: "conflict" },
    );
    assert.deepEqual(await tracer.getProjectSnapshot(), before);
    await assert.rejects(
      tracer.applyChangeset({ ...command(plan), expectedProjectRevision: -1 }, origin),
      { code: "validation" },
    );
    const fresh = previewCsvImport("key,title\nNEW,New record", { ...records, links: [] }, before);
    await tracer.applyChangeset(
      { ...command(fresh), expectedProjectRevision: fresh.projectRevision },
      origin,
    );
    assert.equal((await tracer.getProjectSnapshot()).projectRevision, before.projectRevision + 1);
  }));
