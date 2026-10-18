import { test, expect, closeTestPage } from "./browser-test.ts";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { serializeProjectExport } from "../src/core/project-export.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { projectTemplates } from "../src/core/project-templates.ts";

const origin = { actor: "export browser engineer", reason: "Simulated monitor review" };
for (const width of [1440, 680]) {
  test(`prepared export downloads identical bytes and retains its captured versions at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-export-ui-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema(projectTemplates.engineering.schema, 0, origin);
    const requirement = await tracer.createEntity(
      {
        type: "requirement",
        key: "REQ-1",
        fields: { title: "CO₂ monitoring", acceptance: "≤ 1000 ppm" },
      },
      1,
      origin,
    );
    const result = await tracer.createEntity(
      { type: "test", key: "TEST-1", fields: { title: "SIMULATED monitor test" } },
      1,
      origin,
    );
    await tracer.evidence.recordReceipt(
      { outputId: result.id, outcome: "SIMULATED pass", inputs: [{ entityId: requirement.id }] },
      origin,
    );
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Export project", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Project task", exact: true });
      await expect(dialog.getByRole("button", { name: "Download JSON", exact: true })).toHaveCount(
        0,
      );
      const before = await tracer.exportProject();
      await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText(
        `Native revision r${before.projectRevision}`,
      );
      await expect(dialog.getByLabel("Prepared export")).toContainText(
        "Later edits do not change this prepared file",
      );
      expect(
        await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/project-export-${width}.png`, fullPage: true });
      await tracer.updateEntity(
        requirement.id,
        1,
        { fields: { title: "Tightened CO₂ limit", acceptance: "≤ 800 ppm" } },
        1,
        origin,
      );
      const downloadEvent = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Download JSON", exact: true }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(
        `tracer-r${before.projectRevision}-e${before.evidenceRevision}.json`,
      );
      expect(readFileSync((await download.path())!, "utf8")).toBe(serializeProjectExport(before));
      await dialog.getByRole("button", { name: "Return to map", exact: true }).click();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Export project", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText(
        `Native revision r${before.projectRevision}`,
      );
      await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText(
        `Native revision r${before.projectRevision + 1}`,
      );
      const updated = await tracer.exportProject();
      const newDownloadEvent = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Download JSON", exact: true }).click();
      expect(readFileSync((await (await newDownloadEvent).path())!, "utf8")).toBe(
        serializeProjectExport(updated),
      );
      expect(updated.evidence.receipts[0].inputs[0].entity.version).toBe(1);
      expect(updated.current.entities.find((value) => value.id === requirement.id)?.version).toBe(
        2,
      );
      await page.route("**/api/project-export", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "busy",
            message: "Database is busy; retry the complete command",
          }),
        }),
      );
      await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("Database is busy");
      await expect(dialog.getByRole("button", { name: "Download JSON", exact: true })).toHaveCount(
        0,
      );
      expect(await tracer.exportProject()).toEqual(updated);
      await page.unroute("**/api/project-export");
      await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText(
        `Native revision r${updated.projectRevision}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("empty-project export handles a failed response decoder without claiming a prepared file", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    await page.getByRole("button", { name: "Project tools", exact: true }).click();
    await page.getByRole("button", { name: "Export project", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Project task", exact: true });
    await page.route("**/api/project-export", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ format: "tracer-project-export" }),
      }),
    );
    await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Could not read the project");
    await expect(dialog.getByLabel("Prepared export")).toHaveCount(0);
    await page.unroute("**/api/project-export");
    await dialog.getByRole("button", { name: "Prepare current export", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText(
      "Native revision r0 · Model not configured · Evidence sequence 0",
    );
    expect((await tracer.exportProject()).projectRevision).toBe(0);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});
