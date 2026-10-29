import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680]) {
  test(`fresh Engineering model: truthful saves, supported fields and Matrix recovery at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-engineering-trust-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const actor = { actor: "engineering trust regression" };
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await openProjectDestination(page, "Model");
      const editor = page.getByLabel("Configure project model", { exact: true });
      await editor.getByLabel("Starter structure").selectOption("engineering");
      // Explicit custom model keeps the unsupported-field regression even as the starter evolves.
      await editor.getByRole("button", { name: "Text", exact: true }).click();
      await editor.getByLabel("Advanced JSON", { exact: true }).check();
      const raw = editor.getByLabel("Project schema JSON", { exact: true });
      const custom = JSON.parse(await raw.inputValue());
      delete custom.entityTypes.requirement.fields.acceptance;
      await raw.fill(JSON.stringify(custom));
      await editor.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(editor).toContainText("Based on schema v1 · Current project v1");
      await expect(editor.getByText("No changes", { exact: true })).toBeVisible();
      await expect(editor.getByRole("alert")).toHaveCount(0);
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.locator('[data-view="graph"]').click();

      const req = await tracer.createEntity(
        {
          type: "requirement",
          key: "CO2-REQ",
          fields: { title: "Portable CO₂ range", statement: "" },
        },
        1,
        actor,
      );
      await openProjectDestination(page, "Project settings");
      await page.getByRole("button", { name: "Refresh project", exact: true }).click();
      await expect(page.locator(".context")).toContainText("CO2-REQ");
      await page.keyboard.press("/");
      await page.locator("#search").fill("CO2-REQ");
      await page.locator('[data-result="CO2-REQ"]').click();
      await page.locator('[data-action="details"]').click();
      if (width === 680)
        await page.getByRole("button", { name: "Expand artifact details", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Edit acceptance criterion", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText("Add acceptance criterion", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
      await expect(page.locator("#draft-acceptance")).toHaveCount(0);
      const before = (await tracer.getProjectSnapshot()).projectRevision;
      await page.locator('[data-action="apply-edit"]').click();
      await expect(page.locator(".workspace-notice")).toContainText("No changes to save");
      expect((await tracer.getProjectSnapshot()).projectRevision).toBe(before);

      await openProjectDestination(page, "Model");
      await editor.getByRole("button", { name: "Text", exact: true }).click();
      await editor.getByLabel("Advanced JSON", { exact: true }).check();
      const input = editor.getByLabel("Project schema JSON", { exact: true });
      const schema = JSON.parse(await input.inputValue());
      schema.entityTypes.requirement.fields.acceptance = { type: "string" };
      await input.fill(JSON.stringify(schema));
      await editor.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(editor).toContainText("Based on schema v2 · Current project v2");
      await expect(editor.getByText("No changes", { exact: true })).toBeVisible();
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
      await page.locator("#draft-title").fill("CO₂ operating range");
      await page.locator("#draft-statement").fill("Measure 400–10000 ppm.");
      await page.locator("#draft-acceptance").fill("Within ±50 ppm in the simulated fixture.");
      await page.locator('[data-action="apply-edit"]').click();
      await expect
        .poll(async () => (await tracer.getEntity(req.id)).fields.acceptance)
        .toBe("Within ±50 ppm in the simulated fixture.");
      expect((await tracer.getEntity(req.id)).fields).toEqual({
        title: "CO₂ operating range",
        statement: "Measure 400–10000 ppm.",
        acceptance: "Within ±50 ppm in the simulated fixture.",
      });
      await page.getByRole("button", { name: "Edit acceptance criterion", exact: true }).click();
      await page
        .getByLabel("Acceptance criterion", { exact: true })
        .fill("Within ±40 ppm in the simulated fixture.");
      await page.locator('[data-apply-field="acceptance"]').click();
      await expect
        .poll(async () => (await tracer.getEntity(req.id)).fields.acceptance)
        .toBe("Within ±40 ppm in the simulated fixture.");
      await page.locator('[data-view="matrix"]').click();
      await page.locator(".trace-config-toggle > summary").click();
      await expect(page.locator("#trace-root-type")).toHaveValue("requirement");
      await page.locator("#trace-column-count").selectOption("2");
      await expect(page.locator('[data-trace-relation="0"]')).toHaveValue("mapped_to");
      await expect(page.locator('[data-trace-target="0"]')).toHaveValue("design");
      await expect(page.locator('[data-trace-relation="1"]')).toHaveValue("tested_by");
      await expect(page.locator('[data-trace-target="1"]')).toHaveValue("test");
      await expect(page.locator(".trace-cell").first()).toContainText("CO2-REQ");
      await page.locator("#trace-root-type").selectOption("intent");
      await expect(page.locator(".matrix-empty")).toBeVisible();
      await page.getByRole("button", { name: "Use selected artifact as row", exact: true }).click();
      await expect(page.locator(".trace-cell").first()).toContainText("CO2-REQ");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: resolve("output", `engineering-trust-${width}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
