import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { resolve } from "node:path";
import { Tracer } from "../src/index.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("next-work explains directly captured relationship changes and removal at 680px", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository),
    actor = { actor: "relationship evidence browser verification" };
  await tracer.setSchema(
    {
      entityTypes: { item: { fields: { title: { type: "string" } } } },
      relationshipTypes: { depends_on: { fields: { scope: { type: "string" } } } },
    },
    0,
    actor,
  );
  const source = await tracer.createEntity(
    { type: "item", fields: { title: "Design result" } },
    1,
    actor,
  );
  const target = await tracer.createEntity(
    { type: "item", fields: { title: "Definition" } },
    1,
    actor,
  );
  const link = await tracer.createRelationship(
    { type: "depends_on", source: source.id, target: target.id, fields: { scope: "Original" } },
    1,
    actor,
  );
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: source.id,
      outcome: "Fixture result; no execution success inferred",
      inputs: [],
      relationshipInputs: [{ id: link.id }],
    },
    actor,
  );
  const edited = await tracer.updateRelationship(
    link.id,
    1,
    { type: link.type, source: link.source, target: link.target, fields: { scope: "Revised" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.setViewportSize({ width: 680, height: 1000 });
    await page.goto(server.origin);
    await openProjectDestination(page, "Next work");
    const panel = page.getByRole("region", { name: "Next work", exact: true });
    await panel.getByRole("button", { name: "Changed evidence inputs 1", exact: true }).click();
    const queue = panel.getByRole("region", { name: "Changed evidence inputs", exact: true });
    await expect(queue).toContainText("1 changed inputs · 0 unknown inputs");
    await expect(queue).toContainText(receipt.outcome);
    await tracer.removeRelationship(edited.id, edited.version, 1, actor);
    const before = await tracer.exportProject();
    await panel.getByRole("button", { name: "Refresh queues", exact: true }).click();
    await expect(queue).toContainText("1 changed inputs · 1 unknown inputs");
    await expect(queue).toContainText(receipt.outcome);
    expect(await tracer.exportProject()).toEqual(before);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});
