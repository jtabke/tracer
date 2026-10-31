import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { productModel } from "../examples/product-model-schema.ts";

test("worked product guide creates a native model, items and links from an empty database", async ({
  page,
}) => {
  const guide = readFileSync("docs/guides/custom-model.md", "utf8");
  const json = guide.match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(json, "Worked guide must include the complete model JSON");
  assert.deepEqual(JSON.parse(json), productModel);
  const directory = mkdtempSync(join(tmpdir(), "tracer-product-guide-"));
  const database = join(directory, "project.sqlite");
  try {
    const repository = new SQLiteRepository(database);
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    let snapshot: Awaited<ReturnType<Tracer["getProjectSnapshot"]>>;
    try {
      await page.goto(server.origin + "/?workspace=map");
      await page.getByRole("button", { name: "Configure model", exact: true }).click();
      const task = page.locator(".native-task:visible");
      await task.getByRole("button", { name: "Text", exact: true }).click();
      await task.getByLabel("Advanced JSON", { exact: true }).check();
      await task.getByLabel("Project schema JSON", { exact: true }).fill(json);
      await task.getByRole("button", { name: "Save model", exact: true }).click();
      await expect.poll(async () => (await tracer.getSchema())?.version).toBe(1);
      await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "New item", exact: true }).click();
      const items = [
        { type: "product", key: "PROD-001", title: "Desk light" },
        {
          type: "requirement",
          key: "REQ-001",
          title: "Adjustable brightness",
          statement: "The user can adjust brightness.",
        },
        { type: "component", key: "COMP-001", title: "LED controller" },
      ];
      for (const item of items) {
        await task.getByLabel("New record type", { exact: true }).selectOption(item.type);
        await task.getByLabel("New record key", { exact: true }).fill(item.key);
        await task.getByLabel("New record title", { exact: true }).fill(item.title);
        if (item.statement)
          await task.getByLabel("New record statement", { exact: true }).fill(item.statement);
        await task.getByRole("button", { name: "Create record", exact: true }).click();
        await expect(task.getByRole("status")).toContainText("Record saved.");
        await expect(task.getByLabel("New record key", { exact: true })).toHaveValue("");
      }
      for (const link of [
        { source: "PROD-001", type: "has_requirement", target: "REQ-001" },
        { source: "REQ-001", type: "allocated_to", target: "COMP-001" },
      ]) {
        await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
        await page.getByRole("searchbox", { name: "Find an item" }).fill(link.source);
        await page
          .getByRole("button")
          .filter({ hasText: new RegExp(`^${link.source} ·`) })
          .click();
        await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
        await task.locator(".work-connect-options > summary").click();
        await task.getByLabel("Connection meaning", { exact: true }).selectOption(link.type);
        await task.getByLabel("Find target", { exact: true }).fill(link.target);
        await task
          .getByRole("button", { name: `Choose target ${link.target}`, exact: true })
          .click();
        await task.getByRole("button", { name: "Connect selected target", exact: true }).click();
        await expect
          .poll(async () => (await tracer.queryRelationships({ type: link.type })).items.length)
          .toBe(1);
      }
      await task.getByRole("button", { name: "Edit item", exact: true }).click();
      await task.getByLabel("Item title", { exact: true }).fill("User-adjustable brightness");
      await task.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(async () => (await tracer.queryEntities({ key: "REQ-001" })).items[0]?.fields.title)
        .toBe("User-adjustable brightness");
      await page.reload();
      await page.getByRole("searchbox", { name: "Find an item" }).fill("REQ-001");
      await expect(page.getByRole("button").filter({ hasText: /^REQ-001 ·/ })).toContainText(
        "User-adjustable brightness",
      );
      const apiGuide = readFileSync("docs/reference/developer-reference.md", "utf8");
      const snippet = apiGuide.match(/```js\n([\s\S]*?)\n```/)?.[1];
      assert.ok(snippet, "HTTP quickstart must include runnable browser JavaScript");
      // Execute the checked-in tutorial exactly as a browser-console caller would.
      await page.evaluate(async (source) => {
        await new Function(`return (async () => {${source}\n})()`)();
      }, snippet);
      expect((await tracer.queryEntities({ type: "component" })).items).toHaveLength(2);
      snapshot = await tracer.getProjectSnapshot();
      expect(snapshot.relationships).toHaveLength(2);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
    }
    const reopened = new SQLiteRepository(database);
    try {
      expect(await new Tracer(reopened).getProjectSnapshot()).toEqual(snapshot);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
