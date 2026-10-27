import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 390]) {
  test(`REQ-001: author all field kinds, reopen, and retain a rejected definition at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-req001-browser-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema({ entityTypes: {}, relationshipTypes: {} }, 0, {
      actor: "req001-browser",
    });
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin + "/#model");
      const model = page.locator(".model-page");
      await expect(model).toBeVisible();
      await model.getByRole("button", { name: "Text", exact: true }).click();
      await model.getByLabel("New definition name", { exact: true }).fill("test_article");
      await model.getByRole("button", { name: "Add definition", exact: true }).click();
      for (const [name, kind] of [
        ["title", "string"],
        ["threshold", "number"],
        ["enabled", "boolean"],
        ["metadata", "json"],
      ]) {
        await model.getByLabel("New field name", { exact: true }).fill(name);
        await model.getByRole("button", { name: "Add field", exact: true }).click();
        await model.getByLabel(`Field type · ${name}`, { exact: true }).selectOption(kind);
        await model.getByLabel(`Required · ${name}`, { exact: true }).check();
      }
      await model.getByLabel("New field name", { exact: true }).fill("note");
      await model.getByRole("button", { name: "Add field", exact: true }).click();
      await expect(model.getByLabel("Required · note", { exact: true })).not.toBeChecked();
      await model.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(model.getByRole("status")).toContainText("Model saved as v2");
      const saved = await tracer.exportProject();
      expect(saved.current.schema?.entityTypes.test_article.fields).toEqual({
        title: { type: "string", required: true },
        threshold: { type: "number", required: true },
        enabled: { type: "boolean", required: true },
        metadata: { type: "json", required: true },
        note: { type: "string" },
      });
      await page.reload();
      await model.getByRole("button", { name: "Text", exact: true }).click();
      await model.getByLabel("Advanced JSON", { exact: true }).check();
      const input = model.getByLabel("Project schema JSON", { exact: true });
      const original = await input.inputValue();
      const invalid = { ...JSON.parse(original), entityType: { attempted: "retain this draft" } };
      await input.fill(JSON.stringify(invalid, null, 2));
      await expect(model.getByRole("alert").first()).toContainText("entityType");
      expect(await tracer.exportProject()).toEqual(saved);
      await expect(input).toHaveValue(JSON.stringify(invalid, null, 2));
      await input.fill(original);
      await expect(model.getByRole("button", { name: "Save model", exact: true })).toBeEnabled();
      expect(await tracer.exportProject()).toEqual(saved);
      expect(errors).toEqual([]);
      mkdirSync(resolve("output/req001-audit"), { recursive: true });
      await page.screenshot({ path: resolve(`output/req001-audit/model-${width}.png`) });
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
