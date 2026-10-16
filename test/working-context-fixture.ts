import type { Entity, Schema } from "../src/core/model.ts";
import type { Receipt } from "../src/core/evidence.ts";
import type { WorkingContextQuery, WorkingRecipe } from "../src/core/working-context.ts";
import type { Operation } from "../src/application/commands.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

export const actor = { actor: "working-context integration QA" };
export const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const fields = { title: { type: "string" as const }, note: { type: "string" as const } };
const relation = (source: string[], target: string[]) => ({ source, target, fields: {} });
export const schema: Schema = {
  entityTypes: Object.fromEntries(
    ["design", "requirement", "evaluation", "protocol", "run", "aux"].map((type) => [
      type,
      { fields },
    ]),
  ),
  relationshipTypes: {
    realized_by: relation(["requirement"], ["design"]),
    evaluated_by: {
      ...relation(["requirement"], ["evaluation"]),
      fields: { scope: { type: "string" } },
    },
    verified_by: relation(["requirement"], ["protocol"]),
    produces_result: relation(["protocol"], ["run"]),
    broad: relation(["design"], ["aux", "requirement"]),
    dependency: relation(["evaluation", "design", "requirement"], ["design", "requirement", "aux"]),
  },
};
const definitions = {
  focus: "design",
  otherFocus: "design",
  rowA: "requirement",
  rowB: "requirement",
  rowC: "requirement",
  evalA: "evaluation",
  evalB: "evaluation",
  evalOther: "evaluation",
  protocolA: "protocol",
  protocolB: "protocol",
  runA: "run",
  runB: "run",
  aux: "aux",
  otherAux: "aux",
} as const;
export type WorkingFixture = Awaited<ReturnType<typeof fixture>>;

export async function fixture(database = ":memory:") {
  const repository = new SQLiteRepository(database),
    tracer = new Tracer(repository);
  await tracer.setSchema(schema, 0, actor);
  const entries = Object.entries(definitions);
  const result = await tracer.applyChangeset(
    {
      expectedSchemaVersion: 1,
      operations: entries.map(([key, type], index): Operation => ({
        op: "entity.create",
        id: uuid(index + 1),
        input: { type, key, fields: { title: key } },
      })),
    },
    actor,
  );
  const entities = Object.fromEntries(
    entries.map(([key], index) => [key, result.results[index] as Entity]),
  ) as Record<keyof typeof definitions, Entity>;
  return { repository, tracer, entities };
}

export async function link(fixture: WorkingFixture, type: string, source: Entity, target: Entity) {
  return fixture.tracer.createRelationship(
    { type, source: source.id, target: target.id, fields: {} },
    1,
    actor,
  );
}

const recipe: WorkingRecipe = {
  members: { relationshipType: "realized_by", direction: "incoming", type: "requirement" },
  routes: [
    {
      key: "evaluations",
      label: "Authored evaluation route",
      steps: [{ relationshipType: "evaluated_by", direction: "outgoing", type: "evaluation" }],
      receipts: true,
    },
  ],
};
export const query = (fixture: WorkingFixture, extra: Partial<WorkingContextQuery> = {}) => ({
  focusId: fixture.entities.focus.id,
  recipe: structuredClone(recipe),
  ...extra,
});

export async function orbit(database?: string) {
  const f = await fixture(database),
    e = f.entities;
  const memberships = [
    await link(f, "realized_by", e.rowA, e.focus),
    await link(f, "realized_by", e.rowA, e.focus),
    await link(f, "realized_by", e.rowB, e.focus),
  ];
  await link(f, "evaluated_by", e.rowA, e.evalA);
  await link(f, "evaluated_by", e.rowB, e.evalA);
  await link(f, "evaluated_by", e.rowA, e.evalB);
  return { ...f, memberships };
}

export function captureReceipt(
  f: WorkingFixture,
  output: Entity,
  inputs: Entity[],
  extra: { supersedes?: string } = {},
): Promise<Receipt> {
  return f.tracer.evidence.recordReceipt(
    {
      outputId: output.id,
      outcome: "Recorded result; not an inferred engineering judgment",
      inputs: inputs.map((input) => ({ entityId: input.id })),
      ...extra,
    },
    actor,
  );
}

export async function clocks(f: WorkingFixture) {
  return {
    head: (await f.tracer.timeline()).head,
    history: await f.tracer.history({ limit: 1000 }),
    evidence: await f.repository.transaction((tx) => tx.impactEvidenceRevision()),
    receipts: await f.tracer.evidence.list("receipt", { limit: 1000 }),
  };
}
