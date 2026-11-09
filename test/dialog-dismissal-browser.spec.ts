import { test, expect, closeTestPage } from "./browser-test.ts";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 390]) {
  test(`dialog close controls stay upper-right and light dismissal protects drafts at ${width}px`, async ({
    page,
  }) => {
    const repository = new SQLiteRepository(":memory:");
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      {
        entityTypes: {
          item: {
            fields: {
              title: { type: "string", required: true },
              ...Object.fromEntries(
                Array.from({ length: 12 }, (_, index) => [
                  `detail_${index}`,
                  { type: "string" as const },
                ]),
              ),
            },
          },
        },
        relationshipTypes: {
          relates_to: { source: ["item"], target: ["item"], fields: { scope: { type: "string" } } },
        },
      },
      0,
      { actor: "dialog-regression" },
    );
    for (const key of ["ROOT", "TARGET"])
      await tracer.createEntity({ type: "item", key, fields: { title: key } }, 1, {
        actor: "dialog-regression",
      });
    const before = await tracer.exportProject();
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(server.origin);
      const create = page.locator('[data-action="create-record"]').first();
      await create.click();
      const task = page.getByRole("dialog", { name: "Project task", exact: true });
      const title = task.getByLabel("New record title", { exact: true });
      await title.fill("Keep this unsaved record draft");
      await task.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const close = task.getByRole("button", { name: "Return to workspace", exact: true });
      await expect(close).toBeInViewport();
      const bounds = (await task.boundingBox())!;
      const button = (await close.boundingBox())!;
      expect(button.y).toBeGreaterThanOrEqual(bounds.y);
      expect(button.y).toBeLessThan(bounds.y + 65);
      expect(button.x + button.width).toBeGreaterThan(bounds.x + bounds.width - 65);
      mkdirSync("output/dialog-dismissal", { recursive: true });
      await page.screenshot({ path: `output/dialog-dismissal/task-${width}.png` });
      await close.click();
      await expect(task).toBeHidden();
      await create.click();
      await expect(title).toHaveValue("Keep this unsaved record draft");
      await page.mouse.click(1, 1);
      await expect(task).toBeHidden();
      await create.click();
      await expect(title).toHaveValue("Keep this unsaved record draft");
      await page.keyboard.press("Escape");
      await expect(task).toBeHidden();
      await expect(create).toBeFocused();

      await page.locator('[data-action="search"]').click();
      await page.locator("#search").fill("ROOT");
      await page.locator('[data-result="ROOT"]').click();
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.getByRole("button", { name: "Add relationship", exact: true }).click();
      const dialog = page.locator("#workspace-dialog");
      await page.locator("#connection-target").fill("TARGET");
      await dialog.locator('[name="scope"]').fill("Do not discard this proposal by accident");
      await dialog.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const x = dialog.getByRole("button", { name: "Close dialog", exact: true });
      await expect(x).toBeInViewport();
      const modalBounds = (await dialog.boundingBox())!;
      const xBounds = (await x.boundingBox())!;
      expect(xBounds.y).toBeGreaterThanOrEqual(modalBounds.y);
      expect(xBounds.y).toBeLessThan(modalBounds.y + 65);
      expect(xBounds.x + xBounds.width).toBeGreaterThan(modalBounds.x + modalBounds.width - 65);
      await page.screenshot({ path: `output/dialog-dismissal/connection-${width}.png` });
      page.once("dialog", async (confirmation) => {
        expect(confirmation.message()).toContain("Discard unsaved");
        await confirmation.dismiss();
      });
      await page.mouse.click(1, 1);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[name="scope"]')).toHaveValue(
        "Do not discard this proposal by accident",
      );
      page.once("dialog", (confirmation) => confirmation.dismiss());
      await x.click();
      await expect(dialog).toBeVisible();
      page.once("dialog", (confirmation) => confirmation.accept());
      await page.mouse.click(1, 1);
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Add relationship", exact: true }),
      ).toBeFocused();
      expect(await tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
    }
  });
}
