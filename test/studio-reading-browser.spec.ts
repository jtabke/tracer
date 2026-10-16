import { test as base, expect } from "./browser-test.ts";
import type { Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import type { Entity, Schema } from "../src/core/model.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

const actor = { actor: "studio-reading-customer" };
const sourceStatement =
  "After network recovery, preserve original operation identities and reconcile acknowledgment state before reporting completion. " +
  "A queued operation stays visibly pending until the robot confirms delivery, including across restart and repeated reconnect attempts. " +
  "The acceptance boundary is the retained queue and confirmation state, not successful execution of the scheduled operation.";
const sharedStatement =
  "The schedule worker persists queue identity and reconciles acknowledgments for both retention and delivery-state requirements. Its retry path must never create a second identity for the same queued operation.";
const rootStatement =
  "A user can understand and keep a usable cleaning schedule during an interrupted connection.";
const schema: Schema = {
  entityTypes: {
    intent: { fields: { title: { type: "string" }, statement: { type: "string" } } },
    requirement: { fields: { title: { type: "string" }, statement: { type: "string" } } },
    implementation: { fields: { title: { type: "string" }, statement: { type: "string" } } },
  },
  relationshipTypes: {
    contributes_to: { source: ["requirement"], target: ["intent"], fields: {} },
    implemented_by: { source: ["requirement"], target: ["implementation"], fields: {} },
  },
};
type ReadingFixture = { origin: string; tracer: Tracer; root: Entity; source: Entity };
const test = base.extend<{ fixture: ReadingFixture }>({
  fixture: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-studio-reading-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    const create = (type: string, key: string, title: string, statement: string) =>
      tracer.createEntity({ type, key, fields: { title, statement } }, 1, actor);
    const root = await create(
      "intent",
      "NEED-SCHEDULE",
      "Keep schedules understandable",
      rootStatement,
    );
    const source = await create(
      "requirement",
      "REQ-RETENTION",
      "Retain queue identity",
      sourceStatement,
    );
    const sibling = await create(
      "requirement",
      "REQ-DELIVERY",
      "Explain acknowledgment state",
      "Distinguish pending delivery from confirmed acceptance. A displayed schedule is not proof of execution.",
    );
    const implementation = await create(
      "implementation",
      "WORK-SHARED",
      "Shared queue worker",
      sharedStatement,
    );
    for (const member of [source, sibling]) {
      await tracer.createRelationship(
        { type: "contributes_to", source: member.id, target: root.id, fields: {} },
        1,
        actor,
      );
      await tracer.createRelationship(
        { type: "implemented_by", source: member.id, target: implementation.id, fields: {} },
        1,
        actor,
      );
    }
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ origin: server.origin, tracer, root, source });
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function openFamily(page: Page, fixture: ReadingFixture, representation: string) {
  await page.goto(
    `${fixture.origin}/?view=workspace&item=${fixture.root.id}&family=contributes_to&direction=incoming`,
  );
  await page
    .getByRole("group", { name: "Workspace representation", exact: true })
    .getByRole("button", { name: representation, exact: true })
    .click();
  if (representation === "Table") {
    const columns = page.locator(".workspace-trace-columns");
    const implementation = columns.getByRole("checkbox", {
      name: "→ implemented by · implementation",
      exact: true,
    });
    if (!(await implementation.isVisible())) await columns.locator("summary").click();
    await implementation.check();
  }
}
function memberControl(page: Page, representation: string) {
  return representation === "Reading"
    ? page
        .getByLabel("Continuous reading", { exact: true })
        .getByRole("button", { name: "Inspect and edit REQ-RETENTION", exact: true })
    : page
        .locator(".workspace-surface")
        .getByRole("button", { name: "REQ-RETENTION · v1", exact: true });
}

test("desktop Table and Reading carry the full member once while contextual actions remain available", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const representation of ["Table", "Reading"]) {
    await openFamily(page, fixture, representation);
    await memberControl(page, representation).click();
    const surface = page.locator(".workspace-surface");
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(surface.getByText(sourceStatement, { exact: true })).toBeVisible();
    await expect(inspector.getByText(sourceStatement, { exact: true })).toHaveCount(0);
    await expect(
      inspector.getByRole("button", { name: "Edit statement", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/tracer-studio-reading-${representation.toLowerCase()}-initial-desktop.png`,
      fullPage: true,
    });
    await inspector.getByRole("button", { name: "Edit statement", exact: true }).click();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
      sourceStatement,
    );
    await expect(surface).toBeHidden();
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await expect(surface).toBeVisible();
    await page.screenshot({
      path: `/tmp/tracer-studio-reading-${representation.toLowerCase()}-desktop.png`,
      fullPage: true,
    });
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toBeHidden();
  }
});

test("scope root and shared off-surface implementation retain complete reading", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFamily(page, fixture, "Table");
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  await expect(inspector.getByText(rootStatement, { exact: true })).toBeVisible();
  await page
    .getByRole("group", { name: "Workspace representation", exact: true })
    .getByRole("button", { name: "Relationships", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect WORK-SHARED", exact: true }).click();
  await page
    .getByRole("group", { name: "Workspace representation", exact: true })
    .getByRole("button", { name: "Table", exact: true })
    .click();
  await expect(inspector.getByText(sharedStatement, { exact: true })).toBeVisible();
  await expect(inspector.getByRole("heading", { name: "WORK-SHARED", exact: true })).toBeVisible();
  await expect(
    page
      .locator(".workspace-surface")
      .getByText(sharedStatement, { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "/tmp/tracer-studio-reading-shared-desktop.png", fullPage: true });
});

for (const representation of ["Table", "Reading"]) {
  test(`narrow ${representation} reading returns to the retained scope and preserves explicit edit through failed reads`, async ({
    page,
    fixture,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFamily(page, fixture, representation);
    const control = memberControl(page, representation);
    await control.scrollIntoViewIfNeeded();
    const scopeScroll = await page.evaluate(() => window.scrollY);
    await control.click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(
      inspector.getByRole("heading", { name: "REQ-RETENTION", exact: true }),
    ).toBeVisible();
    await expect(inspector.getByText(sourceStatement, { exact: true })).toBeVisible();
    const returnToScope = page.locator(".workspace-detail-region").getByRole("button", {
      name: "Return to NEED-SCHEDULE scope",
      exact: true,
    });
    await expect(returnToScope).toBeVisible();
    const headingBox = await inspector
      .getByRole("heading", { name: "REQ-RETENTION", exact: true })
      .boundingBox();
    expect(headingBox!.y).toBeLessThan(600);
    await page.screenshot({
      path: `/tmp/tracer-studio-reading-${representation.toLowerCase()}-narrow.png`,
      fullPage: true,
    });
    await returnToScope.click();
    await expect(
      page
        .getByRole("group", { name: "Workspace representation", exact: true })
        .getByRole("button", { name: representation, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
    await expect(page.locator(".workspace-surface")).toContainText("REQ-DELIVERY");
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scopeScroll))
      .toBeLessThanOrEqual(3);
    await control.click();
    await inspector.getByRole("button", { name: "Edit statement", exact: true }).click();
    const statement = inspector.getByLabel("Workspace statement", { exact: true });
    const draft = "Draft clarification: keep identity stable; acknowledge delivery separately.";
    await statement.fill(draft);
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await control.click();
    await expect(statement).toBeVisible();
    await expect(statement).toHaveValue(draft);
    const changedCurrent = "New current requirement: reconcile identity through a 72-hour outage.";
    await fixture.tracer.updateEntity(
      fixture.source.id,
      1,
      {
        fields: { ...fixture.source.fields, statement: changedCurrent },
      },
      1,
      actor,
    );
    await page.route("**/api/family?**", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(statement).toBeDisabled();
    await expect(statement).toHaveValue(draft);
    await page.unroute("**/api/family?**");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(statement).toBeEnabled();
    await expect(statement).toHaveValue(draft);
    await expect(inspector).toContainText("Draft based on v1 / schema v1; current v2 / schema v1");
    expect(
      (await fixture.tracer.queryEntities({ key: fixture.source.key })).items[0],
    ).toMatchObject({
      version: 2,
      fields: { statement: changedCurrent },
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

test("recorded connections navigate a shared implementation and each parent without replacing the working scope", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFamily(page, fixture, "Table");
  await memberControl(page, "Table").click();
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  const connections = inspector.getByRole("region", { name: "Recorded connections", exact: true });
  await connections
    .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
    .click();
  await expect(inspector.getByRole("heading", { name: "WORK-SHARED", exact: true })).toBeVisible();
  await expect(inspector.getByText(sharedStatement, { exact: true })).toBeVisible();
  await expect(
    connections.getByRole("button", {
      name: "Inspect REQ-RETENTION via implemented by",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    connections.getByRole("button", {
      name: "Inspect REQ-DELIVERY via implemented by",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(connections).not.toContainText("Extent not recorded");
  for (const key of ["REQ-DELIVERY", "REQ-RETENTION"]) {
    await connections
      .getByRole("button", { name: `Inspect ${key} via implemented by`, exact: true })
      .click();
    await expect(inspector.getByRole("heading", { name: key, exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
    await expect(
      page
        .getByRole("group", { name: "Workspace representation", exact: true })
        .getByRole("button", { name: "Table", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".workspace-surface")).toContainText("REQ-RETENTION");
    await expect(page.locator(".workspace-surface")).toContainText("REQ-DELIVERY");
    await connections
      .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
      .click();
    await expect(
      inspector.getByRole("heading", { name: "WORK-SHARED", exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({ path: "/tmp/tracer-recorded-shared-desktop.png", fullPage: true });
});

test("canceling recorded-endpoint navigation preserves the selected item and its captured unsaved draft", async ({
  page,
  fixture,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await openFamily(page, fixture, "Reading");
    await memberControl(page, "Reading").click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await inspector.getByRole("button", { name: "Edit statement", exact: true }).click();
    const statement = inspector.getByLabel("Workspace statement", { exact: true });
    const draft = `Retained ${width}px draft: preserve the captured operation identity.`;
    await statement.fill(draft);
    if (width === 1440)
      await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    let guard = "";
    page.once("dialog", async (dialog) => {
      guard = dialog.message();
      await dialog.dismiss();
    });
    await inspector
      .getByRole("region", { name: "Recorded connections", exact: true })
      .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
      .click();
    expect(guard).toContain("Discard the unsaved inspector draft");
    await expect(
      inspector.getByRole("heading", { name: "REQ-RETENTION", exact: true }),
    ).toBeVisible();
    if (width === 1440)
      await inspector.getByRole("button", { name: "Resume editing", exact: true }).click();
    await expect(statement).toBeVisible();
    await expect(statement).toHaveValue(draft);
    expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
    expect((await fixture.tracer.queryEntities({ key: "REQ-RETENTION" })).items[0]).toMatchObject({
      version: 1,
      fields: { statement: sourceStatement },
    });
    await inspector.getByRole("button", { name: "Discard draft", exact: true }).click();
  }
});

test("an off-family recorded endpoint requires its own ready native read and retains drafts during failed refresh", async ({
  page,
  fixture,
}) => {
  const shared = (await fixture.tracer.queryEntities({ key: "WORK-SHARED" })).items[0];
  const external = await fixture.tracer.createEntity(
    {
      type: "requirement",
      key: "REQ-EXTERNAL",
      fields: {
        title: "Independent consumer",
        statement: "Another product consumes the same queue worker.",
      },
    },
    1,
    actor,
  );
  await fixture.tracer.createRelationship(
    { type: "implemented_by", source: external.id, target: shared.id, fields: {} },
    1,
    actor,
  );
  const family = await fixture.tracer.getFamily({
    rootId: fixture.root.id,
    relationshipType: "contributes_to",
    direction: "incoming",
  });
  expect(family.nodes.some((entity) => entity.id === external.id)).toBe(false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFamily(page, fixture, "Reading");
  await memberControl(page, "Reading").click();
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  const connections = inspector.getByRole("region", { name: "Recorded connections", exact: true });
  await connections
    .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
    .click();
  await expect(inspector.getByRole("heading", { name: "WORK-SHARED", exact: true })).toBeVisible();
  await page.route("**/api/connections?**", (route) => {
    const url = new URL(route.request().url());
    return url.searchParams.get("id") === external.id && url.searchParams.get("limit") === "1"
      ? route.abort()
      : route.continue();
  });
  await connections
    .getByRole("button", { name: "Inspect REQ-EXTERNAL via implemented by", exact: true })
    .click();
  await expect(inspector.getByRole("heading", { name: "REQ-EXTERNAL", exact: true })).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "Edit statement", exact: true }),
  ).toBeDisabled();
  await expect(inspector).toContainText("writes are paused");
  await page.unroute("**/api/connections?**");
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(
    inspector.getByRole("button", { name: "Edit statement", exact: true }),
  ).toBeEnabled();
  await inspector.getByRole("button", { name: "Create in context", exact: true }).click();
  const creation = page.getByRole("region", { name: "Create item", exact: true });
  await expect(creation).toContainText("In context of REQ-EXTERNAL");
  await expect(creation).toContainText(String(external.fields.statement));
  await expect(creation.getByLabel("New item key", { exact: true })).toBeEnabled();
  await creation.getByLabel("New item key", { exact: true }).fill("UNSAVED-EXTERNAL-CONTEXT");
  await creation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(inspector.getByRole("heading", { name: "REQ-EXTERNAL", exact: true })).toBeVisible();
  expect((await fixture.tracer.queryEntities({ key: "UNSAVED-EXTERNAL-CONTEXT" })).items).toEqual(
    [],
  );
  await inspector.getByRole("button", { name: "Edit statement", exact: true }).click();
  const statement = inspector.getByLabel("Workspace statement", { exact: true });
  await statement.fill("Retained off-family captured draft.");
  await page.route("**/api/connections?**", (route) => {
    const url = new URL(route.request().url());
    return url.searchParams.get("id") === external.id && url.searchParams.get("limit") === "1"
      ? route.abort()
      : route.continue();
  });
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(statement).toBeDisabled();
  await expect(statement).toHaveValue("Retained off-family captured draft.");
  expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
  expect((await fixture.tracer.queryEntities({ key: external.key })).items[0]).toMatchObject({
    version: 1,
    fields: external.fields,
  });
});

test("a newer authoritative endpoint statement stays visible when the retained family row has an older version", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFamily(page, fixture, "Reading");
  await memberControl(page, "Reading").click();
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  const connections = inspector.getByRole("region", { name: "Recorded connections", exact: true });
  await connections
    .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
    .click();
  await expect(
    connections.getByRole("button", {
      name: "Inspect REQ-RETENTION via implemented by",
      exact: true,
    }),
  ).toBeEnabled();
  const newer =
    "Current v2 requires queue identity to survive the complete storage replacement procedure.";
  await fixture.tracer.updateEntity(
    fixture.source.id,
    1,
    { fields: { ...fixture.source.fields, statement: newer } },
    1,
    actor,
  );
  await connections
    .getByRole("button", { name: "Inspect REQ-RETENTION via implemented by", exact: true })
    .click();
  await expect(inspector).toContainText("requirement · loaded v2");
  await expect(inspector.getByText(newer, { exact: true })).toBeVisible();
  await expect(
    page.locator(".workspace-surface").getByText(sourceStatement, { exact: true }),
  ).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Read full item", exact: true })).toHaveCount(
    0,
  );
  expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
});

test("narrow relationship exploration reveals its new scope and returns to the retained source scope", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFamily(page, fixture, "Reading");
  await memberControl(page, "Reading").click();
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  await inspector
    .getByRole("region", { name: "Recorded connections", exact: true })
    .getByRole("button", { name: "Inspect WORK-SHARED via implemented by", exact: true })
    .click();
  await expect(
    inspector.getByRole("button", { name: "Show relationships for WORK-SHARED", exact: true }),
  ).toBeEnabled();
  await inspector
    .getByRole("button", { name: "Show relationships for WORK-SHARED", exact: true })
    .click();
  const surface = page.locator(".workspace-surface");
  await expect(surface).toBeVisible();
  await expect(
    surface.getByRole("heading", { name: "WORK-SHARED context", exact: true }),
  ).toBeVisible();
  await expect(
    surface.getByRole("heading", { name: "WORK-SHARED context", exact: true }),
  ).toContainText("Shared queue worker");
  expect(new URL(page.url()).searchParams.get("item")).not.toBe(fixture.root.id);
  await surface
    .getByRole("button", { name: "Return to relationships for NEED-SCHEDULE", exact: true })
    .click();
  await expect(surface).toBeVisible();
  expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
  await expect(
    page
      .getByRole("group", { name: "Workspace representation", exact: true })
      .getByRole("button", { name: "Reading", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(surface).toContainText("REQ-DELIVERY");
});

test("narrow scope exposes its first statement, preserves exact directed membership and reveals the active representation", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFamily(page, fixture, "Table");
  await page.evaluate(() => window.scrollTo(0, 0));
  const scope = page.getByLabel("Family scope", { exact: true });
  await expect(scope).toHaveValue("incoming:contributes_to");
  const first = page
    .locator(".workspace-surface")
    .getByRole("button", { name: "REQ-DELIVERY · v1", exact: true });
  const firstBox = await first.boundingBox();
  await page.screenshot({ path: "/tmp/tracer-studio-scope-compact-narrow.png", fullPage: true });
  expect(firstBox!.y + firstBox!.height).toBeLessThan(844);
  const statementBox = await page
    .locator(".workspace-surface")
    .getByText(
      "Distinguish pending delivery from confirmed acceptance. A displayed schedule is not proof of execution.",
      { exact: true },
    )
    .boundingBox();
  expect(statementBox!.y).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await scope.selectOption("outgoing:contributes_to");
  await expect(page.locator(".workspace-surface")).toContainText("No family members in this scope");
  expect(new URL(page.url()).searchParams.get("direction")).toBe("outgoing");
  expect(new URL(page.url()).searchParams.get("family")).toBe("contributes_to");
  await scope.selectOption("incoming:contributes_to");
  await expect(first).toBeVisible();
  const representations = page.getByRole("group", {
    name: "Workspace representation",
    exact: true,
  });
  const reading = representations.getByRole("button", { name: "Reading", exact: true });
  await reading.click();
  await page.setViewportSize({ width: 360, height: 844 });
  await expect(reading).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const bounds = await representations.boundingBox(),
        selected = await reading.boundingBox();
      return (
        selected!.x >= bounds!.x - 1 &&
        selected!.x + selected!.width <= bounds!.x + bounds!.width + 1
      );
    })
    .toBe(true);
  await expect(page.getByLabel("Continuous reading", { exact: true })).toContainText(
    sourceStatement,
  );
});
