import { test as base, expect } from "./browser-test.ts";
import type { Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import type { Receipt } from "../src/core/evidence.ts";
import type { Entity, Schema } from "../src/core/model.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { openView } from "./browser-navigation.ts";

const actor = { actor: "studio-customer-task" };
const initialStatement = "Retain scheduled operations through a 24-hour interruption.";
const currentStatement = "Retain scheduled operations through a 72-hour interruption.";
const siblingStatement = "Distinguish pending delivery from a confirmed robot schedule.";
const testStatement = "Restart after interruption and retain the original queued operation IDs.";
const schema: Schema = {
  entityTypes: {
    intent: { fields: { title: { type: "string" }, statement: { type: "string" } } },
    requirement: { fields: { title: { type: "string" }, statement: { type: "string" } } },
    implementation: { fields: { title: { type: "string" }, statement: { type: "string" } } },
    test_scenario: {
      fields: {
        title: { type: "string", required: true },
        statement: { type: "string", required: true },
        status: { type: "string" },
      },
    },
    result: { fields: { title: { type: "string" }, statement: { type: "string" } } },
  },
  relationshipTypes: {
    contributes_to: { source: ["requirement"], target: ["intent"], fields: {} },
    implemented_by: { source: ["requirement"], target: ["implementation"], fields: {} },
    evaluated_by: { source: ["requirement", "implementation"], target: ["result"], fields: {} },
    checked_by: {
      source: ["requirement", "implementation"],
      target: ["test_scenario"],
      fields: {
        scope: { type: "string", required: true },
        source_version: { type: "number", required: true },
        review: { type: "string", required: true },
      },
    },
  },
};

type StudioFixture = {
  tracer: Tracer;
  origin: string;
  intent: Entity;
  source: Entity;
  sibling: Entity;
  implementation: Entity;
  result: Entity;
  receipt: Receipt;
  other: Receipt;
};

async function seed(tracer: Tracer) {
  await tracer.setSchema(schema, 0, actor);
  const create = (type: string, key: string, title: string, statement: string) =>
    tracer.createEntity({ type, key, fields: { title, statement } }, 1, actor);
  const intent = await create(
    "intent",
    "NEED-SCHEDULE",
    "Keep cleaning schedules usable",
    "A user can keep a usable schedule through an interruption.",
  );
  const source = await create(
    "requirement",
    "REQ-SOURCE",
    "Retain queued operations",
    initialStatement,
  );
  const sibling = await create(
    "requirement",
    "REQ-SIBLING",
    "Explain delivery state",
    siblingStatement,
  );
  const implementation = await create(
    "implementation",
    "IMPL-SHARED",
    "Shared schedule worker",
    "One worker retains queue identity and delivery acknowledgments for both requirements.",
  );
  const result = await create(
    "result",
    "RESULT-BASELINE",
    "Recorded short-interruption result",
    "The baseline result concerns the captured 24-hour scope only.",
  );
  for (const requirement of [source, sibling]) {
    await tracer.createRelationship(
      { type: "contributes_to", source: requirement.id, target: intent.id, fields: {} },
      1,
      actor,
    );
    await tracer.createRelationship(
      { type: "implemented_by", source: requirement.id, target: implementation.id, fields: {} },
      1,
      actor,
    );
  }
  await tracer.createRelationship(
    { type: "evaluated_by", source: source.id, target: result.id, fields: {} },
    1,
    actor,
  );
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: result.id,
      outcome: "SIMULATED baseline only — expanded interruption untested",
      inputs: [{ entityId: source.id }, { entityId: implementation.id }],
    },
    actor,
  );
  const other = await tracer.evidence.recordReceipt(
    {
      outputId: result.id,
      outcome: "Another exact capture — delivery state only",
      inputs: [{ entityId: sibling.id }],
    },
    actor,
  );
  const updated = await tracer.updateEntity(
    source.id,
    1,
    { fields: { ...source.fields, statement: currentStatement } },
    1,
    actor,
  );
  return { intent, source: updated, sibling, implementation, result, receipt, other };
}

