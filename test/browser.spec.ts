import { evaluationChooser, openView, receiptInputEditor } from "./browser-navigation.ts";
import { test as base, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Schema } from "../src/core/model.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import type { Receipt, Observation } from "../src/core/evidence.ts";

const origin = { actor: "test" };
const schema: Schema = {
  entityTypes: {
    requirement: {
      fields: { title: { type: "string", required: true }, approved: { type: "boolean" } },
    },
    test: { fields: { title: { type: "string", required: true } } },
  },
  relationshipTypes: { verified_by: { source: ["requirement"], target: ["test"], fields: {} } },
};
const test = base.extend<{ app: { tracer: Tracer; origin: string; path: string } }>({
  app: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-browser-")),
      path = join(directory, "project.sqlite");
    const repo = new SQLiteRepository(path),
      tracer = new Tracer(repo, undefined, observeLocal);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ tracer, origin: server.origin, path });
    } finally {
      await server.close();
      repo.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});
async function seed(tracer: Tracer, custom: Schema = schema) {
  await tracer.setSchema(custom, 0, origin);
  const requirement = await tracer.createEntity(
    { type: "requirement", key: "REQ-1", fields: { title: "Original requirement" } },
    1,
    origin,
  );
  const target = await tracer.createEntity(
    { type: "test", key: "TEST-1", fields: { title: "Verification" } },
    1,
    origin,
  );
  return { requirement, target };
}

