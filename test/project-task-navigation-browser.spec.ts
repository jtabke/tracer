import { test, expect, closeTestPage } from "./browser-test.ts";
import { openProjectDestination } from "./project-navigation.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/index.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680, 390])
  test(`sidebar navigation retains drafts and Matrix context at ${width}px`, async ({ page }) => {
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
    const screenshots = resolve("output/sidebar-navigation");
    mkdirSync(screenshots, { recursive: true });
    try {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(server.origin);
      await expect(page.getByRole("button", { name: "Project tools", exact: true })).toHaveCount(0);
      await openProjectDestination(page, "Project settings");
      const settings = page.getByRole("region", { name: "Project settings", exact: true });
      for (const name of [
        "Import CSV",
        "Export project",
        "Evaluation records",
        "Refresh project",
        "Development map",
      ])
        await expect(settings.getByRole("button", { name, exact: true })).toBeVisible();
      await expect(settings.locator("details, select")).toHaveCount(0);
      await page.screenshot({ path: join(screenshots, `settings-${width}.png`) });
      await openProjectDestination(page, "Documentation");
      const navigation = () => page.getByRole("combobox", { name: "Project task", exact: true });
      await expect(navigation().locator('option[value="item"]')).toHaveJSProperty("disabled", true);
      await expect(navigation().locator('option[value="references"]')).toHaveJSProperty(
        "disabled",
        true,
      );
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await expect(settings).toBeVisible();
      await page.getByRole("button", { name: "Back to workspace", exact: true }).click();
      await page.locator('[data-action="search"]').click();
      await page.locator("#search").fill("Edit record");
      await expect(page.locator("#search-results").getByRole("option")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await tracer.createEntity(
        { type: "item", key: "ROOT", fields: { title: "Retained scope" } },
        1,
        actor,
      );
      const before = await tracer.exportProject();
      await page.reload();
      await page.getByRole("button", { name: "Matrix", exact: true }).click();
      const context = await page.locator(".context p").textContent();
      await openProjectDestination(page, "Project settings");
      await openProjectDestination(page, "Workspace");
      await expect(page.locator('[data-view="matrix"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".context p")).toHaveText(context!);
      await page.locator('[data-action="create-record"]').first().click();
      const task = page.locator(".native-task:visible");
      await task.getByLabel("New record key", { exact: true }).fill("UNSAVED");
      await task
        .getByLabel("New record title", { exact: true })
        .fill("Retain across task switches");
      await navigation().selectOption("docs");
      await expect(page.getByRole("region", { name: "Documentation reader" })).toBeVisible();
      await navigation().selectOption("schema");
      await expect(page.getByRole("region", { name: "Project model page" })).toBeVisible();
      await navigation().selectOption("create");
      await expect(task.getByLabel("New record title", { exact: true })).toHaveValue(
        "Retain across task switches",
      );
      await expect(task.getByLabel("New record key", { exact: true })).toHaveValue("UNSAVED");
      await navigation().focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Return to workspace", exact: true }),
      ).toBeFocused();
      await navigation().selectOption("docs");
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-action="create-record"]').first()).toBeFocused();
      await expect(page.locator('[data-view="matrix"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".context p")).toHaveText(context!);
      await page.locator('[data-action="search"]').click();
      await page.locator("#search").fill("ROOT");
      await page.locator('[data-result="ROOT"]').click();
      await page.locator('[data-action="search"]').click();
      for (const name of [
        "Configurations",
        "Verification",
        "Change assessments",
        "Create record",
        "Edit record and connections · ROOT",
        "References for selected record · ROOT",
        "Next work",
        "Model",
        "Documentation",
        "Import CSV",
        "Export project",
        "Evaluation records",
        "Refresh project",
        "Development map",
      ])
        await expect(page.getByRole("option", { name, exact: true })).toBeAttached();
      await page.locator("#search").fill("Edit record and connections");
      await page.keyboard.press("Enter");
      await expect(task).toContainText("ROOT");
      const beforeDiscard = await tracer.exportProject();
      await task.locator(".work-connect-options > summary").click();
      await task.getByLabel("Find target", { exact: true }).fill("Discard this connection search");
      await task.getByRole("button", { name: "Discard connection draft", exact: true }).click();
      await expect(task.getByLabel("Find target", { exact: true })).toHaveValue("");
      expect(await tracer.exportProject()).toEqual(beforeDiscard);
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      const recordActions = page.getByRole("region", { name: "Actions for ROOT", exact: true });
      await expect(recordActions.getByRole("heading")).toHaveText("Record · ROOT");
      await recordActions
        .getByRole("button", { name: "References and supporting material", exact: true })
        .click();
      await expect(task).toContainText("ROOT");
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await page.locator('[data-action="close-inspector"]').click();
      await page.getByRole("button", { name: "History", exact: true }).click();
      await page.getByRole("slider", { name: "Project revision", exact: true }).fill("1");
      const historicalContext = await page.locator(".context p").textContent();
      await openProjectDestination(page, "Documentation");
      await navigation().selectOption("schema");
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await expect(page.locator('[data-view="history"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("slider", { name: "Project revision", exact: true })).toHaveValue(
        "1",
      );
      await expect(page.locator(".context p")).toHaveText(historicalContext!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      expect(await tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
