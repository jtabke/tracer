import { test, expect, closeTestPage } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Page } from "@playwright/test";
import { projectTemplates } from "../src/core/project-templates.ts";

const actor = { actor: "csv-browser-test" };
async function openImport(page: Page) {
  await page.getByRole("button", { name: "Project tools", exact: true }).click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  return page.getByRole("dialog", { name: "Project task", exact: true });
}
async function upload(page: Page, text: string) {
  await page
    .getByLabel("CSV file", { exact: true })
    .setInputFiles({ name: "requirements.csv", mimeType: "text/csv", buffer: Buffer.from(text) });
}
async function mapRequirement(page: Page) {
  await page.getByLabel("Record type", { exact: true }).selectOption("requirement");
  await page.getByLabel("title (string, required)", { exact: true }).selectOption("1");
  await page.getByLabel("notes (string)", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Add link mapping", exact: true }).click();
  await page.getByLabel("Relationship type", { exact: true }).selectOption("mapped_to");
  await page.getByLabel("Target key column", { exact: true }).selectOption("2");
}
for (const width of [1440, 680]) {
  test(`CSV mapping previews errors and commits records/links atomically at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-csv-ui-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema(projectTemplates.engineering.schema, 0, actor);
    const target = await tracer.createEntity(
      { type: "design", key: "DES-1", fields: { title: "Sensor design" } },
      1,
      actor,
    );
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      let dialog = await openImport(page);
      const before = await tracer.getProjectSnapshot();
      await upload(
        page,
        'key,Name,Allocation,Notes\nREQ-1,"Measurement, range",MISSING,ignored\nREQ-2,Sample rate,DES-1,ignored',
      );
      await mapRequirement(page);
      await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
      const preview = page.getByLabel("CSV import preview", { exact: true });
      await expect(preview).toContainText("Unknown target key: MISSING");
      await expect(preview).toContainText("Line 2");
      await expect(preview).toContainText("Ignored columns: Notes");
      await expect(
        dialog.getByRole("button", { name: "Commit entire import", exact: true }),
      ).toBeDisabled();
      expect(await tracer.getProjectSnapshot()).toEqual(before);
      await page.screenshot({ path: `output/csv-errors-${width}.png`, fullPage: true });
      await upload(
        page,
        'key,Name,Allocation,Notes\nREQ-1,"Measurement, range",DES-1,ignored\nREQ-2,Sample rate,DES-1,ignored',
      );
      await mapRequirement(page);
      await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
      await expect(preview).toContainText("2 new records · 2 new links · 0 errors");
      await expect(preview).toContainText("Measurement, range");
      await expect(preview).toContainText("REQ-1 → DES-1");
      expect(
        await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/csv-preview-${width}.png`, fullPage: true });
      await dialog.getByRole("button", { name: "Commit entire import", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText(
        "Imported 2 records and 2 links together",
      );
      const saved = await tracer.getProjectSnapshot();
      expect(saved.projectRevision).toBe(before.projectRevision + 1);
      expect(saved.entities).toHaveLength(3);
      expect(saved.relationships).toHaveLength(2);
      expect(saved.relationships.every((link) => link.target === target.id)).toBe(true);
      const revision = await tracer.timeline();
      expect(
        (await tracer.history()).items.filter((item) => item.projectRevision === revision.head),
      ).toHaveLength(4);
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.reload();
      dialog = await openImport(page);
      await upload(page, "source,target,scope\nREQ-1,DES-1,duplicate");
      await page.getByLabel("Import as", { exact: true }).selectOption("links");
      await page.getByLabel("Relationship type", { exact: true }).selectOption("mapped_to");
      await page.getByLabel("scope (string)", { exact: true }).selectOption("2");
      await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
      await expect(preview).toContainText("Connection already exists");
      expect(await tracer.getProjectSnapshot()).toEqual(saved);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("CSV commit rejects a stale target without any partial records and requires a new preview", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(projectTemplates.engineering.schema, 0, actor);
  const target = await tracer.createEntity(
    { type: "design", key: "DES-1", fields: { title: "Old design" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const dialog = await openImport(page);
    await upload(page, "key,Name,Allocation\nREQ-1,First,DES-1\nREQ-2,Second,DES-1");
    await mapRequirement(page);
    await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
    await expect(page.getByLabel("CSV import preview", { exact: true })).toContainText("0 errors");
    await tracer.updateEntity({
      id: target.id,
      expectedVersion: 1,
      expectedSchemaVersion: 1,
      fields: { title: "Concurrent design" },
      provenance: actor,
    });
    const before = await tracer.getProjectSnapshot();
    await dialog.getByRole("button", { name: "Commit entire import", exact: true }).click();
    await expect(dialog).toContainText("Project changed since preview");
    await expect(
      dialog.getByRole("button", { name: "Commit entire import", exact: true }),
    ).toHaveCount(0);
    expect(await tracer.getProjectSnapshot()).toEqual(before);
    await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
    await expect(page.getByLabel("CSV import preview", { exact: true })).toContainText("0 errors");
    await dialog.getByRole("button", { name: "Commit entire import", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText(
      "Imported 2 records and 2 links together",
    );
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});

test("CSV lost response retains input, blocks writes and never replays the imported batch", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(projectTemplates.engineering.schema, 0, actor);
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const dialog = await openImport(page);
    await dialog.getByText("Paste or edit CSV", { exact: true }).click();
    await dialog.getByLabel("CSV text", { exact: true }).fill("key,title\nREQ-1,Imported once");
    await dialog.getByRole("button", { name: "Read columns", exact: true }).click();
    await dialog.getByLabel("Record type", { exact: true }).selectOption("requirement");
    await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
    await expect(page.getByLabel("CSV import preview", { exact: true })).toContainText("0 errors");
    let writes = 0;
    await page.route("**/api/changesets", async (route) => {
      writes++;
      await route.fetch();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "Unreadable committed response",
      });
    });
    await dialog.getByRole("button", { name: "Commit entire import", exact: true }).click();
    await expect(dialog).toContainText("Import was not confirmed");
    await expect(dialog.getByLabel("CSV text", { exact: true })).toHaveValue(
      "key,title\nREQ-1,Imported once",
    );
    await expect(
      dialog.getByRole("button", { name: "Preview import", exact: true }),
    ).toBeDisabled();
    expect((await tracer.getProjectSnapshot()).entities).toHaveLength(1);
    expect(writes).toBe(1);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});
