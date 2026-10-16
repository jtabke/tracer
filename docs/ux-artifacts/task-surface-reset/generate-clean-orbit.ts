import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inNewProject } from "../../../examples/isolated-project.ts";
import { integratedProductExample as original } from "../../../examples/integrated-product-example.ts";
import type { Tracer } from "../../../src/application/service.ts";
import type { Entity, Relationship, Fields } from "../../../src/core/model.ts";
import type { Configuration } from "../../../src/core/configuration.ts";
import type { Receipt } from "../../../src/core/evidence.ts";
import {
  cleanOrbitSchema,
  orbitReceiptSchema,
  cleanOrbitItems,
  cleanOrbitLinks,
  orbitReceiptDefinitions,
  orbitSelections,
  orbitActivityUpdates,
  orbitChanges,
  orbitFollowUp,
} from "./clean-orbit-model.ts";

type Items = Record<string, Entity>;
const author = {
  actor: "clean-orbit-study-author",
  reason:
    "Fresh isolated Orbit candidate. All product artifacts, criteria and results are fictional; this is not the former review fixture or a physical build.",
};
async function createRecords(tracer: Tracer): Promise<Items> {
  const records: Items = {};
  for (const [type, key, title, statement, fields] of cleanOrbitItems())
    records[key] = (await tracer.createEntity(
      {
        type,
        key,
        fields: { title, statement, ...fields },
      },
      1,
      author,
    )) as Entity;
  return records;
}
async function connectRecords(tracer: Tracer, records: Items) {
  const relationships: Relationship[] = [];
  for (const [type, source, target, scope] of cleanOrbitLinks())
    relationships.push(
      (await tracer.createRelationship(
        {
          type,
          source: records[source].id,
          target: records[target].id,
          fields: scope === undefined ? {} : { scope },
        },
        1,
        author,
      )) as Relationship,
    );
  return relationships;
}
function internalRelationships(relationships: Relationship[], members: Entity[]) {
  const selected = new Set(members.map((entity) => entity.id));
  return relationships.filter((link) => selected.has(link.source) && selected.has(link.target));
}
async function captureSelection(
  tracer: Tracer,
  name: string,
  subject: Entity,
  members: Entity[],
  relationships: Relationship[],
  reason: string,
) {
  return tracer.configurations.capture(
    {
      name,
      subjectId: subject.id,
      expectedSubjectVersion: subject.version,
      members: members.map((entity) => ({ entityId: entity.id, version: entity.version })),
      relationships: internalRelationships(relationships, members).map((link) => ({
        relationshipId: link.id,
        version: link.version,
      })),
    },
    { actor: author.actor, reason },
  );
}
async function recordSelections(tracer: Tracer, records: Items, relationships: Relationship[]) {
  const configurations: Record<string, Configuration> = {};
  for (const selection of orbitSelections) {
    const subject = records[selection.key];
    configurations[selection.key] = await captureSelection(
      tracer,
      `${selection.key} · selected native evaluation inputs`,
      subject,
      [subject, ...selection.members.map((key) => records[key])],
      relationships,
      "Explicit selected native inputs and internal connection revisions. The alternative is a different proposal; neither capture establishes an assembled physical build, execution or acceptance.",
    );
  }
  return configurations;
}
async function recordResults(
  tracer: Tracer,
  records: Items,
  configurations: Record<string, Configuration>,
) {
  const receipts: Receipt[] = [];
  for (const definition of orbitReceiptDefinitions)
    receipts.push(
      await tracer.evidence.recordReceipt(
        {
          outputId: records[definition.output].id,
          expectedOutputVersion: 1,
          outcome: definition.outcome,
          configurationId: configurations["BUILD-R01"].id,
          inputs: definition.inputs.map((key) => ({ entityId: records[key].id })),
        },
        {
          ...author,
          reason:
            "Record the original authored simulated report and declared input set before current activity normalization or the proposed control-profile edit.",
        },
      ),
    );
  return receipts;
}
async function normalizeActivities(tracer: Tracer, records: Items) {
  for (const [key, definition] of Object.entries(orbitActivityUpdates)) {
    const before = records[key];
    const fields: Fields = { ...before.fields, ...definition };
    delete fields.outcome;
    records[key] = (await tracer.updateEntity(before.id, before.version, { fields }, 1, {
      actor: author.actor,
      reason:
        "Normalize the current evaluation activity's method and purpose. Its original v1 simulated report stays immutable in its receipt; current activity text does not establish execution.",
    })) as Entity;
  }
}
async function reviseControl(tracer: Tracer, records: Items) {
  for (const change of orbitChanges) {
    const before = records[change.key];
    records[change.key] = (await tracer.updateEntity(
      before.id,
      before.version,
      {
        fields: { ...before.fields, statement: change.statement },
      },
      1,
      { actor: author.actor, reason: change.reason },
    )) as Entity;
  }
}
async function recordFollowUp(tracer: Tracer, records: Items, relationships: Relationship[]) {
  return captureSelection(
    tracer,
    orbitFollowUp.name,
    records[orbitFollowUp.subject],
    orbitFollowUp.members.map((key) => records[key]),
    relationships,
    orbitFollowUp.reason,
  );
}
async function compare(tracer: Tracer, receipts: Receipt[]) {
  return Promise.all(
    receipts.map(async (receipt) => ({
      receipt,
      comparison: await tracer.evidence.compareReceipt(receipt.id),
    })),
  );
}
function validateReportStrings(receipts: Receipt[]) {
  const byKey = new Map(original.items.map((item) => [item[1], item]));
  for (const receipt of receipts) {
    const source = byKey.get(receipt.output.key!)!;
    assert.equal(receipt.output.version, 1);
    assert.equal(receipt.output.fields.title, source[2]);
    assert.equal(receipt.output.fields.statement, source[3]);
    assert.equal(receipt.output.fields.outcome, source[4]!.outcome);
    assert.equal(receipt.output.fields.method, source[4]!.method);
    assert.equal(receipt.output.fields.purpose, source[4]!.purpose);
  }
}
async function validateScope(tracer: Tracer, records: Items) {
  const family = await tracer.getFamily({
    rootId: records["DES-01"].id,
    relationshipType: "realized_by",
    direction: "incoming",
  });
  assert.deepEqual(family.members.map((member) => member.key).sort(), [
    "REQ-R01",
    "REQ-R03",
    "REQ-R04",
    "REQ-R05",
    "REQ-R10",
  ]);
  await assert.rejects(
    tracer.createRelationship(
      {
        type: "has_goal",
        source: records["ROBOT-01"].id,
        target: records["REQ-R01"].id,
        fields: {},
      },
      2,
      author,
    ),
    { code: "validation" },
  );
}
function validateCounts(
  records: Items,
  relationships: Relationship[],
  configurations: Configuration[],
) {
  assert.equal(Object.keys(records).length, 71);
  assert.equal(relationships.length, 174);
  assert.deepEqual(
    configurations.map((configuration) => configuration.members.length),
    [15, 10, 5],
  );
  assert.equal(records["DES-01"].version, 2);
  for (const key of Object.keys(orbitActivityUpdates)) assert.equal(records[key].version, 2);
}
async function seed(tracer: Tracer) {
  await tracer.setSchema(orbitReceiptSchema(), 0, author);
  const records = await createRecords(tracer);
  const relationships = await connectRecords(tracer, records);
  const selected = await recordSelections(tracer, records, relationships);
  const receipts = await recordResults(tracer, records, selected);
  validateReportStrings(receipts);
  await normalizeActivities(tracer, records);
  await reviseControl(tracer, records);
  const followUp = await recordFollowUp(tracer, records, relationships);
  await tracer.setSchema(cleanOrbitSchema(), 1, {
    actor: author.actor,
    reason:
      "Remove result-only outcome from current evaluation activity authoring after native report capture and activity normalization. Historical receipts and configuration pins keep schema v1.",
  });
  const configurations = [...Object.values(selected), followUp];
  validateCounts(records, relationships, configurations);
  await validateScope(tracer, records);
  return {
    title: "Orbit R1 robotic vacuum",
    domain: "integrated",
    schema: await tracer.getSchema(),
    entities: Object.values(records),
    relationships,
    receipts: await compare(tracer, receipts),
    configurations,
    counts: { entities: 71, relationships: 174, receipts: 4, configurations: 3 },
  };
}
async function generate() {
  const [destination, exportPath] = process.argv.slice(2);
  assert(
    destination && exportPath,
    "Usage: node generate-clean-orbit.ts NEW_DIRECTORY NEW_EXPORT_JSON",
  );
  const data = await inNewProject(destination, seed);
  writeFileSync(resolve(exportPath), JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      database: resolve(destination, "project.sqlite"),
      export: resolve(exportPath),
      ...data.counts,
      types: Object.keys(data.schema!.entityTypes).length,
      relationshipTypes: Object.keys(data.schema!.relationshipTypes).length,
      captures: data.configurations.map((capture) => ({
        name: capture.name,
        items: capture.members.length,
        relationships: capture.relationships!.length,
      })),
      changedReceipts: data.receipts
        .filter((result) => result.comparison.hasChanged)
        .map((result) => result.receipt.output.key),
    }),
  );
}
await generate();
