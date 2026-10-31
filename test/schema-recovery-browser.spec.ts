import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("the production Model page retains a lost committed schema response and inspects it without replay", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-schema-recovery-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  const actor = { actor: "production-model-recovery" };
  await tracer.setSchema(
    { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
    0,
    actor,
  );
  await tracer.createEntity(
    { key: "ROOT", type: "item", fields: { title: "Retained project" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin + "/#model");
    const model = page.getByLabel("Configure project model", { exact: true });
    await model.getByRole("button", { name: "Text", exact: true }).click();
    await model.getByLabel("Advanced JSON", { exact: true }).check();
    const json = model.getByLabel("Project schema JSON", { exact: true });
    const draft = JSON.parse(await json.inputValue());
    draft.entityTypes.pending = { fields: { title: { type: "string" } } };
    const proposed = JSON.stringify(draft);
    await json.fill(proposed);
    let posts = 0;
    await page.route("**/api/schema", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posts++;
      await route.fetch();
      await route.abort("connectionfailed");
    });
    await model.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(model.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    await expect(json).toHaveValue(proposed);
    expect((await tracer.getSchema())?.version).toBe(2);
    expect((await tracer.getSchema())?.entityTypes.pending).toEqual(draft.entityTypes.pending);
    await page.unroute("**/api/schema");
    await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
    await page.getByRole("button", { name: "Inspect saved result", exact: true }).click();
    await expect(page.locator("#workspace-dialog")).toContainText(
      "No automatic retry has been sent",
    );
    await page.getByRole("button", { name: "I have inspected the result", exact: true }).click();
    expect(posts).toBe(1);
    expect((await tracer.getSchema())?.version).toBe(2);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
