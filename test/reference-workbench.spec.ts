import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import {
  switchFamilyView,
  chooseRelatedGroup,
  openView,
  showProjectBrowser,
  editableField,
} from "./browser-navigation.ts";

for (const domain of ["software", "engineering"] as const)
  test(`${domain}: reference workbench preserves scope through local editing, contextual mapping and reload`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-reference-workbench-"));
    const fixture = await seedWorkspace(join(directory, "project"), domain);
    const repository = new SQLiteRepository(fixture.database),
      tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(server.origin);
      await openView(page, "Workspace");
      await expect(page.getByRole("tab", { name: "Work", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByRole("tab", { name: "Graph query", exact: true })).toBeVisible();
      await page.locator(".workspace-items button").filter({ hasText: "INT-01" }).click();
      await expect(page.getByLabel("Project browser", { exact: true })).toBeHidden();
      await chooseRelatedGroup(page, "← contributes to · requirement");
      const members = page.locator(".workspace-lane");
      await expect(members).toHaveCount(domain === "software" ? 4 : 2);
      await page.getByRole("button", { name: "REQ-02 · v1", exact: true }).click();
      const inspector = page.getByLabel("Workspace inspector", { exact: true });
      await inspector.getByRole("button", { name: "Edit statement", exact: true }).click();
      await expect(inspector.getByLabel("Workspace notes", { exact: true })).toHaveCount(0);
      const statement = inspector.getByLabel("Workspace statement", { exact: true });
      const prose = "Retain this obligation while comparing its sibling contributions.";
      await statement.fill(prose);
      await switchFamilyView(page, "Reading");
      await expect(page.getByLabel("Continuous reading")).toContainText("REQ-01");
      await page.getByRole("button", { name: /Hide details/ }).click();
      await page.getByRole("button", { name: /Show details/ }).click();
      await expect(statement).toHaveValue(prose);
      await editableField(page, "Workspace statement");
      await inspector.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(async () => (await tracer.queryEntities({ key: "REQ-02" })).items[0].fields.statement)
        .toBe(prose);
      await switchFamilyView(page, "Coverage");
      const row = page.locator(".workspace-coverage tbody tr").filter({ hasText: "REQ-02" });
      const slot = row.getByRole("button", {
        name: "Connect REQ-02 · outgoing mapped to · test",
        exact: true,
      });
      await slot.click();
      const picker = page.getByRole("dialog", { name: "Record connection", exact: true });
      await expect(picker.locator(".workspace-captured-statement").first()).toHaveText(prose);
      await expect(picker.getByLabel("Mapping relationship")).toHaveValue("mapped_to");
      await expect(picker.getByLabel("Mapping target type")).toHaveValue("test");
      await expect(picker.getByLabel("Find mapping candidate")).toBeFocused();
      await expect(picker.getByLabel("Mapping relationship")).toBeHidden();
      await page.keyboard.press("Shift+Tab");
      await expect(
        picker.locator("summary").filter({ hasText: "Change target type" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(picker.getByLabel("Find mapping candidate")).toBeFocused();
      await picker.getByLabel("Find mapping candidate").fill("TEST-1");
      await picker.getByRole("button", { name: "Choose TEST-1", exact: true }).click();
      await expect(
        picker.getByText("Candidate’s recorded connections", { exact: true }),
      ).toBeVisible();
      await picker
        .getByLabel("Draft scope")
        .fill("Recorded test mapping; execution remains unknown");
      await picker.getByLabel("Draft source_version").fill("2");
      await picker.getByLabel("Draft review").fill("unreviewed");
      await picker.getByRole("button", { name: "Record connection", exact: true }).click();
      await expect(picker).toHaveCount(0);
      await expect(slot).toBeFocused();
      await expect(row).toContainText("Recorded test mapping; execution remains unknown");
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 2560, height: 1440 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
          viewport.width,
        );
        await page.screenshot({
          path: `/tmp/tracer-reference-improvements/${domain}-coverage-${viewport.width}.png`,
        });
      }
      await page.reload();
      await switchFamilyView(page, "Coverage");
      await expect(page.locator(".workspace-coverage")).toContainText(prose);
      await expect(page.locator(".workspace-coverage")).toContainText(
        "Recorded test mapping; execution remains unknown",
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await openView(page, "Graph");
      const canvas = page.getByLabel("Graph canvas", { exact: true });
      await expect(canvas).toBeVisible();
      // Query and native-history controls remain visible; the canvas still begins
      // within the first half of the 900px desktop viewport.
      await expect.poll(async () => (await canvas.boundingBox())!.y).toBeLessThanOrEqual(400);
      await page.getByTestId("graph-node-REQ-02").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Selected node actions")).toBeVisible();
      await page.screenshot({ path: `/tmp/tracer-reference-improvements/${domain}-graph.png` });
      await openView(page, "Table");
      await expect(page.locator(".chain-grid th").nth(1)).toContainText("← contributes to");
      await expect(page.locator(".chain-grid")).toContainText(prose);
      await page.screenshot({ path: `/tmp/tracer-reference-improvements/${domain}-chain.png` });
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page, true);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("incoming connection picking stores the declared direction and rejects changed captured endpoints", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-reference-incoming-"));
  const fixture = await seedWorkspace(join(directory, "project"), "engineering");
  const repository = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repository);
  const spare = await tracer.createEntity(
    {
      type: "requirement",
      key: "REQ-SPARE",
      fields: { title: "A spare obligation", statement: "Compare this exact captured statement." },
    },
    1,
    { actor: "test" },
  );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await page.locator(".workspace-items button").filter({ hasText: "INT-01" }).click();
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Record connection", exact: true });
    await expect(picker.getByLabel("Mapping direction")).toHaveValue("incoming");
    await picker.getByLabel("Find mapping candidate").fill("REQ-SPARE");
    await picker.getByRole("button", { name: "Choose REQ-SPARE", exact: true }).click();
    await expect(picker.getByLabel("Connection direction")).toHaveText(
      "REQ-SPARE · captured v1 → contributes to → INT-01 · captured v1",
    );
    await tracer.updateEntity(
      spare.id,
      1,
      { fields: { ...spare.fields, statement: "Changed after capture" } },
      1,
      { actor: "test" },
    );
    await picker.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(picker.getByRole("alert")).toContainText("conflict");
    await expect(picker.locator(".workspace-captured-statement").last()).toHaveText(
      "Compare this exact captured statement.",
    );
    expect((await tracer.queryRelationships({ source: spare.id })).items).toHaveLength(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    await picker.getByLabel("Find mapping candidate").fill("REQ-SPARE");
    await picker.getByRole("button", { name: "Choose REQ-SPARE", exact: true }).click();
    await picker.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(picker).toHaveCount(0);
    const recorded = (await tracer.queryRelationships({ source: spare.id })).items;
    expect(recorded).toHaveLength(1);
    expect(recorded[0].target).toBe(fixture.intents[0].id);
    await showProjectBrowser(page);
    await expect(page.getByLabel("Project browser", { exact: true })).toBeVisible();
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