const test = base.extend<{ fixture: StudioFixture }>({
  fixture: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-studio-task-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const records = await seed(tracer);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ tracer, origin: server.origin, ...records });
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function openSourceFamily(page: Page, fixture: StudioFixture) {
  await page.goto(
    `${fixture.origin}/?view=workspace&item=${fixture.intent.id}&family=contributes_to&direction=incoming`,
  );
  await expect(page.getByRole("button", { name: "REQ-SOURCE · v2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "REQ-SOURCE · v2", exact: true }).click();
  await expect(page.getByLabel("Workspace inspector", { exact: true })).toContainText(
    currentStatement,
  );
}

async function describeMapping(
  region: import("@playwright/test").Locator,
  scope: string,
  version: number,
) {
  await region.getByLabel("Draft scope", { exact: true }).fill(scope);
  await region.getByLabel("Draft source_version", { exact: true }).fill(String(version));
  await region.getByLabel("Draft review", { exact: true }).fill("unreviewed");
  await expect(
    region.getByRole("button", { name: "Record connection", exact: true }),
  ).toBeEnabled();
  await region.getByRole("button", { name: "Record connection", exact: true }).click();
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "narrow", width: 390, height: 844 },
]) {
  test.describe(`${viewport.name} studio customer tasks`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("native contextual authoring retains source/siblings and links one shared test identity", async ({
      page,
      fixture,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openSourceFamily(page, fixture);
      await page.getByRole("button", { name: "Create in context", exact: true }).click();
      const creation = page.getByRole("region", { name: "Create item", exact: true });
      await expect(creation).toContainText(currentStatement);
      await expect(creation).toContainText("REQ-SIBLING");
      await creation.getByLabel("New item type", { exact: true }).selectOption("test_scenario");
      await creation.getByLabel("New item key", { exact: true }).fill("TEST-SYNC");
      await creation
        .getByLabel("Draft title", { exact: true })
        .fill("Queue identity survives interruption");
      await creation.getByLabel("Draft statement", { exact: true }).fill(testStatement);
      await creation
        .getByLabel("Draft status", { exact: true })
        .fill("Planned definition; not executed");
      await page.screenshot({
        path: `/tmp/tracer-studio-author-${viewport.name}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Return to NEED-SCHEDULE scope", exact: true })
        .click();
      await expect(creation).toBeHidden();
      await openView(page, "Model");
      await openView(page, "Workspace");
      await page.getByRole("button", { name: "Return to item creation", exact: true }).click();
      await expect(creation.getByLabel("Draft statement", { exact: true })).toHaveValue(
        testStatement,
      );
      await expect(creation.getByLabel("Draft status", { exact: true })).toHaveValue(
        "Planned definition; not executed",
      );
      await creation.getByRole("button", { name: "Create item", exact: true }).click();
      const continuation = page.getByRole("region", {
        name: "Created item continuation",
        exact: true,
      });
      await expect(continuation).toContainText("Saved without connections");
      const created = (
        await fixture.tracer.queryEntities({ type: "test_scenario", key: "TEST-SYNC" })
      ).items;
      expect(created).toHaveLength(1);
      expect(created[0].fields).toMatchObject({
        statement: testStatement,
        status: "Planned definition; not executed",
      });
      expect((await fixture.tracer.queryRelationships({ type: "checked_by" })).items).toHaveLength(
        0,
      );
      await continuation
        .getByRole("button", { name: "Review connection to REQ-SOURCE", exact: true })
        .click();
      const proposal = page.getByRole("region", { name: "Record connection", exact: true });
      await expect(proposal).toContainText(currentStatement);
      await expect(proposal).toContainText(testStatement);
      await expect(proposal.getByLabel("Connection direction", { exact: true })).toContainText(
        "REQ-SOURCE · captured v2 → checked by → TEST-SYNC · captured v1",
      );
      await page.screenshot({
        path: `/tmp/tracer-studio-connection-${viewport.name}.png`,
        fullPage: true,
      });
      await proposal.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/tmp/tracer-studio-connection-viewport-${viewport.name}.png`,
      });
      await describeMapping(
        proposal,
        "Planned scenario checks queue-retention criteria; execution remains unrecorded.",
        2,
      );
      await expect(continuation).toContainText("Connection recorded");
      await continuation
        .getByRole("button", { name: "Return to working scope", exact: true })
        .click();
      expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.intent.id);
      await expect(page.locator(".workspace-bar h2")).toContainText("NEED-SCHEDULE");
      await expect(
        page.getByRole("button", { name: "REQ-SIBLING · v1", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Inspect IMPL-SHARED", exact: true }).click();
      await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
      const mapping = page.getByRole("dialog", { name: "Record connection", exact: true });
      await mapping.getByLabel("Mapping direction", { exact: true }).selectOption("outgoing");
      await mapping.getByLabel("Mapping relationship", { exact: true }).selectOption("checked_by");
      await mapping.getByLabel("Find mapping candidate", { exact: true }).fill("TEST-SYNC");
      await mapping.getByRole("button", { name: "Choose TEST-SYNC", exact: true }).click();
      await describeMapping(
        mapping,
        "Same scenario evaluates the shared worker; no result is inferred.",
        1,
      );
      await expect(mapping).toHaveCount(0);
      const links = (await fixture.tracer.queryRelationships({ type: "checked_by" })).items;
      expect(links).toHaveLength(2);
      expect(new Set(links.map((link) => link.target))).toEqual(new Set([created[0].id]));
      expect(new Set(links.map((link) => link.source))).toEqual(
        new Set([fixture.source.id, fixture.implementation.id]),
      );
      expect((await fixture.tracer.queryEntities({ type: "test_scenario" })).items).toHaveLength(1);
      expect(await fixture.tracer.evidence.getReceipt(fixture.receipt.id)).toEqual(fixture.receipt);
      expect((await fixture.tracer.evidence.list("receipt")).items).toHaveLength(2);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      await page.screenshot({
        path: `/tmp/tracer-studio-linked-${viewport.name}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });

    test("Work opens the exact captured receipt and returns to the retained source family", async ({
      page,
      fixture,
    }) => {
      await openSourceFamily(page, fixture);
      const returnFromSourceRead = page.locator(".workspace-detail-region").getByRole("button", {
        name: "Return to NEED-SCHEDULE scope",
        exact: true,
      });
      if (await returnFromSourceRead.isVisible()) await returnFromSourceRead.click();
      await page.getByRole("button", { name: "Inspect RESULT-BASELINE", exact: true }).click();
      const inspector = page.getByLabel("Workspace inspector", { exact: true });
      await inspector
        .getByRole("button", {
          name: `Inspect evaluation: ${fixture.receipt.outcome}`,
          exact: true,
        })
        .click();
      const capture = page.getByLabel("Captured result review", { exact: true });
      await expect(capture.getByLabel("Recorded result", { exact: true })).toContainText(
        fixture.receipt.outcome,
      );
      await expect(capture.getByLabel("Recorded result", { exact: true })).not.toContainText(
        fixture.other.outcome,
      );
      await expect(capture.getByLabel("Selected input comparison", { exact: true })).toContainText(
        initialStatement,
      );
      await expect(capture.getByLabel("Selected input comparison", { exact: true })).toContainText(
        currentStatement,
      );
      await expect(
        capture.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
      ).toHaveCount(2);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      await page.screenshot({
        path: `/tmp/tracer-studio-capture-${viewport.name}.png`,
        fullPage: true,
      });
      await capture
        .getByRole("button", { name: "Return to NEED-SCHEDULE scope", exact: true })
        .click();
      await expect(capture).toBeHidden();
      expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.intent.id);
      await expect(page.locator(".workspace-bar h2")).toContainText("NEED-SCHEDULE");
      await expect(
        page.getByRole("button", { name: "Inspect RESULT-BASELINE", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      if (!(await inspector.isVisible()))
        await page.getByRole("button", { name: "Show details", exact: true }).click();
      await expect(
        inspector.getByRole("heading", { name: "RESULT-BASELINE", exact: true }),
      ).toBeVisible();
      expect(await fixture.tracer.evidence.getReceipt(fixture.receipt.id)).toEqual(fixture.receipt);
      expect(await fixture.tracer.evidence.getReceipt(fixture.other.id)).toEqual(fixture.other);
      expect((await fixture.tracer.evidence.list("review")).items).toHaveLength(0);
    });
  });
}
