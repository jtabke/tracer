import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject, type RealisticDomain } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { typeNames, indexFixture, traceProjection } from "../ui/map/model.ts";
import { mapData } from "../ui/map-data.ts";

type Project = Awaited<ReturnType<typeof seedRealisticProject>>;
async function nativeProject(
  page: Page,
  domain: RealisticDomain,
  run: (core: Tracer, project: Project) => Promise<void>,
) {
  const directory = mkdtempSync(join(tmpdir(), "tracer-native-controls-"));
  const project = await seedRealisticProject(join(directory, "project"), domain);
  const repository = new SQLiteRepository(project.database),
    core = new Tracer(repository);
  const server = await startLocalServer(core, resolve("dist"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin + "/?workspace=map");
    await ready(page);
    await run(core, project);
    expect(errors).toEqual([]);
  } finally {
    try {
      await closeTestPage(page);
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
}
async function ready(page: Page) {
  await expect(page.getByLabel("Interactive development graph", { exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function find(page: Page, key: string) {
  await page.getByRole("searchbox", { name: "Find an item" }).fill(key);
  await page
    .getByRole("button")
    .filter({ hasText: new RegExp(`^${key} ·`) })
    .click();
  await ready(page);
}
async function filterCheckbox(page: Page, type: string) {
  const panel = page.getByRole("region", { name: "Graph filters", exact: true });
  const checkbox = panel.getByRole("checkbox", {
    name: typeNames[type] ?? type,
    exact: true,
    includeHidden: true,
  });
  if (!(await checkbox.isVisible()))
    await checkbox.locator("xpath=ancestor::details/summary").click();
  return checkbox;
}
for (const domain of ["medical", "integrated"] as const) {
  test(`${domain}: filters, display choices and saved session views share one retained working map`, async ({
    page,
  }) => {
    await nativeProject(page, domain, async (core) => {
      const original = await core.getProjectSnapshot();
      const subject = original.entities.find(
        (item) => item.key === (domain === "medical" ? "PRS-01" : "REQ-R01"),
      )!;
      await page.getByLabel("Map scope", { exact: true }).selectOption("all");
      await ready(page);
      await page.getByLabel("Group detail", { exact: true }).selectOption("items");
      await ready(page);
      const group = page.locator(`.canvas .react-flow__node[data-id="group:${subject.type}"]`);
      await expect(group).toHaveCount(1);
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      const choice = await filterCheckbox(page, subject.type);
      await choice.uncheck();
      await ready(page);
      await expect(group).toHaveCount(0);
      await choice.check();
      await ready(page);
      await expect(group).toHaveCount(1);
      const filters = page.getByRole("region", { name: "Graph filters", exact: true });
      const itemTab = filters.getByRole("tab", { name: "Items", exact: true });
      await itemTab.focus();
      await page.keyboard.press("ArrowRight");
      await expect(filters.getByRole("tab", { name: "Connections", exact: true })).toBeFocused();
      await filters.getByRole("button", { name: "Hide all relevant", exact: true }).click();
      await ready(page);
      await expect(page.locator(".canvas .react-flow__edge")).toHaveCount(0);
      await filters.getByRole("button", { name: "Show all relevant", exact: true }).click();
      await ready(page);
      await expect(page.locator(".canvas .react-flow__edge").first()).toBeAttached();
      await filters.getByRole("button", { name: "Close filters", exact: true }).click();
      await page.getByRole("button", { name: "Display", exact: true }).click();
      await page.getByLabel("Graph spacing", { exact: true }).selectOption("compact");
      await ready(page);
      await page.getByLabel("Connection labels", { exact: true }).selectOption("all");
      await page.getByRole("button", { name: "Close display", exact: true }).click();
      const preset = await page.getByLabel("Map scope", { exact: true }).inputValue();
      await page.getByRole("button", { name: "Save view", exact: true }).click();
      await page.getByLabel("Session view name", { exact: true }).fill("Review scope");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Items table", exact: true }).click();
      await page.getByLabel("Map scope", { exact: true }).selectOption("requirements");
      await page.getByRole("button", { name: "Review scope", exact: true }).click();
      await ready(page);
      await expect(page.getByRole("button", { name: "Graph", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByLabel("Map scope", { exact: true })).toHaveValue(preset);
      await page.getByRole("button", { name: "Display", exact: true }).click();
      await expect(page.getByLabel("Graph spacing", { exact: true })).toHaveValue("compact");
      await expect(page.getByLabel("Connection labels", { exact: true })).toHaveValue("all");
      await page.getByRole("button", { name: "Close display", exact: true }).click();
      expect(await core.getProjectSnapshot()).toEqual(original);
      await page.reload();
      await ready(page);
      await expect(page.getByRole("button", { name: "Review scope", exact: true })).toHaveCount(0);
      expect(await core.getProjectSnapshot()).toEqual(original);
    });
  });

  test(`${domain}: bulk folders and categories remain session organization with native identity intact`, async ({
    page,
  }) => {
    await nativeProject(page, domain, async (core) => {
      const original = await core.getProjectSnapshot();
      const subject = original.entities.find(
        (item) => item.key === (domain === "medical" ? "PRS-01" : "REQ-R01"),
      )!;
      const members = original.entities
        .filter((item) => item.type === subject.type)
        .sort((a, b) => a.key!.localeCompare(b.key!))
        .slice(0, 2);
      await page.getByLabel("Map scope", { exact: true }).selectOption("all");
      await ready(page);
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      for (const type of Object.keys(original.schema!.entityTypes))
        await (await filterCheckbox(page, type)).setChecked(type === subject.type);
      await page.getByRole("button", { name: "Close filters", exact: true }).click();
      await ready(page);
      await page.getByRole("button", { name: "Items table", exact: true }).click();
      for (const member of members)
        await page.getByRole("checkbox", { name: `Select ${member.key}`, exact: true }).check();
      await page.getByRole("button", { name: "Organize 2 items", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Organize 2 items", exact: true });
      await dialog.getByLabel("Action", { exact: true }).selectOption("add");
      await dialog.getByLabel("Category", { exact: true }).fill("Review");
      await dialog.getByRole("button", { name: "Apply to 2 items", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      for (const member of members)
        await page.getByRole("checkbox", { name: `Select ${member.key}`, exact: true }).check();
      await page.getByRole("button", { name: "Organize 2 items", exact: true }).click();
      const folder = dialog.getByLabel("Folder within each item's type", { exact: true });
      await folder.fill(" / / ");
      await dialog.getByRole("button", { name: "Apply to 2 items", exact: true }).click();
      await expect(dialog).toBeVisible();
      expect(await core.getProjectSnapshot()).toEqual(original);
      await folder.fill(" / Review // Electrical / ");
      await dialog.getByRole("button", { name: "Apply to 2 items", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: "Graph", exact: true }).click();
      await ready(page);
      await page.getByRole("button", { name: "Browse folders", exact: true }).click();
      const browser = page.getByRole("region", { name: "Folder browser", exact: true });
      await browser.locator("summary").filter({ hasText: typeNames[subject.type] }).click();
      await browser.getByRole("button").filter({ hasText: "Review / Electrical" }).click();
      await ready(page);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Electrical");
      await expect(
        page.getByLabel("Trace a folder item", { exact: true }).locator("option"),
      ).toHaveCount(3);
      await page.getByLabel("Trace a folder item", { exact: true }).selectOption(members[0].id);
      await ready(page);
      await expect(
        page.getByRole("heading", { name: `Trace · ${members[0].key}`, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "← Folder", exact: true }).click();
      await ready(page);
      await page.getByRole("button", { name: "Undo organization", exact: true }).click();
      await ready(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data model");
      expect(await core.getProjectSnapshot()).toEqual(original);
      await page.reload();
      await ready(page);
      expect(await core.getProjectSnapshot()).toEqual(original);
      await expect(page.locator(".area-navigation")).not.toContainText("Review");
    });
  });

  test(`${domain}: native configuration capture and documentation retain their task owners`, async ({
    page,
  }) => {
    await nativeProject(page, domain, async (core, project) => {
      const seed = Object.values(project.configurations)[0];
      const original = await core.getProjectSnapshot(),
        name = `${domain} retained native capture`;
      await page.getByRole("button", { name: "Configurations", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Project task", exact: true });
      await dialog.getByRole("button", { name: "Capture configuration", exact: true }).click();
      const task = dialog.getByRole("region", { name: "Capture configuration task", exact: true });
      await task.getByLabel("Configuration name", { exact: true }).fill(name);
      await task
        .getByLabel("Find configuration subject", { exact: true })
        .fill(seed.subject.key ?? seed.subject.resource?.label ?? seed.subject.id);
      await task.getByLabel("Configuration subject", { exact: true }).selectOption(seed.subject.id);
      await task
        .getByLabel("Find member entity", { exact: true })
        .fill(
          seed.members[0].entity.key ??
            seed.members[0].entity.resource?.label ??
            seed.members[0].entity.id,
        );
      await task
        .getByLabel("Member entity", { exact: true })
        .selectOption(seed.members[0].entity.id);
      const revision = Number(
        await task.getByLabel("Input revision", { exact: true }).inputValue(),
      );
      await task
        .getByLabel("Capture purpose", { exact: true })
        .fill("Retain selected native revision for this task");
      await task
        .getByLabel("Scope rationale", { exact: true })
        .fill("Partial native scope; no unselected content or relationships are inferred");
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Configurations", exact: true }).click();
      await expect(task.getByLabel("Configuration name", { exact: true })).toHaveValue(name);
      await task.getByRole("button", { name: "Prepare capture", exact: true }).click();
      await task.getByRole("button", { name: "Capture configuration", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await core.configurations.list()).items.filter((value) => value.name === name).length,
        )
        .toBe(1);
      const recorded = (await core.configurations.list()).items.find(
        (value) => value.name === name,
      )!;
      expect(recorded.members[0].entity.id).toBe(seed.members[0].entity.id);
      expect(recorded.members[0].entity.version).toBe(revision);
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      await dialog.getByLabel("Documentation topic", { exact: true }).selectOption("common");
      await expect(
        dialog.getByRole("article", { name: "Shared development logic", exact: true }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Documentation", exact: true }).click();
      await expect(dialog.getByLabel("Documentation topic", { exact: true })).toHaveValue("common");
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.reload();
      await ready(page);
      await page.getByRole("button", { name: "Configurations", exact: true }).click();
      await dialog.getByRole("button", { name: `Open configuration ${name}`, exact: true }).click();
      await expect(
        dialog.getByRole("region", { name: "Selected configuration capture", exact: true }),
      ).toContainText(name);
      expect(await core.configurations.get(recorded.id)).toEqual(recorded);
      expect(await core.getProjectSnapshot()).toEqual(original);
    });
  });
  test(`${domain}: group paging, focused scopes, path emphasis and connection records preserve native identity`, async ({
    page,
  }) => {
    await nativeProject(page, domain, async (core) => {
      const original = await core.getProjectSnapshot();
      const subject = original.entities.find(
        (item) => item.key === (domain === "medical" ? "PRS-01" : "REQ-R01"),
      )!;
      await page.getByLabel("Map scope", { exact: true }).selectOption("all");
      await ready(page);
      await page.getByLabel("Group detail", { exact: true }).selectOption("items");
      await ready(page);
      await page.getByRole("button", { name: "Frame all", exact: true }).click();
      const group = page.locator(`.canvas .react-flow__node[data-id="group:${subject.type}"]`);
      await group.locator(".group-heading strong").click();
      await page.getByRole("button", { name: "Expand in place", exact: true }).click();
      await ready(page);
      const first = await page.locator(".canvas .record-key").allTextContents();
      await page.getByRole("button", { name: "Frame all", exact: true }).click();
      await page.getByRole("button", { name: "Next 5 →", exact: true }).click();
      await ready(page);
      expect(await page.locator(".canvas .record-key").allTextContents()).not.toEqual(first);
      await group.locator(".group-heading strong").click();
      await page.getByRole("button", { name: "Collapse group", exact: true }).click();
      await ready(page);
      await page.getByLabel("Group detail", { exact: true }).selectOption("folders");
      await ready(page);
      await page.getByRole("button", { name: "Frame all", exact: true }).click();
      await group.locator(".group-heading strong").click();
      await page.getByRole("button", { name: "Focus group →", exact: true }).click();
      await ready(page);
      const sources = page.getByLabel("Trace a folder item", { exact: true });
      const previous = page.getByRole("button", { name: "Previous folder items", exact: true });
      if (await previous.isEnabled()) {
        await previous.click();
        await ready(page);
      }
      const initial = await sources.locator("option").allTextContents();
      await page.getByRole("button", { name: "Next folder items", exact: true }).click();
      await ready(page);
      expect(await sources.locator("option").allTextContents()).not.toEqual(initial);
      await page.getByRole("button", { name: "← Back", exact: true }).click();
      await ready(page);
      await find(page, subject.key!);
      await page.getByRole("button", { name: "Frame selection", exact: true }).click();
      await expect(
        page.locator(`.canvas .react-flow__node[data-id="${subject.id}"]`),
      ).toBeInViewport();
      const index = indexFixture(mapData(original, "Native controls"));
      const projection = traceProjection(index, {
        root: subject.id,
        depth: 1,
        direction: "downstream",
        relations: Object.keys(original.schema!.relationshipTypes),
      });
      const target = projection.nodes.find((node) => node.id !== subject.id)!;
      await page.getByRole("button", { name: "Frame all", exact: true }).click();
      await page.locator(`.canvas .react-flow__node[data-id="${target.id}"] .record-node`).click();
      await ready(page);
      await page.getByRole("button", { name: "Isolate path", exact: true }).click();
      await expect(page.locator(".canvas .react-flow__edge")).toHaveCount(1);
      await page.getByRole("button", { name: "Show context", exact: true }).click();
      await page.getByRole("button", { name: "Frame all", exact: true }).click();
      await page.locator(".canvas .edge-label").first().click();
      const tray = page.getByRole("region", { name: "Connection records", exact: true });
      await expect(tray).toContainText("exact native endpoints");
      const id = await tray.locator("tr[data-link-id]").first().getAttribute("data-link-id");
      expect(original.relationships.some((link) => link.id === id)).toBe(true);
      await tray.getByRole("button", { name: "Close connection records", exact: true }).click();
      expect(await core.getProjectSnapshot()).toEqual(original);
    });
  });
}