test("fresh project: schema, table creation, keyboard edit, matrix toggle and immutable history", async ({
  app,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(app.origin);
  await page.getByRole("button", { name: "Configure model" }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Advanced JSON", { exact: true }).check();
  await page.getByLabel("Project schema JSON").fill(JSON.stringify(schema));
  await page.getByRole("button", { name: "Save model" }).click();
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  await page.getByLabel("New human key").fill("REQ-1");
  await page.getByLabel("New title", { exact: true }).fill("Original requirement");
  await page.getByRole("button", { name: "Add entity" }).click();
  await expect(page.getByLabel("title for REQ-1", { exact: true })).toHaveValue(
    "Original requirement",
  );
  await page.getByLabel("Entity type", { exact: true }).selectOption("test");
  await page.getByLabel("New human key").fill("TEST-1");
  await page.getByLabel("New title", { exact: true }).fill("Verification");
  await page.getByRole("button", { name: "Add entity" }).click();
  await expect(page.getByLabel("title for TEST-1", { exact: true })).toHaveValue("Verification");
  await openView(page, "Matrix");
  const inactiveTabBackground = await page
    .getByRole("tab", { name: "Trace query", exact: true })
    .evaluate((tab) => getComputedStyle(tab).backgroundColor);
  await expect(page.getByRole("tab", { name: "Matrix query", exact: true })).not.toHaveCSS(
    "background-color",
    inactiveTabBackground,
  );
  await expect(page.getByText("Missing link", { exact: true })).toBeVisible();
  const cell = page.getByRole("button", { name: "REQ-1 → TEST-1", exact: true });
  await cell.focus();
  await page.keyboard.press("Space");
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Missing link", { exact: true })).toHaveCount(0);
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  await page.getByLabel("Entity type", { exact: true }).selectOption("requirement");
  const title = page.getByLabel("title for REQ-1", { exact: true });
  await title.fill("Edited requirement");
  await title.press("Enter");
  await expect(page.getByRole("button", { name: "Save REQ-1", exact: true })).toBeDisabled();
  await openView(page, "Matrix");
  await expect(
    page
      .getByRole("tabpanel", { name: "Matrix query", exact: true })
      .getByText("Edited requirement", { exact: true }),
  ).toBeVisible();
  await cell.click();
  await expect(cell).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Missing link", { exact: true })).toBeVisible();
  expect((await app.tracer.queryRelationships()).items).toHaveLength(0);
  const history = (await app.tracer.history({ kind: "relationship" })).items;
  expect(history).toHaveLength(2);
  expect(history[1].snapshot).toBeNull();
  expect(errors).toEqual([]);
});

test("drafts survive filtering and matrix mutations; bulk edits are one changeset", async ({
  app,
  page,
}) => {
  await seed(app.tracer);
  await app.tracer.createEntity(
    { type: "requirement", key: "REQ-2", fields: { title: "Second requirement" } },
    1,
    origin,
  );
  await page.goto(app.origin);
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  const title = page.getByLabel("title for REQ-1", { exact: true });
  await title.fill("Unsaved draft");
  await page.getByLabel("Filter this page", { exact: true }).fill("Second");
  await expect(title).toBeHidden();
  await page.getByLabel("Filter this page", { exact: true }).fill("");
  await expect(title).toHaveValue("Unsaved draft");
  await openView(page, "Matrix");
  await page.getByRole("button", { name: "REQ-1 → TEST-1", exact: true }).click();
  await expect(page.getByRole("button", { name: "REQ-1 → TEST-1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  await expect(title).toHaveValue("Unsaved draft");
  await page.getByLabel("Select REQ-1", { exact: true }).check();
  await page.getByLabel("Select REQ-2", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Apply to selected" })).toBeDisabled();
  await title.press("Enter");
  await expect(page.getByRole("button", { name: "Apply to selected" })).toBeEnabled();
  await page.getByLabel("Bulk field", { exact: true }).selectOption("title");
  await page.getByLabel("Bulk value", { exact: true }).fill("Bulk edited");
  await page.getByRole("button", { name: "Apply to selected" }).click();
  await expect(page.getByLabel("title for REQ-1", { exact: true })).toHaveValue("Bulk edited");
  await expect(page.getByLabel("title for REQ-2", { exact: true })).toHaveValue("Bulk edited");
  const last = (await app.tracer.changesets()).at(-1)!;
  expect(
    (await app.tracer.history()).items.filter((row) => row.changesetId === last.id),
  ).toHaveLength(2);
});

test("CLI conflicts preserve attempted edits, show current state, and require deliberate retry", async ({
  app,
  page,
}) => {
  const { requirement } = await seed(app.tracer);
  await page.goto(app.origin);
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  const title = page.getByLabel("title for REQ-1", { exact: true });
  await title.fill("Attempted local title");
  execFileSync(process.execPath, [
    "src/interfaces/cli.ts",
    "--db",
    app.path,
    "--schema-version",
    "1",
    "--actor",
    "external-cli",
    "entity",
    "update",
    requirement.id,
    "1",
    '{"fields":{"title":"Changed outside UI"}}',
  ]);
  await title.press("Enter");
  await expect(page.getByRole("alert")).toContainText("conflict:");
  await expect(title).toHaveValue("Attempted local title");
  await expect(page.getByRole("alert")).toContainText("Attempted local title");
  await page.getByRole("button", { name: "Refresh current data" }).click();
  await expect(page.getByText("Current v2", { exact: true })).toBeVisible();
  await page.getByText("Current v2", { exact: true }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "Trace query", exact: true })
      .getByText('"title": "Changed outside UI"', { exact: false }),
  ).toBeVisible();
  await title.press("Escape");
  await expect(title).toHaveValue("Changed outside UI");
  await title.fill("Reviewed retry");
  await title.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await app.tracer.queryEntities({ key: "REQ-1" })).items[0].version).toBe(3);
});

test("stale schema is rejected and refresh retains the failed proposal for review", async ({
  app,
  page,
}) => {
  await seed(app.tracer);
  await page.goto(app.origin);
  await openView(page, "Table");
  await page.getByRole("button", { name: "Editable rows", exact: true }).click();
  const title = page.getByLabel("title for REQ-1", { exact: true });
  await title.fill("Old-schema edit");
  await app.tracer.setSchema(schema, 1, origin);
  await title.press("Enter");
  await expect(page.getByRole("alert")).toContainText("schema_conflict:");
  await page.getByRole("button", { name: "Refresh current data" }).click();
  await expect(title).toHaveValue("Old-schema edit");
  await expect(page.getByRole("alert")).toContainText("Old-schema edit");
  await expect(
    page.getByText("Draft schema v1; current v2. Escape adopts current schema."),
  ).toBeVisible();
  await title.press("Escape");
  await expect(title).toHaveValue("Original requirement");
  await title.fill("Current-schema edit");
  await title.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await app.tracer.history({ kind: "entity" })).items.at(-1)?.schemaVersion).toBe(2);
});

test("matrix creation respects configured relationship fields instead of bypassing validation", async ({
  app,
  page,
}) => {
  await seed(app.tracer, {
    ...schema,
    relationshipTypes: {
      verified_by: {
        ...schema.relationshipTypes.verified_by,
        fields: { note: { type: "string", required: true } },
      },
    },
  });
  await page.goto(app.origin);
  await openView(page, "Matrix");
  const cell = page.getByRole("button", { name: "REQ-1 → TEST-1", exact: true });
  await cell.click();
  await expect(page.getByRole("alert")).toContainText("Required field: note");
  await expect(cell).toHaveAttribute("aria-pressed", "false");
  await page
    .getByLabel("New link attributes", { exact: true })
    .fill('{"note":"reviewed evidence"}');
  await cell.click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  expect((await app.tracer.queryRelationships()).items[0].fields).toEqual({
    note: "reviewed evidence",
  });
});

