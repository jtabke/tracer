import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/index.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680, 390])
  test(`project task navigation retains drafts and Matrix context at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-task-navigation-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const actor = { actor: "task-navigation-regression" };
    await tracer.setSchema(
      {
        entityTypes: { item: { fields: { title: { type: "string", required: true } } } },
        relationshipTypes: {},
      },
      0,
      actor,
    );
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const screenshots = resolve("output/navigation-readiness");
    mkdirSync(screenshots, { recursive: true });
    try {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(server.origin);
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      const emptyMenu = page.getByRole("dialog", { name: "Project tools", exact: true });
      await expect(
        emptyMenu.getByRole("button", { name: "Edit item and connections", exact: true }),
      ).toBeDisabled();
      await expect(
        emptyMenu.getByRole("button", { name: "References for selected record", exact: true }),
      ).toBeDisabled();
      await emptyMenu.getByRole("button", { name: "Documentation", exact: true }).click();
      const emptyNavigation = page.getByRole("combobox", { name: "Project task", exact: true });
      await expect(emptyNavigation.locator('option[value="item"]')).toHaveJSProperty(
        "disabled",
        true,
      );
      await expect(emptyNavigation.locator('option[value="references"]')).toHaveJSProperty(
        "disabled",
        true,
      );
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await tracer.createEntity(
        { type: "item", key: "ROOT", fields: { title: "Retained scope" } },
        1,
        actor,
      );
      const before = await tracer.exportProject();
      await page.reload();
      await page.getByRole("button", { name: "Matrix", exact: true }).click();
      await expect(page.locator('[data-view="matrix"]')).toHaveAttribute("aria-pressed", "true");
      const context = await page.locator(".context p").textContent();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      const menu = page.getByRole("dialog", { name: "Project tools", exact: true });
      await expect(
        menu.getByRole("heading", { name: "Engineering work", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: join(screenshots, `after-menu-${width}.png`) });
      if (width === 390) {
        await page.setViewportSize({ width, height: 480 });
        await menu
          .getByRole("button", { name: "Close project tools", exact: true })
          .scrollIntoViewIfNeeded();
        const bounds = await menu.boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
      }
      await menu.getByRole("button", { name: "New item", exact: true }).click();
      await page.setViewportSize({ width, height: 800 });
      const task = page.locator(".native-task:visible");
      await task.getByLabel("New item key", { exact: true }).fill("UNSAVED");
      await task.getByLabel("New item title", { exact: true }).fill("Retain across task switches");
      const navigation = () => page.getByRole("combobox", { name: "Project task", exact: true });
      await navigation().selectOption("docs");
      await expect(page.getByRole("region", { name: "Documentation reader" })).toBeVisible();
      await page.screenshot({ path: join(screenshots, `after-task-${width}.png`) });
      await navigation().selectOption("schema");
      await expect(page.getByRole("region", { name: "Project model page" })).toBeVisible();
      await page.screenshot({ path: join(screenshots, `after-model-${width}.png`) });
      await navigation().selectOption("create");
      await expect(task.getByLabel("New item title", { exact: true })).toHaveValue(
        "Retain across task switches",
      );
      await expect(task.getByLabel("New item key", { exact: true })).toHaveValue("UNSAVED");
      await navigation().focus();
      await expect(navigation()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Return to workspace", exact: true }),
      ).toBeFocused();
      await navigation().selectOption("docs");
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-view="matrix"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".context p")).toHaveText(context!);
      await expect(page.getByRole("button", { name: "Project tools", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      await expect(page.getByRole("region", { name: "Documentation reader" })).toBeVisible();
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByRole("button", { name: "History", exact: true }).click();
      await page.getByRole("slider", { name: "Project revision", exact: true }).fill("1");
      await expect(page.getByRole("slider", { name: "Project revision", exact: true })).toHaveValue(
        "1",
      );
      const historicalContext = await page.locator(".context p").textContent();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      await navigation().selectOption("schema");
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await expect(page.locator('[data-view="history"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("slider", { name: "Project revision", exact: true })).toHaveValue(
        "1",
      );
      await expect(page.locator(".context p")).toHaveText(historicalContext!);
      expect(errors).toEqual([]);
      expect(await tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
