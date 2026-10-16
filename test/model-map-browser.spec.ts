import { openView } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

const screenshots = "/tmp/tracer-constellation-20261013";

test("A map selects real declarations, opens recorded endpoints, edits and persists a requirement", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-constellation-"));
  const fixture = await seedWorkspace(join(dir, "engineering"), "engineering");
  const repo = new SQLiteRepository(fixture.database);
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(screenshots, { recursive: true });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.origin);
    await openView(page, "Model");
    await expect(page.locator(".model-flow-types > li")).toHaveCount(4);
    await expect(page.locator(".model-map-scope")).toContainText("4 authored workflow paths");
    const requirement = page.getByLabel("Focus type", { exact: true });
    await expect(requirement).toHaveValue("");
    await requirement.selectOption("requirement");
    await page.screenshot({ path: join(screenshots, "overview-1440.png"), fullPage: true });
    const connection = page.getByLabel("Workflow connection", { exact: true });
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await connection.focus();
    await connection.selectOption("mapped_to");
    const selection = page.getByLabel("Selected model definition", { exact: true });
    await expect(selection).toContainText("design, test");
    await selection
      .getByRole("button", { name: "View recorded connections · mapped_to", exact: true })
      .click();
    const records = page.getByRole("region", { name: "Recorded connections", exact: true });
    await expect(records).toContainText("REQ-01");
    await records
      .getByRole("button", { name: `Inspect source ${fixture.requirements[0].id}`, exact: true })
      .click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(inspector).toContainText("REQ-01");
    await inspector.getByText("Edit item", { exact: true }).click();
    await inspector
      .getByLabel("Workspace statement", { exact: true })
      .fill("Edited through the connected model map.");
    await inspector.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await openView(page, "Model");
    await records.getByRole("button", { name: "Back to model", exact: true }).click();
    await expect(
      selection.getByRole("button", { name: "View recorded connections · mapped_to", exact: true }),
    ).toBeFocused();
    await selection
      .getByRole("button", { name: /Return to requirement connection permissions/ })
      .click();
    await requirement.selectOption("requirement");
    await page.getByRole("button", { name: "Browse items · requirement", exact: true }).click();
    await expect(page.getByLabel("Workspace type", { exact: true })).toHaveValue("requirement");
    await page.reload();
    await openView(page, "Model");
    const items = await tracer.queryEntities({ type: "requirement" });
    expect(items.items.find((item) => item.key === "REQ-01")?.fields.statement).toBe(
      "Edited through the connected model map.",
    );
    await page.setViewportSize({ width: 2560, height: 1440 });
    await expect(requirement).toBeVisible();
    await page.screenshot({ path: join(screenshots, "overview-2560.png"), fullPage: true });
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await connection.selectOption("mapped_to");
    await page.screenshot({ path: join(screenshots, "connection-focus-2560.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(selection.getByRole("heading", { name: "mapped to", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: join(screenshots, "connection-focus-390.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("visual input/output linking saves a real model rule and preserves a conflicting proposal", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-model-flow-"));
  const fixture = await seedWorkspace(join(dir, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database);
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const provenance = { actor: "workflow-browser" };
  try {
    await page.goto(`${server.origin}/?view=model`);
    await expect(page.getByLabel("Development workflow diagram", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Link types", exact: true }).click();
    const input = page.getByRole("button", { name: "Select type · requirement", exact: true });
    await input.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".model-link-prompt")).toContainText("Source: requirement");
    const output = page.getByRole("button", { name: "Select type · design", exact: true });
    await output.focus();
    await page.keyboard.press("Enter");
    const form = page.getByRole("form", { name: "Link model types", exact: true });
    const name = form.getByLabel("Connection name", { exact: true });
    await expect(name).toBeFocused();
    await name.fill("mapped_to");
    await form.getByRole("button", { name: "Save connection", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("unique connection name");
    await name.fill("feeds_design");
    await form.getByRole("button", { name: "Save connection", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect.poll(async () => (await tracer.getSchema())?.version).toBe(2);
    expect((await tracer.getSchema())?.relationshipTypes.feeds_design).toEqual({
      source: ["requirement"],
      target: ["design"],
      fields: {},
      workflow: [
        { source: "requirement", target: "design", direction: "forward", label: "feeds design" },
      ],
    });
    await page.reload();
    await page.getByRole("button", { name: "Connection permissions", exact: true }).click();
    await page.getByLabel("Workflow connection", { exact: true }).selectOption("feeds_design");
    await expect(page.getByLabel("Selected model definition", { exact: true })).toContainText(
      "requirement",
    );
    await page.getByRole("button", { name: /Return to connection permissions/ }).click();
    await page.getByRole("button", { name: "Link types", exact: true }).click();
    await input.click();
    await page.getByRole("button", { name: "Select type · test", exact: true }).click();
    await name.fill("feeds_test");
    const schema = (await tracer.getSchema())!;
    await tracer.setSchema(
      { entityTypes: schema.entityTypes, relationshipTypes: schema.relationshipTypes },
      2,
      provenance,
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(form).toContainText("schema v2");
    await form.getByRole("button", { name: "Save connection", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("conflict");
    await expect(name).toHaveValue("feeds_test");
    await openView(page, "Project");
    await openView(page, "Model");
    await expect(name).toHaveValue("feeds_test");
    expect((await tracer.getSchema())?.relationshipTypes.feeds_test).toBeUndefined();
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Select type · test", exact: true }),
    ).toBeFocused();
    expect((await tracer.getSchema())?.version).toBe(3);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
