import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 390]) {
  test(`starter-first setup previews choices without writes and retains custom work at ${width}px`, async ({
    page,
  }) => {
    const repository = new SQLiteRepository(":memory:");
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${server.origin}/#model`);
      const editor = page.getByLabel("Configure project model", { exact: true });
      const software = editor.getByRole("button", { name: /^Software/ });
      const custom = editor.getByRole("button", { name: /^Custom / });
      const save = editor.getByRole("button", { name: "Use this model", exact: true });
      await expect(save).toBeDisabled();
      await expect(editor.getByRole("heading", { name: "Set up your project" })).toHaveCSS(
        "font-weight",
        "600",
      );
      await expect(save).toHaveCSS("font-weight", "500");
      await expect(editor.getByRole("button", { name: "Cancel", exact: true })).toHaveCSS(
        "font-weight",
        "400",
      );
      await expect(
        page.getByRole("button", { name: "Return to workspace", exact: true }),
      ).toHaveCSS("font-weight", "400");
      await expect(software.locator("strong")).toHaveCSS("font-weight", "500");
      await expect(software.locator(":scope > span").first()).toHaveCSS("font-weight", "400");
      await expect(software.locator("small")).toHaveCSS("font-weight", "400");
      await expect(software.locator(".schema-starter-choice-action")).toHaveCSS(
        "font-weight",
        "500",
      );
      await expect(editor.getByRole("button", { name: "Text", exact: true })).toBeHidden();
      mkdirSync("output/model-setup", { recursive: true });
      await page.screenshot({ path: `output/model-setup/choices-${width}.png` });
      await software.focus();
      await page.keyboard.press("Enter");
      await expect(software).toHaveAttribute("aria-pressed", "true");
      await software.click(); // Choosing the same starter must not replace the draft.
      const preview = editor.getByRole("region", { name: "Model preview" });
      await expect(preview).toContainText("code");
      await expect(preview.getByRole("heading", { name: "Review your starting model" })).toHaveCSS(
        "font-weight",
        "500",
      );
      const diagram = preview.getByLabel("Development workflow diagram", { exact: true });
      await expect(diagram).toBeVisible();
      await expect(preview.locator(".model-flow-types > li")).toHaveCount(5);
      expect(await preview.locator(".model-flow-route path[marker-end]").count()).toBeGreaterThan(
        0,
      );
      await expect(preview.getByRole("button", { name: "Add type", exact: false })).toHaveCount(0);
      await expect(preview.locator('[draggable="true"]')).toHaveCount(0);
      await preview.getByRole("button", { name: "Select type · code", exact: true }).click();
      await expect(preview.locator(".schema-preview-selection")).toContainText(
        "Fields: title, statement, notes",
      );
      await expect(preview.locator(".schema-preview-selection p")).toHaveCSS("font-weight", "400");
      await expect(preview.locator(".model-flow-types strong").first()).toHaveCSS(
        "font-weight",
        "500",
      );
      await preview
        .getByLabel("Workflow connection", { exact: true })
        .selectOption("contributes_to");
      await expect(preview.locator(".schema-preview-selection")).toContainText(
        "Recorded direction: One of: requirement → contributes to → One of: intent",
      );
      await preview.getByLabel("Workflow connection", { exact: true }).selectOption("");
      await preview.getByRole("button", { name: "Trace connections", exact: true }).click();
      await expect(preview.locator(".model-connection-plan")).toHaveAttribute("data-mode", "trace");
      await preview.getByRole("button", { name: "Development flow", exact: true }).click();
      await expect(software.locator(":scope > span").first()).toHaveCSS("font-weight", "400");
      await preview.scrollIntoViewIfNeeded();
      await diagram.evaluate((element) => element.scrollTo(0, 0));
      if (width === 1440)
        await expect
          .poll(() => diagram.evaluate((element) => element.scrollWidth - element.clientWidth))
          .toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/model-setup/preview-${width}.png` });
      await expect(save).toBeEnabled();
      page.once("dialog", (dialog) => dialog.dismiss());
      await custom.click();
      await expect(software).toHaveAttribute("aria-pressed", "true");
      page.once("dialog", (dialog) => dialog.accept());
      await custom.click();
      await expect(custom).toHaveAttribute("aria-pressed", "true");
      await expect(save).toBeDisabled();
      await editor.getByText("Customize model", { exact: true }).click();
      await editor.getByRole("button", { name: "Text", exact: true }).click();
      await expect(editor.getByLabel("Advanced JSON", { exact: true }).locator("..")).toHaveCSS(
        "font-weight",
        "400",
      );
      const name = editor.getByLabel("New definition name", { exact: true });
      await expect(name).toHaveCSS("font-weight", "400");
      await expect(name.locator("..")).toHaveCSS("font-weight", "500");
      await expect(editor.getByRole("button", { name: "Add definition", exact: true })).toHaveCSS(
        "font-weight",
        "500",
      );
      await name.fill("hazard");
      await editor.getByRole("button", { name: "Add definition", exact: true }).click();
      await expect(preview).toContainText("hazard");
      await preview.getByRole("button", { name: "Select type · hazard", exact: true }).click();
      await expect(preview.locator(".schema-preview-selection")).toContainText(
        "No fields defined.",
      );
      await expect(preview.locator(".model-flow-route")).toHaveCount(0);
      await expect(save).toBeEnabled();
      await page.keyboard.press("ControlOrMeta+k");
      await page.locator("#search").fill("Verification");
      await page.getByRole("option", { name: "Verification", exact: true }).click();
      await openProjectDestination(page, "Model");
      await expect(preview).toContainText("hazard");
      await expect(custom).toHaveAttribute("aria-pressed", "true");
      expect((await tracer.getProjectSnapshot()).projectRevision).toBe(0);
      expect(await tracer.getSchema()).toBeUndefined();
      await editor.locator(".schema-properties").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `output/model-setup/custom-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      page.once("dialog", (dialog) => dialog.accept());
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
    }
  });
}
