import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680])
  test(`Engineering starter authors a first trace and persists setup across reload/server restart/clean browser at ${width}px`, async ({
    page,
    browser,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-engineering-start-"));
    const path = join(directory, "project.sqlite");
    let repository = new SQLiteRepository(path);
    let tracer = new Tracer(repository);
    let server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      const article = page.getByRole("article", { name: "Getting started", exact: true });
      await expect(article.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(
        article.getByRole("link", { name: "Explore an example", exact: true }),
      ).toBeInViewport();
      await expect(
        article.getByRole("link", { name: "Start your own project", exact: true }),
      ).toBeInViewport();
      if (width === 680)
        await expect(
          page.getByRole("navigation", { name: "Documentation topics", exact: true }),
        ).not.toBeVisible();
      await page.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Configure model", exact: true }).click();
      const editor = page.getByLabel("Configure project model", { exact: true });
      await editor.getByLabel("Starter structure").selectOption("engineering");
      page.once("dialog", (dialog) => dialog.accept());
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Configure model", exact: true }).click();
      await expect(editor.getByLabel("Starter structure")).toHaveValue("empty");
      expect(await tracer.getSchema()).toBeUndefined();
      await editor.getByLabel("Starter structure").selectOption("engineering");
      await expect(editor).toContainText("verification method and expected result");
      await expect(
        editor.getByRole("heading", { name: "New model definition", exact: true }),
      ).toHaveCount(0);
      await expect(editor.locator(".model-flow-route")).toHaveCount(4);
      await expect(
        editor.getByRole("checkbox", { name: "Save 3 starter Matrix views with this model" }),
      ).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const dialogBounds = page.locator(".native-task:visible");
      await expect
        .poll(async () =>
          dialogBounds.evaluate((element) => element.scrollWidth - element.clientWidth),
        )
        .toBeLessThanOrEqual(1);
      await page.screenshot({ path: resolve("output", `engineering-starter-${width}.png`) });
      await editor.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(editor.getByRole("status")).toContainText("with 3 Matrix views");
      await expect(editor.getByText("No changes", { exact: true })).toBeVisible();
      expect((await tracer.savedViews.list()).length).toBe(3);
      await page.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await expect(page.locator('[data-view="matrix"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".traceability-matrix thead th")).toHaveCount(3);
      await expect(page.locator(".traceability-matrix thead")).toContainText("tested by");
      await page.reload();
      await expect(page.locator("[data-grid-create-root]")).toContainText("New requirement");
      await expect(
        page.locator(".workspace-notice").filter({ hasText: "unsaved drafts" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "New item", exact: true }).click();
      const task = page.locator(".native-task:visible");
      await task.getByLabel("New item type", { exact: true }).selectOption("test");
      await task.getByLabel("New item key", { exact: true }).fill("CO2-PLAN");
      await task
        .getByLabel("New item title", { exact: true })
        .fill("Simulated CO₂ range verification plan");
      await task
        .getByLabel("New item method", { exact: true })
        .fill("Simulated reference inputs; no hardware execution.");
      await task
        .getByLabel("New item expected_result", { exact: true })
        .fill("Within ±50 ppm across the selected range.");
      await task.getByLabel("New item build", { exact: true }).fill("Prototype A");
      await task.getByRole("button", { name: "Create item", exact: true }).click();
      await expect(task.getByLabel("New item key", { exact: true })).toHaveValue("");
      const plan = (await tracer.queryEntities({ key: "CO2-PLAN" })).items[0];
      expect(plan.fields).toMatchObject({
        method: "Simulated reference inputs; no hardware execution.",
        expected_result: "Within ±50 ppm across the selected range.",
        build: "Prototype A",
      });
      await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.reload();
      await expect(
        page.locator(".workspace-notice").filter({ hasText: "unsaved drafts" }),
      ).toHaveCount(0);
      await page.locator("[data-grid-create-root]").click();
      await page.locator('#create-form [name="title"]').fill("CO₂ measurement range");
      await page.locator('#create-form [name="title"]').press("Enter");
      await expect(page.locator("#create-form")).toHaveCount(0);
      const req = (await tracer.queryEntities({ type: "requirement" })).items[0];
      await expect(page.locator(".traceability-matrix tbody")).toContainText(req.key!);
      await page.getByRole("button", { name: `Link design from ${req.key}`, exact: true }).click();
      await page.locator("[data-cell-create]").click();
      await page.locator('#matrix-cell-form [name="title"]').fill("Sensor and firmware design");
      await page.locator('#matrix-cell-form [name="title"]').press("Enter");
      await expect(page.locator("#matrix-cell-form")).toHaveCount(0);
      const design = (await tracer.queryEntities({ type: "design" })).items[0];
      await page.getByRole("button", { name: `Link test from ${design.key}`, exact: true }).click();
      await page.locator('#matrix-cell-form [name="query"]').fill("CO2-PLAN");
      await page.locator('[data-picker-key="CO2-PLAN"]').click();
      await expect(page.locator("#matrix-cell-form")).toHaveCount(0);
      expect((await tracer.queryRelationships({})).items).toHaveLength(2);
      // The plan and design links are structural work, never an executed result.
      expect((await tracer.evidence.list("receipt")).items).toHaveLength(0);
      expect(
        (await tracer.coverage.evaluate({ expectationId: "requirement_design" })).rows.items[0]
          .state,
      ).toBe("covered");
      expect(
        (await tracer.coverage.evaluate({ expectationId: "requirement_verification" })).rows
          .items[0].state,
      ).toBe("missing");
      await page.getByRole("button", { name: "Search", exact: false }).first().click();
      await page.locator("#search").fill(req.key!);
      await page.locator(`[data-result="${req.key}"]`).click();
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.getByRole("button", { name: "Edit acceptance criterion", exact: true }).click();
      await page
        .getByLabel("Acceptance criterion", { exact: true })
        .fill("Within ±50 ppm in the simulated fixture.");
      await page.locator('[data-apply-field="acceptance"]').click();
      await expect
        .poll(async () => (await tracer.getEntity(req.id)).fields.acceptance)
        .toBe("Within ±50 ppm in the simulated fixture.");
      await expect(
        page.getByRole("button", { name: "Edit acceptance criterion", exact: true }),
      ).toContainText("Within ±50 ppm in the simulated fixture.");
      await page.screenshot({ path: resolve("output", `engineering-setup-${width}.png`) });
      const snapshot = await tracer.getProjectSnapshot();
      const views = await tracer.savedViews.list();
      await server.close();
      repository.close();
      repository = new SQLiteRepository(path);
      tracer = new Tracer(repository);
      server = await startLocalServer(tracer, resolve("dist"), 0);
      const clean = await browser.newContext({ viewport: { width, height: 1000 } });
      const reopened = await clean.newPage();
      try {
        await reopened.goto(server.origin);
        await reopened.locator('[data-view="matrix"]').click();
        const trace = views.find((view) => view.name === "Requirements → design → verification")!;
        await reopened.getByLabel("Saved configurations", { exact: true }).selectOption(trace.id);
        await expect(reopened.locator(".traceability-matrix tbody")).toContainText(req.key!);
        await expect(reopened.locator(".traceability-matrix tbody")).toContainText(
          "Simulated CO₂ range verification plan",
        );
        expect(await tracer.getProjectSnapshot()).toEqual(snapshot);
        expect(await tracer.savedViews.list()).toEqual(views);
        expect(await reopened.evaluate(() => localStorage.length)).toBeGreaterThan(0);
        expect(await reopened.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      } finally {
        await closeTestPage(reopened);
        await clean.close();
      }
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
