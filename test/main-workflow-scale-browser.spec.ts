import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { seedScaleProject } from "../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const size of ["working", "large"] as const)
  test(`main workspace searches and resumes the synthetic ${size} project with keyboard controls at 680px`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const directory = mkdtempSync(join(tmpdir(), "tracer-main-scale-"));
    const seed = await seedScaleProject(join(directory, "project"), size);
    const repository = new SQLiteRepository(seed.database);
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width: 680, height: 900 });
      const started = performance.now();
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible({ timeout: 60000 });
      const openMs = performance.now() - started;
      await page.keyboard.press("/");
      const searched = performance.now();
      const search = page.getByRole("combobox", { name: "Search artifacts and commands" });
      await search.fill("Sensor cutoff changed");
      const match = page.locator("[data-result]").first();
      await expect(match).toContainText("Sensor cutoff changed to 80 degrees");
      const key = await match.getAttribute("data-result");
      await expect(search).toBeFocused();
      await expect(search).toHaveAttribute(
        "aria-activedescendant",
        (await match.getAttribute("id"))!,
      );
      await expect(match).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Enter");
      await expect(page.locator(`.node[data-key="${key}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const searchMs = performance.now() - searched;
      expect(await page.locator(".node").count()).toBeLessThanOrEqual(50);
      const matrix = page.getByRole("button", { name: "Matrix", exact: true });
      await matrix.focus();
      await expect(matrix).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("grid", { name: "Editable traceability matrix", exact: true }),
      ).toBeVisible();
      const cell = page.getByRole("gridcell").first();
      await cell.focus();
      await page.keyboard.press("F2");
      await expect(
        page.getByRole("dialog", { name: "Matrix cell editor", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.reload();
      await expect(
        page.getByRole("grid", { name: "Editable traceability matrix", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await expect(page.locator(".context")).toContainText(key!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      const metrics = {
        synthetic: true,
        size,
        artifacts: size === "large" ? 10000 : 1000,
        relationships: size === "large" ? 100000 : 5000,
        openMs: Math.round(openMs),
        searchMs: Math.round(searchMs),
      };
      console.log(JSON.stringify(metrics));
      await info.attach("synthetic-task-timings", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
