import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Entity, Relationship, SchemaObject } from "../src/core/model.ts";
import type { Configuration, PinnedEntity } from "../src/core/configuration.ts";
import type { Receipt } from "../src/core/evidence.ts";
import type { Baseline, BaselineContents } from "../src/core/baseline.ts";
import type { SavedView } from "../src/core/presentation.ts";
import type {
  Connections,
  FamilyWorkspace,
  Graph,
  WorkingSet,
  ChainTable,
  Table,
  Matrix,
  RecordedConnections,
} from "../src/application/views.ts";

function fixture(run: (cli: ReturnType<typeof subprocessCli>, directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-cli-parity-"));
  try {
    run(subprocessCli(join(directory, "project.sqlite")), directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function subprocessCli(db: string) {
  const invoke = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        resolve("src/interfaces/cli.ts"),
        "--db",
        db,
        "--actor",
        "headless engineer",
        "--reason",
        "Explicit scoped engineering work",
        ...args,
      ],
      { encoding: "utf8" },
    );
  const cli = <T = unknown>(...args: string[]): T => {
    const result = invoke(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout) as T;
  };
  const error = (code: string, ...args: string[]) => {
    const result = invoke(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).error, code);
    assert.equal(result.stderr.trim().split("\n").length, 1);
  };
  return { cli, error, invoke };
}
const stringify = JSON.stringify;
function seed(cli: ReturnType<typeof subprocessCli>["cli"]) {
  cli(
    "schema",
    "set",
    stringify({
      entityTypes: {
        item: {
          fields: { title: { type: "string", required: true }, statement: { type: "string" } },
        },
      },
      relationshipTypes: { depends_on: { fields: {} } },
    }),
    "0",
  );
  const create = (key: string) =>
    cli<Entity>(
      "--schema-version",
      "1",
      "entity",
      "create",
      stringify({
        type: "item",
        key,
        fields: { title: key, statement: `${key} original statement` },
      }),
    );
  const output = create("OUTPUT"),
    hardware = create("HARDWARE"),
    software = create("SOFTWARE"),
    spare = create("SPARE");
  const link = (source: Entity, target: Entity) =>
    cli<Relationship>(
      "--schema-version",
      "1",
      "relationship",
      "create",
      stringify({ type: "depends_on", source: source.id, target: target.id, fields: {} }),
    );
  const links = [link(output, hardware), link(software, hardware), link(hardware, output)];
  return { output, hardware, software, spare, links };
}

test("CLI explicit configuration connection pins preserve chosen link revisions and require both captured endpoints", () =>
  fixture(({ cli, error }) => {
    const { output, hardware, links } = seed(cli);
    const members = [
      { entityId: output.id, version: 1 },
      { entityId: hardware.id, version: 1 },
    ];
    const history = cli("history");
    const proposal = {
      name: "Exact native interface",
      subjectId: output.id,
      expectedSubjectVersion: 1,
      members,
      relationships: [{ relationshipId: links[0].id, version: 1 }],
    };
    const capture = cli<Configuration>("configuration", "capture", stringify(proposal));
    assert.equal(capture.relationships!.length, 1);
    assert.equal(capture.relationships![0].relationship.version, 1);
    assert.equal(capture.relationships![0].schema.version, 1);
    assert.deepEqual(cli("history"), history);
    cli(
      "--schema-version",
      "1",
      "relationship",
      "update",
      links[0].id,
      "1",
      stringify({
        type: links[0].type,
        source: links[0].source,
        target: links[0].target,
        fields: {},
      }),
    );
    const latestHistory = cli("history");
    assert.deepEqual(cli("configuration", "get", capture.id), capture);
    error(
      "validation",
      "configuration",
      "capture",
      stringify({ ...proposal, name: "Missing endpoint", members: members.slice(0, 1) }),
    );
    error(
      "not_found",
      "configuration",
      "capture",
      stringify({
        ...proposal,
        name: "Missing revision",
        relationships: [{ relationshipId: links[0].id, version: 99 }],
      }),
    );
    assert.equal(cli<{ items: Configuration[] }>("configuration", "list").items.length, 1);
    assert.deepEqual(cli("history"), latestHistory);
  }));

test("CLI named baselines preserve exact historical contents and caller-identity retries without manufacturing revisions", () =>
  fixture(({ cli, error }) => {
    const { hardware, software, links } = seed(cli);
    const proposal = {
      id: "headless-baseline-intent",
      name: "Native commit before redesign",
      expectedProjectRevision: 8,
    };
    const baseline = cli<Baseline>("baseline", "capture", stringify(proposal));
    assert.equal(baseline.projectRevision, 8);
    assert.equal(baseline.actor, "headless engineer");
    assert.equal(baseline.reason, "Explicit scoped engineering work");
    const capturedHistory = cli("history");
    assert.deepEqual(cli("baseline", "get", baseline.id), baseline);
    assert.deepEqual(cli("baseline", "list"), { items: [baseline] });
    cli(
      "--schema-version",
      "1",
      "entity",
      "update",
      hardware.id,
      "1",
      stringify({ fields: { title: "HARDWARE", statement: "Changed only after baseline" } }),
    );
    cli("--schema-version", "1", "entity", "remove", software.id, "1", "cascade");
    const currentHistory = cli("history");
    assert.notDeepEqual(currentHistory, capturedHistory);
    assert.deepEqual(cli("baseline", "capture", stringify(proposal)), baseline);
    error(
      "conflict",
      "baseline",
      "capture",
      stringify({ ...proposal, name: "Different intention" }),
    );
    error("conflict", "--actor", "another engineer", "baseline", "capture", stringify(proposal));
    error(
      "conflict",
      "baseline",
      "capture",
      stringify({ name: "Stale head", expectedProjectRevision: 8 }),
    );
    const first = cli<BaselineContents>(
      "baseline",
      "contents",
      stringify({ baselineId: baseline.id, kind: "entity", limit: 1 }),
    );
    assert.equal(first.baseline.id, baseline.id);
    assert.equal(first.schema.version, 1);
    assert.equal(first.objects.items.length, 1);
    assert.ok(first.objects.nextAfter);
    const entities = [...first.objects.items];
    let after: string | undefined = first.objects.nextAfter;
    while (after) {
      const page: BaselineContents = cli<BaselineContents>(
        "baseline",
        "contents",
        stringify({ baselineId: baseline.id, kind: "entity", limit: 1, after }),
      );
      entities.push(...page.objects.items);
      after = page.objects.nextAfter;
    }
    assert.equal(entities.length, 4);
    assert.equal(
      (entities.find((item) => item.id === hardware.id) as Entity).fields.statement,
      "HARDWARE original statement",
    );
    assert.ok(entities.some((item) => item.id === software.id));
    const capturedLinks = cli<BaselineContents>(
      "baseline",
      "contents",
      stringify({ baselineId: baseline.id, kind: "relationship", limit: 100 }),
    );
    assert.deepEqual(
      new Set(capturedLinks.objects.items.map((link) => link.id)),
      new Set(links.map((link) => link.id)),
    );
    error(
      "validation",
      "baseline",
      "contents",
      stringify({ baselineId: baseline.id, kind: "relationship", after: first.objects.nextAfter }),
    );
    error("not_found", "baseline", "get", "missing");
    assert.deepEqual(cli("history"), currentHistory);
    assert.deepEqual(cli("baseline", "list"), { items: [baseline] });
  }));

test("CLI captures mixed revisions with exact schemas, retrieves immutable receipts after deletion, and leaves native history unchanged", () =>
  fixture(({ cli, error }) => {
    const { output, hardware, software, spare } = seed(cli);
    cli(
      "--schema-version",
      "1",
      "entity",
      "update",
      software.id,
      "1",
      stringify({ fields: { title: "SOFTWARE", statement: "SOFTWARE revised control logic" } }),
    );
    const capture = cli<Configuration>(
      "configuration",
      "capture",
      stringify({
        name: "Mixed native build",
        subjectId: output.id,
        expectedSubjectVersion: 1,
        members: [
          { entityId: hardware.id, version: 1 },
          { entityId: software.id, version: 2 },
          { entityId: spare.id, version: 1 },
        ],
      }),
    );
    assert.equal(capture.actor, "headless engineer");
    assert.equal(capture.reason, "Explicit scoped engineering work");
    assert.deepEqual(
      capture.members.map((member) => member.entity.version),
      [1, 2, 1],
    );
    const receipt = cli<Receipt>(
      "receipt",
      "record",
      stringify({
        outputId: output.id,
        expectedOutputVersion: 1,
        outcome: "Explicit mixed build evaluation",
        configurationId: capture.id,
        inputs: [{ entityId: hardware.id }, { entityId: software.id, fields: ["statement"] }],
      }),
    );
    assert.equal(receipt.inputs.length, 2);
    assert.equal(receipt.inputs[1].entity.fields.statement, "SOFTWARE revised control logic");
    assert.equal(receipt.inputs[1].pin!.schema.version, 1);
    const current = cli<SchemaObject>("schema", "get");
    const { id: _id, version: _version, ...definition } = current;
    cli(
      "schema",
      "set",
      stringify({
        ...definition,
        entityTypes: {
          item: {
            fields: { ...definition.entityTypes.item.fields, optional_new: { type: "string" } },
          },
        },
      }),
      "1",
    );
    cli(
      "--schema-version",
      "2",
      "entity",
      "update",
      hardware.id,
      "1",
      stringify({ fields: { title: "HARDWARE", statement: "HARDWARE current redesign" } }),
    );
    cli("--schema-version", "2", "entity", "remove", hardware.id, "2", "cascade");
    const history = cli("history"),
      captures = cli("configuration", "list");
    const pin = cli<PinnedEntity>("native-pin", "get", hardware.id, "1");
    assert.equal(pin.entity.fields.statement, "HARDWARE original statement");
    assert.equal(pin.schema.version, 1);
    assert.equal(pin.schema.entityTypes.item.fields.optional_new, undefined);
    assert.deepEqual(cli("configuration", "get", capture.id), capture);
    assert.deepEqual(cli("receipt", "get", receipt.id), receipt);
    assert.deepEqual(cli("configuration", "list"), captures);
    error("not_found", "configuration", "get", "missing");
    error("not_found", "receipt", "get", "missing");
    error("validation", "native-pin", "get", software.id, "0");
    error(
      "conflict",
      "configuration",
      "capture",
      stringify({
        name: "Stale subject",
        subjectId: output.id,
        expectedSubjectVersion: 2,
        members: [{ entityId: software.id, version: 2 }],
      }),
    );
    error(
      "validation",
      "receipt",
      "record",
      stringify({
        outputId: output.id,
        outcome: "Incompatible pin override",
        configurationId: capture.id,
        inputs: [{ entityId: software.id, expectedVersion: 2 }],
      }),
    );
    assert.deepEqual(cli("history"), history);
    assert.deepEqual(cli("configuration", "list"), captures);
  }));

test("CLI exposes bounded native projections with exact directions, pagination and no engineering writes", () =>
  fixture(({ cli, error }) => {
    const { output, hardware, software, links } = seed(cli),
      history = cli("history");
    const graph = cli<Graph>("graph", "get", stringify({ rootId: output.id, depth: 2 }));
    assert.equal(graph.rootId, output.id);
    assert.equal(new Set(graph.nodes.map((node) => node.id)).size, 3);
    assert.deepEqual(
      new Set(graph.links.map((link) => link.id)),
      new Set(links.map((link) => link.id)),
    );
    const family = cli<FamilyWorkspace>(
      "family",
      "get",
      stringify({
        rootId: hardware.id,
        relationshipType: "depends_on",
        direction: "incoming",
        limit: 1,
      }),
    );
    assert.equal(family.members.length, 1);
    assert.ok(family.nextAfter);
    const next = cli<FamilyWorkspace>(
      "family",
      "get",
      stringify({
        rootId: hardware.id,
        relationshipType: "depends_on",
        direction: "incoming",
        limit: 1,
        after: family.nextAfter,
      }),
    );
    assert.deepEqual(
      new Set([...family.members, ...next.members].map((member) => member.id)),
      new Set([output.id, software.id]),
    );
    const connections = cli<Connections>(
      "connections",
      "get",
      stringify({ id: hardware.id, limit: 1 }),
    );
    assert.equal(connections.total, 3);
    assert.equal(connections.items.length, 1);
    assert.ok(connections.nextAfter);
    const recorded = cli<RecordedConnections>(
      "model-connections",
      "get",
      stringify({ type: "depends_on", limit: 1 }),
    );
    assert.equal(recorded.relationships.items.length, 1);
    assert.ok(recorded.relationships.nextAfter);
    const work = cli<WorkingSet>("work", "get", stringify({ type: "item", limit: 1 }));
    assert.equal(work.total, 4);
    assert.equal(work.entities.items.length, 1);
    assert.ok(work.entities.nextAfter);
    assert.equal(cli<WorkingSet>("work", "get").total, 4);
    const chain = cli<ChainTable>(
      "chain",
      "get",
      stringify({
        type: "item",
        search: "OUTPUT",
        steps: [{ type: "item", relationshipType: "depends_on", direction: "outgoing" }],
      }),
    );
    assert.deepEqual(
      chain.rows[0].cells.map((cell) => cell?.id),
      [output.id, hardware.id],
    );
    assert.equal(
      cli<Table>("table", "get", stringify({ type: "item", focusId: software.id, limit: 1 }))
        .entities.items[0].id,
      software.id,
    );
    const matrix = cli<Matrix>(
      "matrix",
      "get",
      stringify({
        sourceType: "item",
        targetType: "item",
        relationshipType: "depends_on",
        limit: 2,
      }),
    );
    assert.equal(matrix.sources.items.length, 2);
    assert.equal(matrix.targets.items.length, 2);
    const timeline = cli<{ head: number; items: { projectRevision: number }[] }>("timeline", "get");
    assert.equal(timeline.head, 8);
    assert.deepEqual(
      timeline.items.map((item) => item.projectRevision),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.equal(cli<typeof timeline>("timeline", "get", "4").items.at(-1)!.projectRevision, 3);
    error("validation", "graph", "get", stringify({ rootId: output.id, depth: 7 }));
    error("validation", "connections", "get", stringify({ id: hardware.id, limit: 51 }));
    error("validation", "chain", "get", stringify({ type: "item", steps: [], limit: 21 }));
    error("validation", "table", "get", stringify({ type: "item", limit: 1001 }));
    assert.deepEqual(cli("history"), history);
  }));

test("CLI saved views are version-guarded presentation metadata and command errors preserve JSON stream contracts", () =>
  fixture(({ cli, error, invoke }, directory) => {
    const { output } = seed(cli),
      history = cli("history");
    const definition = {
      kind: "family",
      rootId: output.id,
      direction: "outgoing",
      relationshipType: "depends_on",
      layout: "reading",
      columns: [],
    };
    const initial = cli<SavedView>(
      "saved-view",
      "save",
      stringify({
        name: "Exact working scope",
        definition,
        expectedVersion: 0,
        expectedSchemaVersion: 1,
      }),
    );
    assert.equal(initial.version, 1);
    assert.deepEqual(cli("saved-view", "list"), [initial]);
    const updated = cli<SavedView>(
      "saved-view",
      "save",
      stringify({
        id: initial.id,
        name: "Renamed working scope",
        definition,
        expectedVersion: 1,
        expectedSchemaVersion: 1,
      }),
    );
    assert.equal(updated.version, 2);
    error("conflict", "saved-view", "remove", initial.id, "1");
    error(
      "schema_conflict",
      "saved-view",
      "save",
      stringify({
        id: initial.id,
        name: "Invalid current model",
        definition,
        expectedVersion: 2,
        expectedSchemaVersion: 9,
      }),
    );
    assert.deepEqual(cli("saved-view", "list"), [updated]);
    assert.deepEqual(cli("saved-view", "remove", initial.id, "2"), { removed: true });
    assert.deepEqual(cli("saved-view", "list"), []);
    error("usage", "configuration", "get");
    error("usage", "receipt", "get", "missing", "extra");
    error("usage", "graph", "get", "[]");
    error("usage", "work", "get", "{broken-json");
    error("usage", "constructor");
    error("usage", "--unknown", "value", "schema", "get");
    error(
      "usage",
      "entity",
      "create",
      stringify({ type: "item", fields: { title: "No captured schema" } }),
    );
    assert.deepEqual(cli("history"), history);
    const helpDb = join(directory, "help-does-not-open.sqlite");
    const help = invoke("--db", helpDb, "--help");
    assert.equal(help.status, 0);
    assert.match(help.stdout, /configuration capture/);
    assert.equal(help.stderr, "");
    assert.equal(existsSync(helpDb), false);
  }));
