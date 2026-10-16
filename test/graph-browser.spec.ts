import { editableField, graphControl, openView } from "./browser-navigation.ts";
import { test as base, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedProject } from "../examples/seed-project.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Receipt } from "../src/core/evidence.ts";

const test = base.extend<{
  app: {
    tracer: Tracer;
    origin: string;
    scenarios: Awaited<ReturnType<typeof seedProject>>["scenarios"];
  };
}>({
  app: async ({}, use) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-graph-browser-"));
    const project = await seedProject(join(parent, "demo")),
      repository = new SQLiteRepository(project.database),
      tracer = new Tracer(repository, undefined, observeLocal);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ tracer, origin: server.origin, scenarios: project.scenarios });
    } finally {
      await server.close();
      repository.close();
      rmSync(parent, { recursive: true, force: true });
    }
  },
});

test("advanced graph workspace: named nodes, pan/zoom, pointer and keyboard layout, field edits shared with Table", async ({
  app,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(app.origin);
  await openView(page, "Graph");
  await expect(page.getByRole("tab", { name: "Graph query", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const node = page.getByTestId("graph-node-FW-03");
  await expect(node).toBeVisible();
  const world = page.getByTestId("graph-world"),
    originalCamera = await world.getAttribute("transform");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(world).not.toHaveAttribute("transform", originalCamera!);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const wheelCanvas = page.getByLabel("Graph canvas", { exact: true });
  await wheelCanvas.hover();
  const beforeWheel = await world.getAttribute("transform"),
    scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -160);
  await expect(world).not.toHaveAttribute("transform", beforeWheel!);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const before = await node.getAttribute("transform"),
    revisions = (await app.tracer.history()).items.length;
  await node.scrollIntoViewIfNeeded();
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 35, { steps: 5 });
  await page.mouse.up();
  await expect(node).not.toHaveAttribute("transform", before!);
  expect((await app.tracer.history()).items.length).toBe(revisions);
  await node.focus();
  const moved = await node.getAttribute("transform");
  await page.keyboard.press("ArrowRight");
  await expect(node).not.toHaveAttribute("transform", moved!);
  await page.keyboard.press("Enter");
  const inspector = page.getByLabel("Graph inspector", { exact: true });
  await expect(inspector.getByRole("heading", { name: "FW-03", exact: true })).toBeVisible();
  const observations = (await app.tracer.evidence.list("observation")).items.length;
  const nativeHead = (await app.tracer.history()).items.length;
  await inspector.getByRole("button", { name: "Observe local source again", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.evidence.list("observation")).items.length)
    .toBe(observations + 1);
  expect((await app.tracer.history()).items.length).toBe(nativeHead);
  await (await editableField(page, "Graph notes")).fill("Annotated directly from the graph");
  await page.getByRole("button", { name: "Save node", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.queryEntities({ key: "FW-03" })).items[0].fields.notes)
    .toBe("Annotated directly from the graph");
  const placed = await node.getAttribute("transform");
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  await page.getByLabel("Entity type", { exact: true }).selectOption("artifact");
  await expect(page.getByLabel("notes for FW-03", { exact: true })).toHaveValue(
    "Annotated directly from the graph",
  );
  await openView(page, "Graph");
  await expect(node).toHaveAttribute("transform", placed!);
  const canvas = page.getByLabel("Graph canvas", { exact: true });
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = (await canvas.boundingBox())!;
  const camera = await world.getAttribute("transform");
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, canvasBox.y + canvasBox.height - 10);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width - 65, canvasBox.y + canvasBox.height - 35, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(world).not.toHaveAttribute("transform", camera!);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "/tmp/tracer-graph-workspace.png", fullPage: true });
  const tabs = page.getByRole("tablist", { name: "Query tools", exact: true }).getByRole("tab");
  await page.getByRole("tab", { name: "Graph query", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await tabs.first().press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await tabs.last().press("ArrowLeft");
  await expect(tabs.nth((await tabs.count()) - 2)).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("declared dependencies explain named paths and record immutable assessments without clearing drift", async ({
  app,
  page,
}) => {
  await page.goto(app.origin);
  await openView(page, "Graph");
  await page.getByTestId("graph-node-EVAL-CHANGED").click();
  const inspector = page.getByLabel("Graph inspector", { exact: true });
  await inspector.getByRole("button", { name: "Original qualification", exact: true }).click();
  const dependency = page.getByRole("button", {
    name: "Dependency: EVAL-CHANGED → FW-03 (evaluated using · captured v1)",
    exact: true,
  });
  await dependency.focus();
  await page.keyboard.press("Enter");
  await expect(inspector).toContainText("Declared evaluation dependency");
  await expect(inspector.getByText("REQ-001 → FW-03", { exact: false })).toBeVisible();
  await expect(inspector.getByText(/Scoped content changed:/)).toBeVisible();
  await page
    .getByLabel("Graph review rationale", { exact: true })
    .fill("The report covers the updated motor speed range");
  await page.getByRole("button", { name: "Record assessment", exact: true }).click();
  await expect
    .poll(
      async () => (await app.tracer.evidence.compareReceipt(app.scenarios.changed)).review.state,
    )
    .toBe("accepted");
  await expect(
    page
      .getByTestId("graph-node-EVAL-CHANGED")
      .getByText("Input drift · accepted", { exact: true }),
  ).toBeVisible();
  expect((await app.tracer.evidence.compareReceipt(app.scenarios.changed)).state).toBe("changed");
  const receipt = (await app.tracer.evidence.list("receipt")).items.find(
    (value) => value.id === app.scenarios.changed,
  ) as Receipt;
  expect(receipt.inputs[1].observation?.commit).not.toBe(
    (await app.tracer.evidence.compareReceipt(receipt.id)).inputs[1].current.observation?.commit,
  );
  await (await graphControl(page, "Graph entity type")).selectOption("evaluation");
  const unknown = (await app.tracer.evidence.list("receipt")).items.find(
    (value) => value.id === app.scenarios.unknown,
  ) as Receipt;
  await (await graphControl(page, "Focus entity")).selectOption(unknown.output.id);
  await inspector
    .getByRole("button", { name: "Calibration applicability cannot be established", exact: true })
    .click();
  await page
    .getByLabel("Graph review rationale", { exact: true })
    .fill("Calibration file must be resolved");
  await expect(page.getByRole("button", { name: "Record assessment", exact: true })).toBeDisabled();
  await page.getByLabel("Graph review action", { exact: true }).selectOption("needs_reevaluation");
  await page.getByRole("button", { name: "Record assessment", exact: true }).click();
  await expect
    .poll(
      async () => (await app.tracer.evidence.compareReceipt(app.scenarios.unknown)).review.state,
    )
    .toBe("needs_reevaluation");
});

test("expansion is explicit; ordinary edges remain references and inspectable", async ({
  app,
  page,
}) => {
  const implementation = (await app.tracer.queryEntities({ key: "FW-03" })).items[0];
  const extra = await app.tracer.createEntity(
    { type: "artifact", key: "EXTRA", fields: { title: "Newly discovered neighbor" } },
    1,
    { actor: "test" },
  );
  const schema = (await app.tracer.getSchema())!;
  await app.tracer.setSchema(
    {
      ...schema,
      relationshipTypes: {
        ...schema.relationshipTypes,
        references: { fields: { note: { type: "string" } } },
      },
    },
    1,
    { actor: "test" },
  );
  await app.tracer.createRelationship(
    {
      type: "references",
      source: implementation.id,
      target: extra.id,
      fields: { note: "Original connection note" },
    },
    2,
    { actor: "test" },
  );
  await page.goto(app.origin);
  await openView(page, "Graph");
  await expect(page.getByTestId("graph-node-FW-03")).toBeVisible();
  await expect(page.getByTestId("graph-node-EXTRA")).toHaveCount(0);
  await page.getByTestId("graph-node-FW-03").click();
  await page.getByRole("button", { name: "Expand selected node", exact: true }).click();
  await expect(page.getByTestId("graph-node-EXTRA")).toBeVisible();
  const edge = page.getByRole("button", {
    name: "Connection: FW-03 → EXTRA (references)",
    exact: true,
  });
  await edge.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Graph inspector", { exact: true })).toContainText(
    "Its name alone does not propagate freshness",
  );
  await page.getByLabel("Graph note", { exact: true }).fill("Edited connection note");
  await page.getByRole("button", { name: "Save connection", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await app.tracer.queryRelationships({ source: implementation.id, target: extra.id }))
          .items[0].fields.note,
    )
    .toBe("Edited connection note");
  expect((await app.tracer.evidence.compareReceipt(app.scenarios.current)).state).toBe("current");
  await page.getByRole("button", { name: "Reset expansions", exact: true }).click();
  await expect(page.getByTestId("graph-node-EXTRA")).toHaveCount(0);
});

test("graph drafts survive refresh/conflicts and selection changes require explicit discard", async ({
  app,
  page,
}) => {
  await page.goto(app.origin);
  await openView(page, "Graph");
  await page.getByTestId("graph-node-REQ-001").click();
  const requirement = (await app.tracer.queryEntities({ key: "REQ-001" })).items[0];
  const field = await editableField(page, "Graph title");
  await field.fill("Unsaved graph draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("graph-node-FW-03").click();
  await expect(field).toHaveValue("Unsaved graph draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await (
    await graphControl(page, "Native revision")
  ).selectOption(String((await app.tracer.timeline()).head));
  await expect(page.getByLabel("Native revision", { exact: true })).toHaveValue("");
  await expect(field).toHaveValue("Unsaved graph draft");
  await expect(page.getByRole("button", { name: "Save node", exact: true })).toBeEnabled();
  await app.tracer.updateEntity(
    requirement.id,
    1,
    { fields: { ...requirement.fields, title: "Concurrent native edit" } },
    1,
    { actor: "other-editor" },
  );
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(page.getByLabel("Graph inspector", { exact: true })).toContainText("current v2");
  await expect(field).toHaveValue("Unsaved graph draft");
  await page.getByRole("button", { name: "Save node", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("conflict:");
  await expect(field).toHaveValue("Unsaved graph draft");
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await editableField(page, "Graph title");
  await expect(field).toHaveValue("Concurrent native edit");
  await field.fill("Reviewed graph edit");
  await page.getByRole("button", { name: "Save node", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.queryEntities({ key: "REQ-001" })).items[0].fields.title)
    .toBe("Reviewed graph edit");
  await expect(page.getByRole("button", { name: "Save node", exact: true })).toBeDisabled();
  await field.fill("Old schema graph draft");
  await app.tracer.setSchema((await app.tracer.getSchema())!, 1, { actor: "schema-editor" });
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(page.getByLabel("Graph inspector", { exact: true })).toContainText("schema v2");
  await page.getByRole("button", { name: "Save node", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("schema_conflict:");
  await expect(field).toHaveValue("Old schema graph draft");
});

test("failed graph refresh retains drafts and pauses editing until a successful refresh", async ({
  app,
  page,
}) => {
  await page.goto(app.origin);
  await openView(page, "Graph");
  await page.getByTestId("graph-node-REQ-001").click();
  const field = await editableField(page, "Graph title");
  await field.fill("Retained during read failure");
  await page.route("**/api/graph?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "busy", message: "Temporary graph read failure" }),
    }),
  );
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "editing is paused" })).toBeVisible();
  await expect(field).toHaveValue("Retained during read failure");
  await expect(page.getByRole("button", { name: "Save node", exact: true })).toBeDisabled();
  await page.unroute("**/api/graph?*");
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save node", exact: true })).toBeEnabled();
  await expect(field).toHaveValue("Retained during read failure");
});

test("review drafts pin compared inputs and require explicit adoption after relevant drift", async ({
  app,
  page,
}) => {
  await page.goto(app.origin);
  await openView(page, "Graph");
  await page.getByTestId("graph-node-EVAL-CHANGED").click();
  const inspector = page.getByLabel("Graph inspector", { exact: true });
  await inspector.getByRole("button", { name: "Original qualification", exact: true }).click();
  const rationale = page.getByLabel("Graph review rationale", { exact: true });
  await rationale.fill("Assessment of the previously compared inputs");
  const requirement = (await app.tracer.queryEntities({ key: "REQ-001" })).items[0];
  await app.tracer.updateEntity(
    requirement.id,
    1,
    { fields: { ...requirement.fields, title: "A materially revised requirement" } },
    1,
    { actor: "other-editor" },
  );
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(inspector).toContainText("Inputs changed while drafting");
  await expect(rationale).toHaveValue("Assessment of the previously compared inputs");
  await expect(page.getByRole("button", { name: "Record assessment", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use refreshed comparison", exact: true }).click();
  await page.getByRole("button", { name: "Record assessment", exact: true }).click();
  await expect
    .poll(
      async () => (await app.tracer.evidence.compareReceipt(app.scenarios.changed)).review.state,
    )
    .toBe("accepted");
});

test("390px graph native controls bound long recorded reasons and unselected inspection is not absence", async ({
  app,
  page,
}) => {
  const entity = (await app.tracer.queryEntities({ key: "REQ-001" })).items[0];
  await app.tracer.updateEntity(
    entity.id,
    entity.version,
    { fields: { ...entity.fields, title: "Native viewport fixture" } },
    1,
    {
      actor: "narrow-browser",
      reason:
        "Long recorded explanation stays in native history rather than widening the browser. ".repeat(
          12,
        ),
    },
  );
  const head = (await app.tracer.timeline()).head;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(app.origin);
  await openView(page, "Model");
  await page.getByRole("button", { name: "Configure model", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await openView(page, "Graph");
  await (await graphControl(page, "Graph entity type")).selectOption(entity.type);
  await (await graphControl(page, "Focus entity")).selectOption(entity.id);
  await expect(page.getByTestId("graph-node-REQ-001")).toBeVisible();
  await (await graphControl(page, "Native revision")).selectOption(String(head));
  await expect(page.locator(".graph-summary")).toContainText("No evidence");
  await page.getByRole("button", { name: "Show inspector", exact: true }).click();
  const inspector = page.getByLabel("Native history inspector", { exact: true });
  await expect(inspector).toContainText("Select a node or native connection");
  await expect(inspector).not.toContainText("selected object is absent");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  for (const control of await page
    .locator(".graph-workspace select, .graph-workspace input, .graph-workspace button")
    .all()) {
    if (!(await control.isVisible())) continue;
    const bounds = await control.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await page.getByRole("button", { name: "Return to current", exact: true }).click();
  await expect(page.getByLabel("Graph inspector", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
