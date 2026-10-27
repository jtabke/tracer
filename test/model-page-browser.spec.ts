import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680, 390]) {
  test(`Model is a full page with retained draft and browser navigation at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-model-page-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const fields = { title: { type: "string" as const, required: true } };
    await tracer.setSchema(
      {
        entityTypes: {
          objective: { fields },
          behavior: { fields },
          module: { fields },
          source: { fields },
          goal: { fields },
        },
        relationshipTypes: {
          sourced_from: { source: ["objective"], target: ["source"], fields: {} },
          contributes_to: { source: ["objective"], target: ["goal"], fields: {} },
          addresses: {
            source: ["behavior"],
            target: ["objective"],
            fields: {},
            workflow: [
              {
                source: "behavior",
                target: "objective",
                direction: "reverse",
                label: "Required behavior",
              },
            ],
          },
          allocated_to: {
            source: ["behavior"],
            target: ["module"],
            fields: {},
            workflow: [
              {
                source: "behavior",
                target: "module",
                direction: "forward",
                label: "Implementation",
              },
            ],
          },
        },
      },
      0,
      { actor: "model-page-check" },
    );
    const revision = (await tracer.getProjectSnapshot()).projectRevision;
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      await page.getByRole("button", { name: "Model", exact: true }).click();
      const model = page.locator(".model-page");
      await expect(model).toBeVisible();
      await expect(page).toHaveURL(/#model$/);
      await expect(page.locator("dialog:modal")).toHaveCount(0);
      const bounds = await model.boundingBox();
      expect(bounds?.x).toBe(0);
      expect(bounds?.y).toBe(0);
      expect(bounds?.width).toBe(width);
      expect(bounds?.height).toBe(900);
      expect(await page.locator("#app").evaluate((e) => (e as HTMLElement).inert)).toBe(true);
      await expect(model.locator(".model-flow-scroll")).toBeVisible();
      await expect(model.locator(".model-flow-types > li")).toHaveCount(3);
      await expect(
        model.getByRole("button", { name: "Select type · source", exact: true }),
      ).toHaveCount(0);
      await model.getByRole("button", { name: "Show supporting types", exact: true }).click();
      await expect(model.locator(".model-flow-types > li")).toHaveCount(5);
      await expect(
        model.getByRole("button", { name: "Select type · source", exact: true }),
      ).toBeVisible();
      await model.getByRole("button", { name: "Development flow", exact: true }).click();
      await expect(model.locator(".model-flow-types > li")).toHaveCount(3);
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.press("/");
      await expect(page.locator("#workspace-dialog")).toBeHidden();
      await model.getByRole("button", { name: "Text", exact: true }).click();
      await model.getByLabel("Advanced JSON", { exact: true }).check();
      const input = model.getByLabel("Project schema JSON", { exact: true });
      await input.fill("{ invalid draft");
      await model.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await expect(model).toBeHidden();
      expect(await page.locator("#app").evaluate((e) => (e as HTMLElement).inert)).toBe(false);
      await page.getByRole("button", { name: "Model", exact: true }).click();
      await expect(input).toHaveValue("{ invalid draft");
      await page.goBack();
      await expect(model).toBeHidden();
      await page.goForward();
      await expect(model).toBeVisible();
      await expect(input).toHaveValue("{ invalid draft");
      page.once("dialog", (dialog) => dialog.accept());
      await model.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(model).toBeHidden();
      await page.goto(`${server.origin}/#model`);
      await expect(model).toBeVisible();
      await expect(model.getByRole("button", { name: "Visual", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect((await tracer.getProjectSnapshot()).projectRevision).toBe(revision);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
