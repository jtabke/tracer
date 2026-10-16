import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { readDemoGuide } from "../src/interfaces/demo-guide.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { editableField, openView, openExampleTask } from "./browser-navigation.ts";

test("guided Orbit tasks open real shared families and the saved trace while retaining a cancelled draft", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-guided-browser-"));
  const fixture = await seedRealisticProject(join(directory, "project"), "integrated");
  const repository = new SQLiteRepository(fixture.database);
  const guide = await readDemoGuide(join(fixture.directory, "tasks.json"));
  const server = await startLocalServer(
    new Tracer(repository),
    resolve(".fallow/legacy-ui"),
    0,
    guide,
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin + fixture.tasks[0].url);
    await openExampleTask(page, "Shared design across engineering constraints");
    await expect(page.locator(".workspace-surface h2")).toContainText("DES-01");
    await expect(page.locator(".workspace-task-context")).toContainText("One firmware design");
    for (const key of ["REQ-R01", "REQ-R03", "REQ-R04", "REQ-R05", "REQ-R10"])
      await expect(page.locator(".workspace-surface")).toContainText(key);
    await editableField(page, "Workspace statement");
    const draft = page.getByLabel("Workspace statement", { exact: true });
    await draft.fill("A retained local experiment draft");
    page.once("dialog", (dialog) => dialog.dismiss());
    await openExampleTask(page, "Compare concepts before choosing a motor");
    await expect(draft).toHaveValue("A retained local experiment draft");
    await expect(page.locator(".workspace-surface h2")).toContainText("DES-01");
    await openView(page, "Project");
    await page
      .getByRole("button", {
        name: /Goal-to-finding trace across eight columns/,
        exact: true,
      })
      .click();
    await expect(page.locator(".chain-grid").getByRole("columnheader")).toHaveCount(8);
    await expect(page.locator(".chain-grid")).toContainText("EVAL-R04");
    await expect(page.locator(".chain-grid")).toContainText("FIND-R03");
    await page.setViewportSize({ width: 390, height: 844 });
    page.once("dialog", (dialog) => dialog.dismiss());
    await openExampleTask(page, "Keep release questions unresolved");
    await expect(draft).toHaveValue("A retained local experiment draft");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    expect(errors).toEqual([]);
    await page.screenshot({ path: "/tmp/tracer-guided-narrow.png", fullPage: true });
  } finally {
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
