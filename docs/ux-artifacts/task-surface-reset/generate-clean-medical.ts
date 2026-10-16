import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inNewProject } from "../../../examples/isolated-project.ts";
import type { Tracer } from "../../../src/application/service.ts";
import type { Entity, Relationship } from "../../../src/core/model.ts";
import type { Configuration } from "../../../src/core/configuration.ts";
import type { Receipt } from "../../../src/core/evidence.ts";
import { cleanupMedicalLinks } from "./medical-link-cleanup.ts";
import {
  configurationKey,
  cleanMedicalSchema,
  cleanMedicalItems,
  cleanMedicalLinks,
  selectedInputKeys,
  cleanMedicalReceipts,
  cleanMedicalChanges,
} from "./clean-medical-model.ts";

const origin = {
  actor: "clean-medical-study-author",
  reason:
    "Fresh isolated Aster medical study. All criteria, artifacts and results are fictional; no clinical or physical execution or approval is represented.",
};
type Items = Record<string, Entity>;
type ExportedReceipt = {
  receipt: Receipt;
  comparison: Awaited<ReturnType<Tracer["evidence"]["compareReceipt"]>>;
};

async function createItems(tracer: Tracer): Promise<Items> {
  const items: Items = {};
  for (const [type, key, title, statement, fields] of cleanMedicalItems()) {
    items[key] = (await tracer.createEntity(
      { type, key, fields: { title, statement, ...fields } },
      1,
      origin,
    )) as Entity;
  }
  return items;
}
async function createLinks(tracer: Tracer, items: Items): Promise<Relationship[]> {
  const links: Relationship[] = [];
  for (const [type, source, target, scope] of cleanMedicalLinks()) {
    links.push(
      (await tracer.createRelationship(
        {
          type,
          source: items[source].id,
          target: items[target].id,
          fields: scope === undefined ? {} : { scope },
        },
        1,
        origin,
      )) as Relationship,
    );
  }
  return links;
}
function selectedLinks(links: Relationship[], members: Entity[]) {
  const ids = new Set(members.map((entity) => entity.id));
  return links.filter((link) => ids.has(link.source) && ids.has(link.target));
}
async function captureInputs(
  tracer: Tracer,
  items: Items,
  links: Relationship[],
): Promise<Configuration> {
  const subject = items[configurationKey];
  const members = [subject, ...selectedInputKeys().map((key) => items[key])];
  return tracer.configurations.capture(
    {
      name: "Aster · selected verification inputs before temperature expansion",
      subjectId: subject.id,
      expectedSubjectVersion: subject.version,
      members: members.map((entity) => ({ entityId: entity.id, version: entity.version })),
      relationships: selectedLinks(links, members).map((link) => ({
        relationshipId: link.id,
        version: link.version,
      })),
    },
    {
      ...origin,
      reason:
        "Explicit native input revisions and internal trace revisions selected for simulated verification. Not an assembled build, complete BOM, approved baseline or inference of sufficient evidence.",
    },
  );
}
async function recordResults(
  tracer: Tracer,
  items: Items,
  configuration: Configuration,
): Promise<Receipt[]> {
  const receipts: Receipt[] = [];
  for (const definition of cleanMedicalReceipts) {
    const output = items[definition.output];
    receipts.push(
      await tracer.evidence.recordReceipt(
        {
          outputId: output.id,
          expectedOutputVersion: output.version,
          outcome: definition.outcome,
          configurationId: configuration.id,
          inputs: definition.inputs.map((key) => ({ entityId: items[key].id })),
        },
        origin,
      ),
    );
  }
  return receipts;
}
async function revisePressureInput(tracer: Tracer, items: Items) {
  for (const change of cleanMedicalChanges) {
    const before = items[change.key];
    items[change.key] = (await tracer.updateEntity(
      before.id,
      before.version,
      {
        fields: { ...before.fields, statement: change.statement },
      },
      1,
      { actor: origin.actor, reason: change.reason },
    )) as Entity;
  }
}
async function compareResults(tracer: Tracer, receipts: Receipt[]): Promise<ExportedReceipt[]> {
  return Promise.all(
    receipts.map(async (receipt) => ({
      receipt,
      comparison: await tracer.evidence.compareReceipt(receipt.id),
    })),
  );
}
async function validateNavigation(tracer: Tracer, items: Items) {
  const family = await tracer.getFamily({
    rootId: items["DEV-01"].id,
    relationshipType: "has_user_need",
    direction: "outgoing",
  });
  assert.equal(family.members.length, 5);
  await assert.rejects(
    tracer.createRelationship(
      {
        type: "has_user_need",
        source: items["DEV-01"].id,
        target: items["PRS-01"].id,
        fields: {},
      },
      1,
      origin,
    ),
    { code: "validation" },
  );
}
function validateExport(
  items: Items,
  links: Relationship[],
  results: ExportedReceipt[],
  configuration: Configuration,
) {
  assert.equal(Object.keys(items).length, 99);
  assert.equal(links.length, 219);
  assert.equal(configuration.members.length, 29);
  assert.equal(results.length, 8);
  assert.equal(results.filter((result) => result.comparison.hasChanged).length, 1);
  assert.equal(results[0].receipt.output.key, "RUN-01");
  assert.equal(results[0].comparison.hasChanged, true);
  assert.equal(
    Object.values(items).filter((item) => item.type === "validation_protocol").length,
    4,
  );
  validateValidationAbsence(items, links);
}
function validateValidationAbsence(items: Items, links: Relationship[]) {
  const validation = new Set(
    Object.values(items)
      .filter((item) => item.type === "validation_protocol")
      .map((item) => item.id),
  );
  assert.equal(
    links.filter((link) => link.type === "produces_result" && validation.has(link.source)).length,
    0,
  );
}
async function seed(tracer: Tracer) {
  await tracer.setSchema(cleanMedicalSchema(), 0, origin);
  const items = await createItems(tracer);
  const links = await createLinks(tracer, items);
  const configuration = await captureInputs(tracer, items, links);
  const receipts = await recordResults(tracer, items, configuration);
  await revisePressureInput(tracer, items);
  const currentLinks = await cleanupMedicalLinks(tracer, Object.values(items), links);
  const results = await compareResults(tracer, receipts);
  await validateNavigation(tracer, items);
  validateExport(items, currentLinks, results, configuration);
  return {
    title: "Aster Home BP monitor",
    domain: "medical",
    schema: await tracer.getSchema(),
    entities: Object.values(items),
    relationships: currentLinks,
    receipts: results,
    configurations: [configuration],
    counts: { entities: 99, relationships: 219, receipts: 8, configurations: 1 },
  };
}

async function generate() {
  const [destination, exportPath] = process.argv.slice(2);
  assert(
    destination && exportPath,
    "Usage: node generate-clean-medical.ts NEW_DIRECTORY NEW_EXPORT_JSON",
  );
  const exported = await inNewProject(destination, seed);
  writeFileSync(resolve(exportPath), JSON.stringify(exported, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      database: resolve(destination, "project.sqlite"),
      export: resolve(exportPath),
      ...exported.counts,
      types: Object.keys(exported.schema!.entityTypes).length,
      relationshipTypes: Object.keys(exported.schema!.relationshipTypes).length,
      capturedItems: exported.configurations[0].members.length,
      capturedRelationships: exported.configurations[0].relationships!.length,
      defaultScope: "DEV-01 → has_user_need → five user needs",
    }),
  );
}
await generate();
