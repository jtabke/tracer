import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { readDemoGuide } from "../src/interfaces/demo-guide.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import {
  editableField,
  openView,
  openExampleTask,
  chooseRelatedGroup,
} from "./browser-navigation.ts";

const scenarios = [
  {
    domain: "integrated",
    task: "Shared design across engineering constraints",
    shared: "DES-01",
    count: 5,
    related: "EVAL-R02",
    run: "EVAL-R02",
    input: "DES-01",
    freshness: "changed",
    outcome: "SIMULATED within old allocation",
    family: "REQ-R03",
  },
  {
    domain: "medical",
    task: "Shared release path and failure",
    shared: "CMP-05",
    count: 3,
    related: "VER-06",
    run: "RUN-06",
    input: "PRS-08",
    freshness: "current",
    outcome: "SIMULATED fail",
    family: "SYS-08",
  },
  {
    domain: "technology",
    task: "Shared implementation across sibling features",
    shared: "WORK-03",
    count: 4,
    related: "TEST-02",
    run: "RUN-TECH-02",
    input: "STORY-03",
    freshness: "changed",
    outcome: "SIMULATED",
    family: "STORY-03",
  },
] as const;

for (const scenario of scenarios)
  test(`${scenario.domain}: aligned siblings retain family while inspecting shared records and captured evidence`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-family-trace-"));
    const fixture = await seedRealisticProject(join(directory, "project"), scenario.domain);
    const repository = new SQLiteRepository(fixture.database);
    const guide = await readDemoGuide(join(fixture.directory, "tasks.json"));
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0, guide);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(server.origin);
      await openView(page, "Workspace");
      await openExampleTask(page, scenario.task);
      const table = page.getByRole("region", { name: "Family trace", exact: true });
      await expect(table.getByRole("columnheader")).toHaveCount(3);
      await expect(table.locator("tbody > tr")).toHaveCount(scenario.count);
      await expect(table).toContainText(scenario.family);
      const source = table.locator("tbody > tr").filter({ hasText: scenario.family });
      await expect(source).toContainText(
        fixture.entities[scenario.family].fields.statement as string,
      );
      if (scenario.domain !== "medical")
        await expect(table).toContainText(`Shared by ${scenario.count} loaded family items`);
      await table
        .getByRole("button", { name: `Inspect ${scenario.related}`, exact: true })
        .first()
        .click();
      await expect(page.locator(".workspace-surface h2")).toContainText(scenario.shared);
      await expect(page.locator(".workspace-inspector > h2")).toHaveText(scenario.related);
      const screenshots = join(tmpdir(), "tracer-family-trace-pixels");
      mkdirSync(screenshots, { recursive: true });
      await page.screenshot({
        path: join(screenshots, `${scenario.domain}-family.png`),
        fullPage: true,
      });
      if (scenario.run !== scenario.related) {
        await page
          .getByRole("button", { name: `Show relationships for ${scenario.related}`, exact: true })
          .click();
        const relation = scenario.domain === "medical" ? "executed as" : "exercised as";
        await chooseRelatedGroup(page, `→ ${relation} · test_run`);
        await page
          .locator(".workspace-surface")
          .getByRole("button", { name: `${scenario.run} · v1`, exact: true })
          .click();
      }
      const originHeading = await page.locator(".workspace-surface h2").innerText();
      const originRoot = scenario.run === scenario.related ? scenario.shared : scenario.related;
      const recordedEvaluations = page.getByRole("region", {
        name: "Recorded evaluations",
        exact: true,
      });
      await expect(recordedEvaluations).toBeVisible();
      await recordedEvaluations
        .getByRole("button", { name: /Inspect evaluation:/ })
        .first()
        .click();
      const evidence = page.getByRole("region", { name: "Captured result review", exact: true });
      const receiptPage = await tracer.evidence.list("receipt", {
        subject: fixture.entities[scenario.run].id,
      });
      const receipt = await tracer.evidence.getReceipt(receiptPage.items[0].id);
      const comparison = await tracer.evidence.compareReceipt(receipt.id);
      expect(comparison.state).toBe(scenario.freshness);
      await expect(
        evidence.getByRole("heading", {
          name: `Freshness: ${scenario.freshness} · Review: ${comparison.review.state}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(evidence.getByLabel("Recorded result", { exact: true })).toContainText(
        receipt.outcome,
      );
      await expect(evidence.getByLabel("Recorded result", { exact: true })).toContainText(
        scenario.outcome,
      );
      await expect(
        evidence.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
      ).toHaveCount(receipt.inputs.length);
      await evidence
        .getByRole("button", { name: `Compare input ${scenario.input}`, exact: true })
        .click();
      const input = evidence.getByLabel("Selected input comparison", { exact: true });
      await expect(
        input.getByRole("heading", {
          name: `${scenario.input}: ${scenario.freshness}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(input.getByText("Captured v1", { exact: true })).toBeVisible();
      await expect(
        input.getByText(scenario.freshness === "changed" ? "Current v2" : "Current v1", {
          exact: true,
        }),
      ).toBeVisible();
      const comparedInput = comparison.inputs.find(
        (value) => value.entityId === fixture.entities[scenario.input].id,
      )!;
      expect(comparedInput.recorded.entity.version).toBe(1);
      expect(comparedInput.current.entity?.version).toBe(scenario.freshness === "changed" ? 2 : 1);
      await expect(input).toContainText(comparedInput.recorded.entity.fields.statement as string);
      await expect(input).toContainText(comparedInput.current.entity!.fields.statement as string);
      await page.screenshot({
        path: join(screenshots, `${scenario.domain}-evidence.png`),
        fullPage: true,
      });
      await evidence
        .getByRole("button", { name: `Return to ${originRoot} scope`, exact: true })
        .click();
      await expect(evidence).toBeHidden();
      await expect(page.locator(".workspace-surface h2")).toHaveText(originHeading, {
        useInnerText: true,
      });
      await expect(page.locator(".workspace-inspector > h2")).toHaveText(scenario.run);
      if (scenario.run !== scenario.related) {
        await page
          .getByRole("button", {
            name: `Return to relationships for ${scenario.shared}`,
            exact: true,
          })
          .click();
        await expect(page.getByRole("region", { name: "Family trace", exact: true })).toBeVisible();
      }
      await expect(table).toBeVisible();
      await expect(table.locator("tbody > tr")).toHaveCount(scenario.count);
      await expect(table).toContainText(scenario.family);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
      await page.screenshot({ path: join(screenshots, `${scenario.domain}-narrow.png`) });
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page, true);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("ordinary project saves family and chain views across reopen, preserves cancelled drafts and recovers a stale view proposal", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-saved-view-browser-"));
  const fixture = await seedRealisticProject(join(directory, "project"), "integrated");
  let repository = new SQLiteRepository(fixture.database);
  let tracer = new Tracer(repository);
  let server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0); // ordinary project: no guide
  try {
    const task = fixture.tasks.find((task) => task.root === "DES-01")!;
    await page.goto(server.origin + task.url);
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await page.getByRole("checkbox", { name: "→ realized by · design", exact: true }).check();
    await page.getByRole("checkbox", { name: "→ evaluated by · evaluation", exact: true }).check();
    const family = page.locator(".workspace-view-library .saved-view-panel");
    await family.getByRole("button", { name: "Save view…", exact: true }).click();
    await family.getByLabel("Saved view name").fill("Suction responsibilities");
    await family.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect(family.getByLabel("Saved view", { exact: true })).toContainText(
      "Suction responsibilities",
    );
    await openView(page, "Table");
    const chain = page.locator("[aria-label='Relationship chain table'] .saved-view-panel");
    await chain.getByRole("button", { name: "Save view…", exact: true }).click();
    await chain.getByLabel("Saved view name").fill("Product trace");
    await chain.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect(chain.getByLabel("Saved view", { exact: true })).toContainText("Product trace");
    await closeTestPage(page);
    await server.close();
    repository.close();
    repository = new SQLiteRepository(fixture.database);
    tracer = new Tracer(repository);
    server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    await page.goto(server.origin);
    await openView(page, "Workspace"); // no item URL: library must be reachable from project overview
    await family
      .getByLabel("Saved view", { exact: true })
      .selectOption({ label: "Suction responsibilities" });
    await family.getByRole("button", { name: "Open saved view", exact: true }).click();
    await family.getByRole("button", { name: "Save view…", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Family trace", exact: true }).getByRole("columnheader"),
    ).toHaveCount(3);
    await expect(page.locator(".workspace-surface h2")).toContainText("DES-01");
    await editableField(page, "Workspace statement");
    const draft = page.getByLabel("Workspace statement", { exact: true });
    await draft.fill("Keep this engineering draft");
    await page
      .getByLabel("Workspace inspector", { exact: true })
      .getByRole("button", { name: "Return to scope", exact: true })
      .click();
    await expect(draft).toHaveValue("Keep this engineering draft");
    const another = await tracer.savedViews.save({
      name: "Another scope",
      definition: {
        kind: "family",
        rootId: fixture.entities["ROBOT-01"].id,
        relationshipType: "breaks_down_into",
        direction: "outgoing",
        layout: "reading",
        columns: [],
      },
      expectedVersion: 0,
      expectedSchemaVersion: 1,
    });
    await family.getByRole("button", { name: "Refresh saved views", exact: true }).click();
    await family.getByLabel("Saved view", { exact: true }).selectOption(another.id);
    const cancelled = page.waitForEvent("dialog").then((dialog) => dialog.dismiss());
    await family.getByRole("button", { name: "Open saved view", exact: true }).click();
    await cancelled;
    await expect(draft).toHaveValue("Keep this engineering draft");
    await expect(page.locator(".workspace-surface h2")).toContainText("DES-01");
    await family
      .getByLabel("Saved view", { exact: true })
      .selectOption({ label: "Suction responsibilities" });
    const saved = (await tracer.savedViews.list()).find(
      (view) => view.name === "Suction responsibilities",
    )!;
    await tracer.savedViews.save({
      id: saved.id,
      name: saved.name,
      definition: saved.definition,
      expectedVersion: saved.version,
      expectedSchemaVersion: 1,
    });
    await family.getByLabel("Saved view name").fill("Suction review view");
    await family.getByRole("button", { name: "Update selected view", exact: true }).click();
    await expect(family.getByRole("alert")).toContainText("Saved view changed");
    await expect(family).toContainText("Retained view proposal");
    await expect(draft).toHaveValue("Keep this engineering draft");
    await family.getByRole("button", { name: "Refresh saved views", exact: true }).click();
    await family.getByRole("button", { name: "Use latest saved version", exact: true }).click();
    await family.getByRole("button", { name: "Retry retained view proposal", exact: true }).click();
    await expect(family.getByLabel("Saved view", { exact: true })).toContainText(
      "Suction review view",
    );
    await expect(draft).toHaveValue("Keep this engineering draft");
    await page.route("**/api/saved-views", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "incomplete reply",
      });
    });
    await family.getByLabel("Saved view name").fill("Transported view");
    await family.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect(family.getByRole("alert")).toContainText(
      "Could not confirm the saved-view change",
    );
    await expect(
      family.getByRole("button", { name: "Retry retained view proposal", exact: true }),
    ).toBeDisabled();
    await expect(draft).toHaveValue("Keep this engineering draft");
    await page.unroute("**/api/saved-views");
    await family.getByRole("button", { name: "Refresh saved views", exact: true }).click();
    await expect(family.getByLabel("Saved view", { exact: true })).toContainText(
      "Transported view",
    );
    expect(
      (await tracer.savedViews.list()).filter((view) => view.name === "Transported view"),
    ).toHaveLength(1);
    await expect(
      family.getByRole("button", { name: "Retry retained view proposal", exact: true }),
    ).toBeDisabled();
    await family
      .getByRole("button", { name: "I inspected refreshed views; continue editing", exact: true })
      .click();
    await family
      .getByLabel("Saved view", { exact: true })
      .selectOption({ label: "Transported view" });
    await expect(
      family.locator("summary").filter({ hasText: "Retained view proposal" }),
    ).toHaveCount(0);
    await expect(draft).toHaveValue("Keep this engineering draft");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (await family.getByLabel("Saved view name", { exact: true }).boundingBox())!.width,
    ).toBeGreaterThan(180);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({ path: "/tmp/tracer-family-saved-library-narrow.png" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await openView(page, "Table");
    await chain.getByLabel("Saved view", { exact: true }).selectOption({ label: "Product trace" });
    await chain.getByRole("button", { name: "Open saved view", exact: true }).click();
    await expect(page.locator(".chain-grid")).toContainText("ROBOT-01");
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
