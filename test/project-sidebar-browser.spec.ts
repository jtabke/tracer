import { test, expect, closeTestPage } from "./browser-test.ts";
import { openProjectDestination } from "./project-navigation.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/index.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680, 390])
  test(`shared Atlas sidebar is docked or modal without changing project context at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-sidebar-"));
    const fixture = await seedRealisticProject(join(directory, "project"), "medical");
    const repository = new SQLiteRepository(fixture.database);
    const tracer = new Tracer(repository);
    const before = await tracer.exportProject();
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const output = resolve("output/sidebar-navigation");
    mkdirSync(output, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible();
      const sidebar = page.locator(".sidebar-shell > .project-sidebar");
      await page.screenshot({ path: join(output, `workspace-${width}.png`) });
      const context = await page.locator(".context p").textContent();
      if (width === 1440) {
        await expect(sidebar).toBeVisible();
        await expect(sidebar.getByRole("button")).toHaveText([
          "Workspace",
          "Next work",
          "Configurations",
          "Verification",
          "Change assessments",
          "Model",
          "Documentation",
          "Project settings",
        ]);
        await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
        await sidebar.screenshot({ path: join(output, "sidebar-desktop.png") });
      } else {
        await expect(sidebar).toBeHidden();
        const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
        await toggle.click();
        const drawer = page.getByRole("dialog", { name: "Project navigation", exact: true });
        await expect(drawer).toBeVisible();
        await expect(drawer.getByRole("button")).toHaveText([
          "×",
          "Workspace",
          "Next work",
          "Configurations",
          "Verification",
          "Change assessments",
          "Model",
          "Documentation",
          "Project settings",
        ]);
        await page.screenshot({ path: join(output, `sidebar-mobile-${width}.png`) });
        await drawer.getByRole("button", { name: "Project settings", exact: true }).focus();
        await page.keyboard.press("Tab");
        await expect(
          drawer.getByRole("button", { name: "Close dialog", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(
          drawer.getByRole("button", { name: "Project settings", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(toggle).toBeFocused();
        await toggle.click();
        await page.mouse.click(width - 5, 400);
        await expect(drawer).not.toBeVisible();
        await expect(toggle).toBeFocused();
        await toggle.click();
        await page.setViewportSize({ width, height: 480 });
        await drawer
          .getByRole("button", { name: "Project settings", exact: true })
          .scrollIntoViewIfNeeded();
        const bounds = await drawer.boundingBox();
        expect(bounds!.height).toBeLessThanOrEqual(480);
        await page.keyboard.press("Escape");
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      }
      await openProjectDestination(page, "Project settings");
      await expect(
        page.getByRole("heading", { name: "Project settings", exact: true }),
      ).toBeVisible();
      await openProjectDestination(page, "Workspace");
      await expect(page.locator(".context p")).toHaveText(context!);
      if (width === 390) {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.keyboard.press("Escape");
        await expect(page.locator('[data-action="search"]')).toBeFocused();
      }
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(await tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
