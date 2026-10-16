import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 390])
  test(`library first-screen hierarchy and retained saved-scope settings at ${width}px`, async ({
    page,
  }) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-library-hierarchy-"));
    const fixture = await seedRealisticProject(join(parent, "project"), "integrated");
    const repository = new SQLiteRepository(fixture.database),
      tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(server.origin + "/?view=workspace");
      const browser = page.getByRole("region", { name: "Project browser", exact: true });
      const rows = browser.locator(".workspace-library tbody tr");
      await expect(rows).toHaveCount(30);
      const saved = page.locator(".workspace-view-library .saved-view-panel");
      await expect(saved).toBeHidden();
      await expect(browser).toContainText("30 of 72 project items");
      await expect(rows.first()).toBeInViewport();
      if (width === 390) {
        const type = (await browser.getByLabel("Workspace type", { exact: true }).boundingBox())!;
        const clear = (await browser
          .getByRole("button", { name: "Clear filters", exact: true })
          .boundingBox())!;
        expect(Math.abs(type.y + type.height - clear.y - clear.height)).toBeLessThanOrEqual(2);
        expect((await rows.nth(1).boundingBox())!.y).toBeLessThan(844);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      }
      await page.screenshot({ path: `/tmp/tracer-library-hierarchy-${width}.png` });
      await browser.getByLabel("Workspace type", { exact: true }).selectOption("requirement");
      const filtered = await tracer.getWorkingSet({ type: "requirement", limit: 30 });
      await expect(rows).toHaveCount(filtered.total);
      await expect(browser).toContainText(
        `${filtered.total} of ${filtered.total} matches · 72 project items`,
      );
      await browser.getByRole("button", { name: "Clear filters", exact: true }).click();
      await expect(rows).toHaveCount(30);
      await rows.first().getByRole("button").click();
      await saved.getByRole("button", { name: "Save view…", exact: true }).click();
      await saved
        .getByLabel("Saved view name", { exact: true })
        .fill("Retained engineering question");
      const history = await tracer.history();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Getting started with Tracer", exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Work", exact: true }).click();
      await expect(saved.getByLabel("Saved view name", { exact: true })).toHaveValue(
        "Retained engineering question",
      );
      await page.route(
        (url) => url.pathname === "/api/saved-views",
        (route) => route.abort(),
      );
      const failedRead = page.waitForEvent(
        "requestfailed",
        (request) =>
          request.method() === "GET" && new URL(request.url()).pathname === "/api/saved-views",
      );
      await saved.getByRole("button", { name: "Refresh saved views", exact: true }).click();
      await failedRead;
      await expect(saved.getByRole("alert")).toBeVisible();
      await expect(saved).toBeVisible();
      await expect(saved.getByLabel("Saved view name", { exact: true })).toHaveValue(
        "Retained engineering question",
      );
      await expect(
        saved.getByRole("button", { name: "Save as new view", exact: true }),
      ).toBeDisabled();
      expect(await tracer.history()).toEqual(history);
      expect(await tracer.savedViews.list()).toEqual([]);
    } finally {
      await closeTestPage(page, true);
      await server.close();
      repository.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });
