import { openView } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Schema } from "../src/core/model.ts";

const research: Schema = {
  entityTypes: {
    hypothesis: { fields: { title: { type: "string" } } },
    observation: { fields: { title: { type: "string" } } },
    isolated: { fields: {} },
  },
  relationshipTypes: {
    supported_by: { fields: {}, source: ["hypothesis", "observation"], target: ["observation"] },
    unrestricted: { fields: {} },
    impossible: { fields: {}, source: [], target: [] },
    self: { fields: {}, source: ["hypothesis"], target: ["hypothesis"] },
  },
};
const provenance = { actor: "model-browser" };

test("actual research model, exact type filter, bounded real links and retained schema attempts", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  await tracer.setSchema(research, 0, provenance);
  const source = await tracer.createEntity(
    { type: "hypothesis", key: "HYP-01", fields: { title: "A real hypothesis" } },
    1,
    provenance,
  );
  const target = await tracer.createEntity(
    { type: "observation", fields: { title: "A real observation" } },
    1,
    provenance,
  );
  for (let i = 0; i < 26; i++)
    await tracer.createRelationship(
      { type: "supported_by", source: source.id, target: target.id, fields: {} },
      1,
      provenance,
    );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    await expect(page.getByRole("tab", { name: "Model", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(".model-flow-types > li")).toHaveCount(3);
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await expect(page.locator(".model-relationships > li")).toHaveCount(4);
    await expect(page.locator(".model-relationships")).toContainText("Any configured type");
    await expect(page.locator(".model-relationships")).toContainText("No source types allowed");
    await page.getByLabel("Focus type", { exact: true }).selectOption("isolated");
    await page.getByRole("button", { name: "Browse items · isolated", exact: true }).click();
    await expect(page.getByLabel("Workspace type", { exact: true })).toHaveValue("isolated");
    await expect(
      page.getByRole("heading", { name: "No matching items", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New item", exact: true }).click();
    await expect(page.getByLabel("New item type", { exact: true })).toHaveValue("isolated");
    await page.getByLabel("New item key", { exact: true }).fill("unsaved key");
    await expect(page.getByLabel("New item type", { exact: true })).toHaveValue("isolated");
    await expect(page.getByLabel("New item key", { exact: true })).toHaveValue("unsaved key");
    await page.getByLabel("New item type", { exact: true }).selectOption("observation");
    await expect(page.getByLabel("New item type", { exact: true })).toHaveValue("observation");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await openView(page, "Model");
    await expect(page.getByLabel("Focus type", { exact: true })).toHaveValue("isolated");
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await page
      .getByRole("button", { name: "View recorded connections · supported_by", exact: true })
      .click();
    const records = page.getByRole("region", { name: "Recorded connections", exact: true });
    await expect(page.locator(".model-records > li")).toHaveCount(25);
    const resultHeading = records.getByRole("heading", {
      name: "Recorded connections · supported_by",
      exact: true,
    });
    await expect(resultHeading).toBeFocused();
    await expect
      .poll(async () => (await resultHeading.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
    await expect.poll(async () => (await resultHeading.boundingBox())?.y ?? 900).toBeLessThan(900);
    await expect(records).toContainText(source.id);
    await expect(records).toContainText("HYP-01");
    await expect(records).toContainText("A real hypothesis");
    await expect(records).toContainText("Type: hypothesis");
    await expect(records).toContainText("A real observation");
    await expect(records).toContainText("Type: observation");
    await page.route("**/api/model-connections?*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({ response, json: { ...data, endpoints: [] } });
    });
    await records.getByRole("button", { name: "Next connections" }).click();
    await expect(page.locator(".model-records > li")).toHaveCount(1);
    await expect(records.getByText("Item summary unavailable", { exact: true })).toHaveCount(2);
    await page.unroute("**/api/model-connections?*");
    await records.getByRole("button", { name: `Inspect source ${source.id}`, exact: true }).click();
    await expect(page.getByLabel("Workspace inspector", { exact: true })).toContainText(
      "A real hypothesis",
    );
    await openView(page, "Model");
    await openView(page, "Workspace");
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await inspector.getByText("Edit item", { exact: true }).click();
    await inspector.getByLabel("Workspace title", { exact: true }).fill("Unsaved hypothesis draft");
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("New definition name", { exact: true }).fill("new_type");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    await page.getByLabel("New field name", { exact: true }).fill("memo");
    await page.getByRole("button", { name: "Add field", exact: true }).click();
    await tracer.setSchema(research, 1, provenance);
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("conflict");
    await page.getByRole("button", { name: "Refresh current data" }).click();
    await expect(page.getByLabel("Configure project model", { exact: true })).toContainText(
      "Based on schema v1",
    );
    await expect(page.getByLabel("Configure project model", { exact: true })).toContainText(
      "new_type",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await openView(page, "Workspace");
    await expect(inspector.getByLabel("Workspace title", { exact: true })).toHaveValue(
      "Unsaved hypothesis draft",
    );
    await openView(page, "Model");
    await records.getByRole("button", { name: "Back to model", exact: true }).click();
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await page
      .getByRole("button", { name: "View recorded connections · supported_by", exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await records
      .getByRole("button", { name: `Inspect target ${target.id}`, exact: true })
      .first()
      .click();
    await expect(inspector.getByLabel("Workspace title", { exact: true })).toHaveValue(
      "Unsaved hypothesis draft",
    );
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Advanced JSON", { exact: true }).check();
    const beforeRejected = (await tracer.timeline()).head;
    await page.getByLabel("Project schema JSON").fill(
      JSON.stringify({
        ...research,
        entityTypes: {
          ...research.entityTypes,
          hypothesis: { fields: { title: { type: "number" } } },
        },
      }),
    );
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("Wrong field type");
    expect((await tracer.timeline()).head).toBe(beforeRejected);
    expect((await tracer.getSchema())?.version).toBe(2);
    expect((await tracer.queryEntities()).items).toHaveLength(2);
    expect((await tracer.queryRelationships()).items).toHaveLength(26);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty guided creation, native fields and endpoint radios save and reload", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-empty-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    await expect(page.getByRole("button", { name: "New item", exact: true })).toBeDisabled();
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("New definition name", { exact: true }).fill("note");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    await page.getByLabel("New field name", { exact: true }).fill("text");
    await page.getByRole("button", { name: "Add field", exact: true }).click();
    await page.getByLabel("Required · text", { exact: true }).check();
    await page.getByRole("button", { name: "← Return to draft definitions", exact: true }).click();
    await page.getByLabel("Definition kind", { exact: true }).selectOption("relationshipTypes");
    await page.getByLabel("New definition name", { exact: true }).fill("ref");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    const sources = page.getByRole("group", { name: "Sources", exact: true });
    await sources.getByLabel("Selected types", { exact: true }).check();
    await sources.getByLabel("note", { exact: true }).check();
    await sources.getByLabel("note", { exact: true }).uncheck();
    await expect(sources).toContainText("Zero selected allows no source types");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project model", exact: true })).toBeVisible();
    const schema = await tracer.getSchema();
    expect(schema?.relationshipTypes.ref.source).toEqual([]);
    expect(schema?.relationshipTypes.ref.target).toBeUndefined();
    expect(schema?.entityTypes.note.fields.text.required).toBe(true);
    await page.reload();
    await openView(page, "Model");
    await expect(page.getByLabel("Focus type", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Select type · note", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New item", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Create item", exact: true })).toBeVisible();
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("invalid JSON and transport uncertainty retain the proposal and require refresh before retry", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-uncertain-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  await tracer.setSchema(research, 0, provenance);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Advanced JSON", { exact: true }).check();
    const input = page.getByLabel("Project schema JSON");
    await input.fill("{unfinished native");
    await expect(page.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    await page.getByLabel("Advanced JSON", { exact: true }).click();
    await expect(input).toHaveValue("{unfinished native");
    await input.fill(JSON.stringify(research));
    await page.route("**/api/schema", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("save may have completed");
    await expect(input).toHaveValue(JSON.stringify(research));
    await expect(page.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    await page.unroute("**/api/schema");
    await page.getByRole("button", { name: "Refresh current data" }).click();
    await expect(page.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "Save model", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project model", exact: true })).toBeVisible();
    expect((await tracer.getSchema())?.version).toBe(2);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejected model save clears prior success and stale proposal has explicit export/restart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-recovery-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  await tracer.setSchema(research, 0, provenance);
  const item = await tracer.createEntity(
    { type: "hypothesis", fields: { title: "Trial A" } },
    1,
    provenance,
  );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("New definition name", { exact: true }).fill("Assay");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("Model saved as schema v2");
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Advanced JSON", { exact: true }).check();
    const committed = await tracer.getSchema();
    const proposal: Schema = {
      entityTypes: {
        ...committed!.entityTypes,
        hypothesis: { fields: { title: { type: "number" } } },
      },
      relationshipTypes: committed!.relationshipTypes,
    };
    const input = page.getByLabel("Project schema JSON");
    await input.fill(JSON.stringify(proposal));
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("Wrong field type");
    await expect(page.getByRole("status").first()).not.toContainText("Model saved");
    await expect(input).toHaveValue(JSON.stringify(proposal));
    expect((await tracer.getSchema())?.version).toBe(2);
    expect(
      (await tracer.queryEntities()).items.find((entity) => entity.id === item.id)?.fields.title,
    ).toBe("Trial A");
    await page.screenshot({
      path: "/tmp/tracer-model-overview-20261012/round-2-repair-reject.png",
    });
    const validProposal = {
      ...proposal,
      entityTypes: { ...committed!.entityTypes, Pending: { fields: {} } },
    };
    await input.fill(JSON.stringify(validProposal));
    await tracer.setSchema(
      {
        entityTypes: { ...committed!.entityTypes, External: { fields: {} } },
        relationshipTypes: committed!.relationshipTypes,
      },
      2,
      provenance,
    );
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("schema_conflict");
    await page.getByRole("button", { name: "Refresh current data" }).click();
    await expect(page.getByLabel("Stale model proposal")).toContainText(
      "retrying Save cannot commit",
    );
    await expect(input).toHaveValue(JSON.stringify(validProposal));
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export proposal JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("model-proposal-v2.json");
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream!) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe(JSON.stringify(validProposal));
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Start from current model" }).click();
    await expect(input).toHaveValue(JSON.stringify(validProposal));
    await page.screenshot({ path: "/tmp/tracer-model-overview-20261012/round-2-repair-stale.png" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Start from current model" }).click();
    const editor = page.getByLabel("Configure project model", { exact: true });
    await expect(editor).toContainText("Based on schema v3");
    await editor.getByRole("button", { name: "Text", exact: true }).click();
    await expect(editor.getByRole("button", { name: "External", exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Pending", exact: true })).toHaveCount(0);
    expect((await tracer.getSchema())?.version).toBe(3);
    await page.getByLabel("New definition name", { exact: true }).fill("Pending");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project model", exact: true })).toBeVisible();
    const saved = await tracer.getSchema();
    expect(saved?.version).toBe(4);
    expect(saved?.entityTypes.External).toBeDefined();
    expect(saved?.entityTypes.Pending).toBeDefined();
    expect(
      (await tracer.queryEntities()).items.find((entity) => entity.id === item.id)?.fields.title,
    ).toBe("Trial A");
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("narrow dense map focus and Cancel restore keyboard position without writes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-keyboard-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  const dense: Schema = {
    entityTypes: Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`ResearchType${index + 1}`, { fields: {} }]),
    ),
    relationshipTypes: {
      supports: {
        fields: {},
        source: ["ResearchType1", "ResearchType2"],
        target: ["ResearchType3"],
      },
      unrestricted: { fields: {} },
      impossible: { fields: {}, source: [], target: [] },
    },
  };
  await tracer.setSchema(dense, 0, provenance);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    const focus = page.getByLabel("Focus type", { exact: true });
    await focus.focus();
    await expect(focus).toBeFocused();
    await focus.selectOption("ResearchType30");
    await expect(focus).toHaveValue("ResearchType30");
    await page.getByRole("button", { name: "Inputs and outputs", exact: true }).click();
    await expect(
      page.getByLabel("ResearchType30 inputs and outputs", { exact: true }),
    ).toContainText("No authored incoming path");
    await expect(focus.locator("option")).toHaveCount(31);
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await expect(page.getByLabel("Native relationship permissions", { exact: true })).toContainText(
      "Any configured type",
    );
    await expect(page.locator(".model-relationships > li")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    const configure = page.getByRole("button", { name: "Configure model", exact: true });
    await configure.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Configure model", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(configure).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("New definition name", { exact: true }).fill("Unsaved");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Unsaved", exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByLabel("New field name", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(configure).toBeFocused();
    expect((await tracer.getSchema())?.version).toBe(1);
    expect((await tracer.getSchema())?.entityTypes.Unsaved).toBeUndefined();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(configure).toBeFocused();
    expect((await tracer.getSchema())?.version).toBe(2);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty model starter remains keyboard-operable inside a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-empty-narrow-"));
  const repo = new SQLiteRepository(join(dir, "project.sqlite"));
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    const starter = page.getByLabel("Starter structure", { exact: true });
    await expect(starter).toHaveValue("empty");
    await starter.focus();
    await expect(starter).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Visual", exact: true })).toBeFocused();
    await page.getByLabel("Advanced JSON", { exact: true }).focus();
    await expect(page.getByLabel("Advanced JSON", { exact: true })).toBeFocused();
    const option = await starter.locator("option").nth(1).getAttribute("value");
    await starter.selectOption(option!);
    await expect(starter).not.toHaveValue("empty");
    page.once("dialog", (dialog) => dialog.accept());
    await starter.selectOption("empty");
    await expect(starter).toHaveValue("empty");
    await page.getByLabel("New definition name", { exact: true }).fill("ReviewObservation");
    await page.getByRole("button", { name: "Add definition", exact: true }).click();
    await page.getByLabel("New field name", { exact: true }).fill("confidence");
    await page.getByRole("button", { name: "Add field", exact: true }).click();
    const bounds = await starter.evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.documentWidth).toBe(bounds.viewport);
    await page.screenshot({
      path: "/tmp/tracer-model-overview-20261012/followup-empty-390.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project model", exact: true })).toBeVisible();
    expect((await tracer.getSchema())?.entityTypes.ReviewObservation.fields.confidence.type).toBe(
      "string",
    );
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
