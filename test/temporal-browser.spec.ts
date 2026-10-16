import { closeTestPage } from "./browser-test.ts";
import { editableField, graphControl, openView } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedProject } from "../examples/seed-project.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("dark-first history excludes evidence, keeps spatial context, compares snapshots and locks every mutation view", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-temporal-browser-"));
  const project = await seedProject(join(parent, "demo")),
    repository = new SQLiteRepository(project.database),
    tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    const fw = (await tracer.queryEntities({ key: "FW-03" })).items[0];
    const old = (await tracer.timeline()).head;
    await tracer.updateEntity(
      fw.id,
      fw.version,
      { fields: { ...fw.fields, notes: "Native after snapshot" } },
      1,
      { actor: "browser-test", reason: "Native annotation changes" },
    );
    const requirement = (await tracer.queryEntities({ key: "REQ-001" })).items[0];
    const nativeLink = (
      await tracer.queryRelationships({
        type: "implemented_by",
        source: requirement.id,
        target: fw.id,
      })
    ).items[0];
    const replacement = await tracer.createEntity(
      { type: "artifact", key: "FW-NEXT", fields: { title: "Replacement implementation" } },
      1,
      { actor: "browser-test" },
    );
    await tracer.updateRelationship(
      nativeLink.id,
      nativeLink.version,
      {
        type: nativeLink.type,
        source: requirement.id,
        target: replacement.id,
        fields: nativeLink.fields,
      },
      1,
      { actor: "browser-test", reason: "Relink implementation" },
    );
    const head = (await tracer.timeline()).head;
    await page.goto(server.origin);
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await openView(page, "Graph");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      "dark",
    );
    const node = page.getByTestId("graph-node-FW-03"),
      world = page.getByTestId("graph-world");
    await node.focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    const position = await node.getAttribute("transform");
    let camera = await world.getAttribute("transform");
    const initialCanvas = (await page.getByLabel("Graph canvas", { exact: true }).boundingBox())!;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/graph?**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("atRevision")) await pending;
      await route.continue();
    });
    await (await graphControl(page, "Native revision")).selectOption(String(old));
    await expect(page.locator(".graph-summary")).toContainText("No evidence");
    await expect(page.locator(".graph-node")).toHaveCount(0);
    await expect(page.getByLabel("Graph inspector", { exact: true })).toHaveCount(0);
    release();
    await expect(node).toHaveAttribute("transform", position!);
    await expect(world).toHaveAttribute("transform", camera!);
    await expect(node).toContainText("Native snapshot");
    await node.focus();
    await page.keyboard.press("Enter");
    const inspector = page.getByLabel("Native history inspector", { exact: true });
    await expect(inspector).toContainText(`Revision ${old}`);
    // Opening the inspector reduces actual viewport width; keep zoom and the same
    // world centre, then retain that camera through native snapshot comparisons.
    const inspectedCanvas = (await page.getByLabel("Graph canvas", { exact: true }).boundingBox())!;
    const capturedCamera = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(camera!)!;
    const dx = (inspectedCanvas.width - initialCanvas.width) / 2;
    const dy = (inspectedCanvas.height - initialCanvas.height) / 2;
    if (Math.abs(dx) > 25)
      camera = `translate(${Number(capturedCamera[1]) + dx} ${Number(capturedCamera[2]) + dy}) scale(${capturedCamera[3]})`;
    await expect(world).toHaveAttribute("transform", camera!);
    await expect(inspector.getByRole("button")).toHaveCount(0);
    await expect(page.getByLabel("Graph inspector", { exact: true })).toHaveCount(0);
    await expect(page.locator(".graph-summary")).toContainText("No evidence");
    await (await graphControl(page, "Compare from")).selectOption(String(old));
    await (await graphControl(page, "Native revision")).selectOption(String(head));
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(node).toContainText("Modified");
    await expect(inspector).toContainText("Native after snapshot");
    await expect(
      inspector.getByRole("heading", { name: `Before · revision ${old}` }),
    ).toBeVisible();
    await expect(node).toHaveAttribute("transform", position!);
    await expect(world).toHaveAttribute("transform", camera!);
    await expect(page.getByTestId("graph-node-FW-NEXT")).toContainText("Added");
    await expect(page.locator(".graph-edge.before")).toContainText("implemented by · before");
    await expect(page.locator(".graph-edge.after")).toContainText("implemented by · after");
    await page.screenshot({ path: "/tmp/tracer-temporal-comparison.png", fullPage: true });
    await openView(page, "Model");
    await expect(page.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Configure project model", { exact: true })).toContainText(
      "Based on schema v1",
    );
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add entity", exact: true })).toBeDisabled();
    await openView(page, "Matrix");
    for (const button of await page.locator(".matrix td button").all())
      await expect(button).toBeDisabled();
    await openView(page, "Evidence");
    const mutations = page.locator("#panel-evidence button");
    for (const button of await mutations.all()) await expect(button).toBeDisabled();
    await openView(page, "Graph");
    await (await graphControl(page, "Compare from")).selectOption("");
    await (await graphControl(page, "Native revision")).selectOption("1");
    await expect(
      page.getByText("The focus entity does not exist at this native revision."),
    ).toBeVisible();
    await expect(node).toHaveCount(0);
    await page.getByRole("button", { name: "Return to current", exact: true }).click();
    await expect(node).toHaveAttribute("transform", position!);
    await expect(world).toHaveAttribute("transform", camera!);
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(await editableField(page, "Graph notes")).toBeEnabled();
    expect((await tracer.timeline()).head).toBe(head);
    await page.screenshot({ path: "/tmp/tracer-temporal-workspace.png", fullPage: true });
  } finally {
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("shared selection reveals off-page entities across Graph, Table and Matrix without discarding drafts", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-focus-browser-"));
  const project = await seedProject(join(parent, "demo")),
    repository = new SQLiteRepository(project.database),
    tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    const ids = Array.from(
      { length: 61 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    await tracer.applyChangeset(
      {
        expectedSchemaVersion: 1,
        operations: ids.map((id, index) => ({
          op: "entity.create",
          id,
          input: {
            type: "artifact",
            key: `FOCUS-${index}`,
            fields: { title: `Focus item ${index}` },
          },
        })),
      },
      { actor: "browser-test" },
    );
    await page.goto(server.origin);
    await openView(page, "Graph");
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await page.getByLabel("Entity type", { exact: true }).selectOption("artifact");
    await page.getByRole("button", { name: "Next entities", exact: true }).click();
    await page.getByRole("button", { name: "Focus FOCUS-60", exact: true }).click();
    await expect(
      page
        .locator(".entity-focused")
        .filter({ has: page.getByLabel("notes for FOCUS-60", { exact: true }) }),
    ).toBeVisible();
    await openView(page, "Graph");
    await expect(page.getByTestId("graph-node-FOCUS-60")).toBeVisible();
    await openView(page, "Matrix");
    await expect(page.getByRole("button", { name: "Focus FOCUS-60", exact: true })).toBeVisible();
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await page.getByLabel("notes for FOCUS-60", { exact: true }).fill("Keep this draft");
    await openView(page, "Graph");
    await (await graphControl(page, "Graph entity type")).selectOption("artifact");
    await (await graphControl(page, "Focus entity")).selectOption(ids[0]);
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await expect(page.getByLabel("notes for FOCUS-60", { exact: true })).toHaveValue(
      "Keep this draft",
    );
    await expect(
      page.getByText("Shared selection pending. Save or discard table drafts to reveal it."),
    ).toBeVisible();
    await page.getByLabel("notes for FOCUS-60", { exact: true }).press("Escape");
    await expect(page.getByRole("button", { name: "Focus FOCUS-0", exact: true })).toBeVisible();
  } finally {
    // Close the client before awaiting server shutdown: pending browser keep-alive
    // connections can otherwise outlive the completed assertions on Node 24.
    await closeTestPage(page, true);
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