test("offline evidence UI binds Git/file inputs, records receipts, explains drift and preserves reviews", async ({
  app,
  page,
}) => {
  const { requirement, target } = await seed(app.tracer);
  const implementation = await app.tracer.createEntity(
    { type: "test", key: "FW-03", fields: { title: "Implementation" } },
    1,
    origin,
  );
  const evidence = await app.tracer.createEntity(
    { type: "test", key: "EVIDENCE-1", fields: { title: "Local report" } },
    1,
    origin,
  );
  const source = join(dirname(app.path), "source");
  mkdirSync(source);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", source, ...args], { encoding: "utf8" });
  git("init", "--quiet");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Fixture");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(source, "motor.ts"), "speed=100");
  writeFileSync(join(source, "unrelated.txt"), "a");
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "-m", "fixture");
  };
  commit();
  const local = join(dirname(app.path), "report.txt");
  writeFileSync(local, "PASS");
  await app.tracer.createRelationship(
    { type: "verified_by", source: requirement.id, target: implementation.id, fields: {} },
    1,
    origin,
  );
  await app.tracer.createRelationship(
    { type: "verified_by", source: requirement.id, target: evidence.id, fields: {} },
    1,
    origin,
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(app.origin);
  await openView(page, "Evidence");
  await page.getByRole("button", { name: "Observe external artifact", exact: true }).click();
  await page.getByLabel("Artifact entity", { exact: true }).selectOption(implementation.id);
  await page.getByLabel("Stable external identifier").fill("firmware-03");
  await page.getByRole("button", { name: "Bind identity", exact: true }).click();
  await expect(page.getByText(/Stable git identity/)).toBeVisible();
  await page.getByLabel("Local Git repository").fill(source);
  await page.getByLabel("Repository-relative file path").fill("motor.ts");
  await page.getByRole("button", { name: "Record observation", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.evidence.list("observation")).items.length)
    .toBe(1);
  await page.getByLabel("Artifact entity", { exact: true }).selectOption(evidence.id);
  await page.getByLabel("Source system").selectOption("file");
  await page.getByLabel("Stable external identifier").fill("report-01");
  await page.getByRole("button", { name: "Bind identity", exact: true }).click();
  await expect(page.getByText(/Stable file identity/)).toBeVisible();
  await page.getByLabel("Local file path", { exact: true }).fill(local);
  await page.getByRole("button", { name: "Record observation", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.evidence.list("observation")).items.length)
    .toBe(2);
  const observations = (await app.tracer.evidence.list("observation")).items as Observation[];
  await page.getByRole("button", { name: "Return to recorded evaluations", exact: true }).click();
  await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
  await page.getByLabel("Output or conclusion", { exact: true }).selectOption(target.id);
  await page.getByLabel("Outcome", { exact: true }).fill("PASS");
  await receiptInputEditor(page)
    .getByLabel("Input entity", { exact: true })
    .selectOption(requirement.id);
  await page.getByRole("button", { name: "Add declared input", exact: true }).click();
  await receiptInputEditor(page)
    .getByLabel("Input entity", { exact: true })
    .selectOption(implementation.id);
  await receiptInputEditor(page).getByLabel("Exact observation").selectOption(observations[0].id);
  await page.getByRole("button", { name: "Add declared input", exact: true }).click();
  await receiptInputEditor(page)
    .getByLabel("Input entity", { exact: true })
    .selectOption(evidence.id);
  await receiptInputEditor(page).getByLabel("Exact observation").selectOption(observations[1].id);
  await page.getByRole("button", { name: "Record receipt", exact: true }).click();
  await expect.poll(async () => (await app.tracer.evidence.list("receipt")).items.length).toBe(1);
  const receipt = (await app.tracer.evidence.list("receipt")).items[0] as Receipt;
  await (await evaluationChooser(page)).selectOption(receipt.id);
  await expect(
    page.getByRole("heading", { name: "Freshness: current · Review: unreviewed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to Evaluations", exact: true }).click();
  writeFileSync(join(source, "unrelated.txt"), "b");
  commit();
  await page.getByRole("button", { name: "Observe external artifact", exact: true }).click();
  await page.getByLabel("Artifact entity", { exact: true }).selectOption(implementation.id);
  await page.getByRole("button", { name: "Record observation", exact: true }).click();
  await expect
    .poll(async () => (await app.tracer.evidence.list("observation")).items.length)
    .toBe(3);
  await page.getByRole("button", { name: "Return to captured result", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freshness: current · Review: unreviewed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to Evaluations", exact: true }).click();
  writeFileSync(join(source, "motor.ts"), "speed=120");
  commit();
  await page.getByRole("button", { name: "Record observation", exact: true }).click();
  await page.getByRole("button", { name: "Return to captured result", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed" }),
  ).toBeVisible();
  await expect(page.getByText(/Scoped content changed:/)).toBeVisible();
  const immutableReceipt = page
    .getByLabel("Captured result review", { exact: true })
    .locator("details")
    .filter({ has: page.getByText("Immutable recorded receipt", { exact: true }) });
  await immutableReceipt.locator("summary").click();
  const recorded = JSON.parse(await immutableReceipt.locator("pre").innerText());
  expect(recorded).toEqual(receipt);
  expect(recorded.id).toBe(receipt.id);
  await immutableReceipt.locator("summary").click();
  await page.getByRole("button", { name: "Review receipt", exact: true }).click();
  await page.getByLabel("Review decision", { exact: true }).selectOption("accepted");
  await page.getByLabel("Review rationale").fill("Existing report covers this speed range");
  await page.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freshness: changed · Review: accepted" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Freshness: changed · Review: accepted" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/tracer-evidence-ui.png" });
  expect((await app.tracer.evidence.list("receipt")).items[0]).toEqual(receipt);
  const observed = (await app.tracer.evidence.list("observation")).items.at(-1) as Observation;
  expect(
    (await app.tracer.evidence.compareReceipt(receipt.id)).inputs[1].current.observation?.commit,
  ).toBe(observed.commit);
  await app.tracer.updateEntity(
    requirement.id,
    1,
    { fields: { title: "Changed requirement" } },
    1,
    origin,
  );
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed" }),
  ).toBeVisible();
  await expect(page.getByText(/Previous review no longer matches/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("narrow evidence tasks reach native receipt and named immutable review without overflow", async ({
  app,
  page,
}) => {
  const { requirement, target } = await seed(app.tracer);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(app.origin);
  await openView(page, "Evidence");
  await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
  await expect(
    page.locator("legend", { hasText: "Record an immutable evaluation receipt" }),
  ).toBeFocused();
  await page.getByLabel("Output or conclusion", { exact: true }).selectOption(target.id);
  const outcome = "Native conclusion with a deliberately long option label ".repeat(8);
  await page.getByLabel("Outcome", { exact: true }).fill(outcome);
  await receiptInputEditor(page)
    .getByLabel("Input entity", { exact: true })
    .selectOption(requirement.id);
  await page.getByRole("button", { name: "Record receipt", exact: true }).click();
  await expect.poll(async () => (await app.tracer.evidence.list("receipt")).items.length).toBe(1);
  const receipt = (await app.tracer.evidence.list("receipt")).items[0] as Receipt;
  await page.getByRole("button", { name: "Return to recorded evaluations", exact: true }).click();
  await expect(page.getByLabel("Evaluation receipt", { exact: true })).toBeFocused();
  await (await evaluationChooser(page)).selectOption(receipt.id);
  await page.getByText("Dependency and capture details", { exact: true }).click();
  await expect(
    page.getByText("Direct dependency: TEST-1 · recorded v1 → REQ-1 · recorded v1", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review receipt", exact: true }).click();
  await page.getByLabel("Review decision", { exact: true }).selectOption("accepted");
  await page
    .getByLabel("Review rationale", { exact: true })
    .fill("Scoped native applicability assessment, not proof of satisfaction.");
  await page.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freshness: current · Review: accepted", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Canonical dependency IDs:", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Captured result review", { exact: true })).toContainText(
    requirement.id,
  );
  const bounds = await page
    .getByLabel("Captured result review", { exact: true })
    .locator("select, textarea, button")
    .evaluateAll((controls) =>
      controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
  expect(bounds.every((rect) => rect.left >= 0 && rect.right <= 390)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.reload();
  await openView(page, "Evidence");
  await (await evaluationChooser(page)).selectOption(receipt.id);
  await expect(
    page.getByRole("heading", { name: "Freshness: current · Review: accepted", exact: true }),
  ).toBeVisible();
});
