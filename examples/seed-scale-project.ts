import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { inNewProject } from "./isolated-project.ts";
import type { Entity, Schema } from "../src/core/model.ts";
import type { Operation } from "../src/application/commands.ts";

export type Scale = "working" | "large";
const domains = [
  "requirement",
  "test",
  "component",
  "risk",
  "decision",
  "artifact",
  "interface",
  "evaluation",
  "experiment",
  "conclusion",
  "hazard",
  "constraint",
  "document",
  "supplier",
  "change_request",
  "issue",
  "protocol",
  "dataset",
  "analysis",
  "calibration",
  "procedure",
  "material",
  "standard",
  "assumption",
  "milestone",
  "subsystem",
  "configuration",
  "finding",
  "release",
  "review",
];
const subsystems = [
  "Power",
  "Drive",
  "Sensors",
  "Controls",
  "Communications",
  "Safety",
  "Thermal",
  "Structure",
];
const identity = (number: number) =>
  `10000000-0000-4000-8000-${String(number + 1).padStart(12, "0")}`;

/** Deterministic, uneven workloads with named tasks. Only a new owned directory is written. */
export async function seedScaleProject(destination: string, scale: Scale = "working") {
  if (!["working", "large"].includes(scale)) throw new Error("Scale must be working or large");
  return inNewProject(destination, async (tracer, { directory, database }) => {
    const actor = { actor: "scale-demo", reason: `Isolated ${scale} workload` };
    const count = scale === "large" ? 10000 : 1000,
      linkCount = scale === "large" ? 100000 : 5000;
    const types = domains.slice(0, scale === "large" ? 30 : 10);
    const schema = scaleSchema(types);
    await tracer.setSchema(schema, 0, actor);
    const { entities, byType } = scaleEntities(count, types);
    const requirements = byType.get("requirement")!,
      tests = byType.get("test")!,
      components = byType.get("component")!;
    requirements[392].fields.title = "Power isolation before restart";
    requirements[391].fields.title = "Sensor cutoff at 75 degrees";
    tests[240].fields.title = "Verify safe power restart";
    const apply = async (operations: Operation[]) => {
      for (let offset = 0; offset < operations.length; offset += 1000)
        await tracer.applyChangeset(
          { expectedSchemaVersion: 1, operations: operations.slice(offset, offset + 1000) },
          actor,
        );
    };
    await apply(entities.map((entity) => ({ op: "entity.create", id: entity.id, input: entity })));
    const operations: Operation[] = [],
      seen = new Set<string>();
    const add = (type: string, source: Entity, target: Entity) => {
      const key = `${type}:${source.id}:${target.id}`;
      if (seen.has(key) || operations.length >= linkCount) return;
      seen.add(key);
      operations.push({
        op: "relationship.create",
        id: identity(1000000 + operations.length),
        input: { type, source: source.id, target: target.id, fields: {} },
      });
    };
    for (let index = 0; index < requirements.length; index++) {
      if (index % 7) add("verified_by", requirements[index], tests[index % tests.length]);
      add("implemented_by", requirements[index], components[index % components.length]);
    }
    for (let index = 0; index < 300; index++) add("references", requirements[399], entities[index]);
    for (let index = 0; operations.length < linkCount; index++) {
      const source = entities[index % count],
        target = entities[(index * 37 + Math.floor(index / count) * 19 + 53) % count];
      add(
        ["references", "affects", "derived_from", "supports", "constrains"][
          Math.floor(index / count) % 5
        ],
        source,
        target,
      );
    }
    await apply(operations);
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: tests[240].id,
        outcome: "Power restart qualification using the sensor cutoff",
        inputs: [{ entityId: requirements[391].id, fields: ["title"] }],
      },
      actor,
    );
    await tracer.updateEntity(
      requirements[391].id,
      1,
      { fields: { ...requirements[391].fields, title: "Sensor cutoff changed to 80 degrees" } },
      1,
      { actor: "Morgan", reason: "New operating temperature envelope" },
    );
    const tasks = {
      scale,
      entities: count,
      links: linkCount,
      types: types.length,
      gap: requirements[392].key,
      target: tests[240].key,
      dense: requirements[399].key,
      changedInput: requirements[391].key,
      receipt: receipt.id,
    };
    writeFileSync(join(directory, "tasks.json"), JSON.stringify(tasks, null, 2) + "\n");
    writeFileSync(
      join(directory, "README.txt"),
      `Tracer ${scale} workload: ${count} items, ${linkCount} connections, ${types.length} types.\n1. In Work, find requirements in subsystem Power with no verified_by connection to a test.\n2. Select ${tasks.gap}; search tests for ${tasks.target} and connect it. The gap count should fall by one; context should remain.\n3. Find ${tasks.dense}; inspect its connections by type and page, without drawing all of them.\n4. Find ${tasks.changedInput}; open Table to edit it. In Evidence, choose the power restart qualification receipt and review the changed input.\nThese are synthetic task fixtures, not proof of human usability. No network, hooks or external source checkout is used.\nRestart: npm start -- --db ${JSON.stringify(database)}\n`,
    );
    return { directory, database, tasks };
  });
}

function scaleSchema(types: string[]) {
  const schema: Schema = {
    entityTypes: Object.fromEntries(
      types.map((type) => [
        type,
        {
          fields: {
            title: { type: "string", required: true },
            subsystem: { type: "string" },
            status: { type: "string" },
            owner: { type: "string" },
          },
        },
      ]),
    ),
    relationshipTypes: {
      verified_by: {
        source: ["requirement"],
        target: ["test"],
        fields: { method: { type: "string" } },
      },
      implemented_by: { source: ["requirement"], target: ["component"], fields: {} },
      references: { fields: {} },
      affects: { fields: {} },
      derived_from: { fields: {} },
      mitigates: {
        source: ["risk", ...(types.includes("hazard") ? ["hazard"] : [])],
        target: ["requirement"],
        fields: {},
      },
      contains: { fields: {} },
      supports: { fields: {} },
      constrains: { fields: {} },
      produces: { fields: {} },
    },
  };
  return schema;
}

function scaleEntities(count: number, types: string[]) {
  const entities: Entity[] = [],
    byType = new Map<string, Entity[]>();
  for (let index = 0; index < count; index++) {
    const type = scaleEntityType(index, count, types);
    const items = byType.get(type) ?? [];
    const ordinal = items.length;
    const prefix =
      { requirement: "REQ", test: "TEST", component: "COMP" }[type] ?? type.toUpperCase();
    const subsystem = subsystems[ordinal % subsystems.length];
    const entity: Entity = {
      id: identity(index),
      type,
      version: 1,
      key: `${prefix}-${String(ordinal).padStart(5, "0")}`,
      fields: {
        title:
          type === "test"
            ? "Verify startup"
            : `${subsystem} ${type.replaceAll("_", " ")} ${ordinal}`,
        subsystem,
        status: ordinal % 5 ? "Ready" : "Draft",
        owner: ["Alex", "Morgan", "Sam"][ordinal % 3],
      },
    };
    items.push(entity);
    byType.set(type, items);
    entities.push(entity);
  }
  return { entities, byType };
}

function scaleEntityType(index: number, count: number, types: string[]) {
  const type =
    index < count * 0.4
      ? "requirement"
      : index < count * 0.7
        ? "test"
        : index < count * 0.8
          ? "component"
          : types[3 + ((index - count * 0.8) % (types.length - 3))];
  return type;
}
