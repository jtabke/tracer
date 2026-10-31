import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { evaluationChooser, receiptInputEditor } from "./evidence-navigation.ts";
import { openNativeTask as openView, refreshNativeTask } from "./project-navigation.ts";
import type { Page as BrowserPage } from "./browser-test.ts";

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-pins-browser-"));
  const database = join(directory, "project.sqlite");
  const repo = new SQLiteRepository(database);
  const tracer = new Tracer(repo);
  const actor = { actor: "test" };
  await tracer.setSchema(
    {
      entityTypes: {
        item: { fields: { title: { type: "string" }, statement: { type: "string" } } },
      },
      relationshipTypes: {},
    },
    0,
    actor,
  );
  const create = (key: string) =>
    tracer.createEntity(
      { type: "item", key, fields: { title: key, statement: key + " original" } },
      1,
      actor,
    );
  const hardware = await create("HARDWARE");
  const software = await create("SOFTWARE");
  const build = await create("BUILD");
  const report = await create("REPORT");
  await tracer.updateEntity(
    hardware.id,
    1,
    { fields: { title: "HARDWARE", statement: "Hardware revised" } },
    1,
    actor,
  );
  await tracer.updateEntity(
    software.id,
    1,
    { fields: { title: "SOFTWARE", statement: "Software revised" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  return { directory, database, repo, tracer, server, hardware, software, build, report };
}
async function chooseOldHardware(page: BrowserPage, hardwareId: string) {
  await openView(page, "Configurations");
  await page.getByRole("button", { name: "Capture configuration", exact: true }).click();
  const capture = page.getByRole("region", { name: "Capture configuration task", exact: true });
  await capture.getByLabel("Configuration name", { exact: true }).fill("Hardware A + software B");
  await capture.getByLabel("Member entity", { exact: true }).selectOption(hardwareId);
  await capture.getByRole("button", { name: "Browse recorded versions" }).click();
  await expect(
    capture.getByLabel("Input revision").locator("option").filter({ hasText: "Exact v1" }),
  ).toHaveCount(1);
  await capture.getByLabel("Input revision").selectOption("1");
  await expect(capture).toContainText("Selected v1: HARDWARE original");
  await capture
    .getByLabel("Capture purpose", { exact: true })
    .fill("Retain exact native engineering revisions");
  await capture
    .getByLabel("Scope rationale", { exact: true })
    .fill("Partial native member scope; no unselected content or topology is inferred");
  return capture;
}

test("mixed native revisions are captured, evaluated, compared and reopened with readable narrow context", async ({
  page,
}) => {
  const value = await fixture();
  let closed = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(value.server.origin);
    const capture = await chooseOldHardware(page, value.hardware.id);
    await capture.getByLabel("Configuration subject", { exact: true }).selectOption(value.build.id);
    await capture.getByRole("button", { name: "Add configuration member" }).click();
    await capture
      .getByLabel("Member entity", { exact: true })
      .nth(1)
      .selectOption(value.software.id);
    const history = await value.tracer.history();
    await capture.getByRole("button", { name: "Prepare capture", exact: true }).click();
    await capture.getByRole("button", { name: "Capture configuration", exact: true }).click();
    await expect(capture.getByRole("article", { name: "Pinned configuration" })).toContainText(
      "SOFTWARE · pinned v2",
    );
    await expect(capture.getByRole("article", { name: "Pinned configuration" })).toContainText(
      "HARDWARE · pinned v1",
    );
    const configuration = (await value.tracer.configurations.list()).items[0];
    await openView(page, "Evidence");
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await page.getByLabel("Configuration basis (optional)").selectOption(configuration.id);
    await page.getByLabel("Output or conclusion", { exact: true }).selectOption(value.report.id);
    await page
      .getByLabel("Outcome", { exact: true })
      .fill("SIMULATED pass for A hardware and B software");
    await receiptInputEditor(page)
      .getByLabel("Input entity", { exact: true })
      .selectOption(value.hardware.id);
    await page.getByRole("button", { name: "Add declared input" }).click();
    await receiptInputEditor(page)
      .getByLabel("Input entity", { exact: true })
      .selectOption(value.software.id);
    await page.getByRole("button", { name: "Record receipt", exact: true }).click();
    await page.getByRole("button", { name: "Return to recorded evaluations", exact: true }).click();
    await expect(page.getByLabel("Evaluation receipt").locator("option")).toHaveCount(2);
    const receipt = (await value.tracer.evidence.list("receipt")).items[0];
    await (await evaluationChooser(page)).selectOption(receipt.id);
    await expect(
      page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed" }),
    ).toBeVisible();
    await expect(page.getByText("Recorded configuration:", { exact: false })).toContainText(
      configuration.name,
    );
    const software = page.getByRole("button", { name: "Compare input SOFTWARE", exact: true });
    await expect(software).toContainText("Captured v2 → Current v2");
    const changed = page.getByLabel("Selected input comparison", { exact: true });
    await expect(
      changed.getByRole("heading", { name: "HARDWARE: changed", exact: true }),
    ).toBeVisible();
    await expect(changed).toContainText("HARDWARE original");
    await expect(changed).toContainText("Hardware revised");
    expect(await value.tracer.history()).toEqual(history);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
    ).toHaveCount(2);
    await expect(page.locator("body")).toContainText("HARDWARE original");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    const screenshots = join(tmpdir(), "tracer-pins-pixels");
    mkdirSync(screenshots, { recursive: true });
    await page.screenshot({
      path: join(screenshots, "mixed-revisions-narrow.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Return to recorded evaluations", exact: true }).click();
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await page.getByLabel("Configuration basis (optional)").selectOption("");
    await page.getByRole("button", { name: "Edit input 1: HARDWARE", exact: true }).click();
    const revisions = receiptInputEditor(page).locator(".native-revision-select");
    await revisions.first().getByRole("button", { name: "Browse recorded versions" }).click();
    await expect(
      revisions
        .first()
        .getByLabel("Input revision")
        .locator("option")
        .filter({ hasText: "Exact v1" }),
    ).toHaveCount(1);
    await revisions.first().getByLabel("Input revision").selectOption("1");
    await page
      .getByLabel("Outcome", { exact: true })
      .fill("Historical re-evaluation after current edits");
    await page.getByRole("button", { name: "Record receipt", exact: true }).click();
    await expect(page.getByLabel("Evaluation receipt").locator("option")).toHaveCount(3);
    const later = (await value.tracer.evidence.list("receipt"))
      .items[1] as import("../src/core/evidence.ts").Receipt;
    expect(later.configuration).toBeUndefined();
    expect(later.inputs[0].pin?.entity.version).toBe(1);
    expect(later.inputs[1].entity.version).toBe(2);
    await value.server.close();
    value.repo.close();
    closed = true;
    const reopened = new SQLiteRepository(value.database);
    const server = await startLocalServer(new Tracer(reopened), resolve("dist"), 0);
    try {
      await page.goto(server.origin + "/?item=" + value.build.id);
      await openView(page, "Configurations");
      await page
        .getByRole("button", { name: `Open configuration ${configuration.name}`, exact: true })
        .click();
      await expect(page.getByRole("article", { name: "Pinned configuration" })).toContainText(
        "HARDWARE · pinned v1",
      );
    } finally {
      await server.close();
      reopened.close();
    }
    expect(errors).toEqual([]);
  } finally {
    if (!closed) {
      await value.server.close();
      value.repo.close();
    }
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("capture conflicts and unknown outcomes retain proposals and pause blind retries", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(value.server.origin);
    const capture = await chooseOldHardware(page, value.hardware.id);
    await capture.getByLabel("Configuration subject", { exact: true }).selectOption(value.build.id);
    await value.tracer.updateEntity(
      value.build.id,
      1,
      { fields: { title: "BUILD", statement: "Build changed" } },
      1,
      { actor: "other-editor" },
    );
    await capture.getByRole("button", { name: "Refresh capture context", exact: true }).click();
    await capture.getByRole("button", { name: "Prepare capture", exact: true }).click();
    await capture.getByRole("button", { name: "Capture configuration", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Configuration subject changed before capture",
    );
    await expect(capture.getByLabel("Configuration name")).toHaveValue("Hardware A + software B");
    await expect(capture.getByLabel("Input revision")).toHaveValue("1");
    await refreshNativeTask(page, "Configurations");
    await expect(
      capture
        .getByLabel("Configuration subject", { exact: true })
        .locator(`option[value="${value.build.id}"]`),
    ).toContainText("v2");
    await capture.getByLabel("Configuration subject", { exact: true }).selectOption("");
    await capture.getByLabel("Configuration subject", { exact: true }).selectOption(value.build.id);
    await capture
      .getByRole("button", { name: "Adopt refreshed capture selection", exact: true })
      .click();
    await page.route("**/api/configuration-captures", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({ response, body: "unreadable response" });
    });
    await capture.getByRole("button", { name: "Capture configuration", exact: true }).click();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await expect(
      capture.getByRole("button", { name: "Capture configuration", exact: true }),
    ).toBeDisabled();
    await expect(
      recovery.getByRole("button", { name: "I inspected saved records; continue editing" }),
    ).toBeDisabled();
    expect((await value.tracer.configurations.list()).items).toHaveLength(1);
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery).toContainText("Exact configuration Hardware A + software B");
    await recovery.getByText("Full recorded data", { exact: true }).click();
    await expect(recovery).toContainText(value.hardware.id);
    const saved = (await value.tracer.configurations.list()).items[0];
    expect(saved.capture!.intent.members).toEqual([{ entityId: value.hardware.id, version: 1 }]);
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing" })
      .click();
    await expect(capture.getByLabel("Configuration name")).toHaveValue("Hardware A + software B");
    await expect(capture.getByLabel("Input revision")).toHaveValue("1");
    expect((await value.tracer.configurations.list()).items).toHaveLength(1);
  } finally {
    await value.server.close();
    value.repo.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("missing configuration support pauses historical writes while retaining the proposal", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(value.server.origin);
    await openView(page, "Evidence");
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await page.getByLabel("Output or conclusion", { exact: true }).selectOption(value.report.id);
    await page.getByLabel("Outcome", { exact: true }).fill("Historical proposal retained");
    await receiptInputEditor(page)
      .getByLabel("Input entity", { exact: true })
      .selectOption(value.hardware.id);
    const revision = receiptInputEditor(page).locator(".native-revision-select");
    await revision.getByRole("button", { name: "Browse recorded versions" }).click();
    await expect(
      revision.getByLabel("Input revision").locator("option").filter({ hasText: "Exact v1" }),
    ).toHaveCount(1);
    await revision.getByLabel("Input revision").selectOption("1");
    await page.route("**/api/configurations?**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_found", message: "Unknown query endpoint" }),
      }),
    );
    await refreshNativeTask(page, "Evidence");
    await expect(page.getByRole("alert")).toContainText(
      "This running server does not support configuration captures",
    );
    await expect(page.getByRole("button", { name: "Record receipt", exact: true })).toBeDisabled();
    await expect(revision.getByLabel("Input revision")).toBeDisabled();
    await expect(revision.getByLabel("Input revision")).toHaveValue("1");
    await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue(
      "Historical proposal retained",
    );
    await page.unroute("**/api/configurations?**");
    await page.getByRole("button", { name: "Refresh configurations", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record receipt", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Record receipt", exact: true }).click();
    await expect(page.getByLabel("Evaluation receipt").locator("option")).toHaveCount(2);
    const receipt = (await value.tracer.evidence.list("receipt"))
      .items[0] as import("../src/core/evidence.ts").Receipt;
    expect(receipt.inputs[0].pin?.entity.version).toBe(1);
  } finally {
    await value.server.close();
    value.repo.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});
