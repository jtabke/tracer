import {
  switchFamilyView,
  familyControl,
  openView,
  showProjectBrowser,
  editableField,
} from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { seedScaleProject } from "../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Entity } from "../src/core/model.ts";

for (const domain of ["software", "engineering"] as const)
  test(`${domain}: persisted family editing, shared focus, captured mapping, history and removal`, async ({
    page,
  }) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-workspace-browser-"));
    const fixture = await seedWorkspace(join(parent, "project"), domain);
    const repo = new SQLiteRepository(fixture.database),
      tracer = new Tracer(repo);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(server.origin);
      await openView(page, "Workspace");
      const browser = page.getByLabel("Project browser", { exact: true });
      await expect(browser).toContainText(`${domain === "software" ? 22 : 12} project items`);
      await showProjectBrowser(page);
      await browser.locator(".workspace-items button").filter({ hasText: "INT-01" }).click();
      await (await familyControl(page, "Family scope")).selectOption("incoming:contributes_to");
      await expect(page.locator(".workspace-lane")).toHaveCount(domain === "software" ? 4 : 2);
      const groups = page.getByLabel("Shared connected items", { exact: true });
      const output = fixture.outputs[0];
      await expect(
        groups.getByRole("button", { name: `Inspect ${output.key}`, exact: true }),
      ).toHaveCount(1);
      await page.getByRole("button", { name: "REQ-02 · v1", exact: true }).click();
      await groups.getByRole("button", { name: `Inspect ${output.key}`, exact: true }).click();
      await expect(page.locator(".workspace-lane.is-emphasized")).toHaveCount(2);
      await switchFamilyView(page, "Coverage");
      await expect(page.locator(".workspace-lane.is-emphasized")).toHaveCount(2);
      await page.getByRole("button", { name: "Return to REQ-02", exact: true }).click();
      const inspector = page.getByLabel("Workspace inspector", { exact: true });
      await expect(inspector.getByRole("heading", { name: "REQ-02", exact: true })).toBeVisible();
      await inspector.getByText("Edit item", { exact: true }).click();
      await inspector
        .getByLabel("Workspace statement", { exact: true })
        .fill("Saved requirement prose with unresolved scope.");
      await switchFamilyView(page, "Relationships");
      await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
        "Saved requirement prose with unresolved scope.",
      );
      await editableField(page, "Workspace statement");
      await inspector.getByRole("button", { name: "Save item", exact: true }).click();
      await expect(
        inspector.getByRole("button", { name: "Save item", exact: true }),
      ).toBeDisabled();
      await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
      await inspector.getByRole("button", { name: "Connect existing item", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Record connection", exact: true });
      await expect(dialog).toContainText("REQ-02 · captured v2");
      await expect(dialog).toContainText("Saved requirement prose with unresolved scope.");
      await dialog.getByLabel("Mapping relationship", { exact: true }).selectOption("mapped_to");
      await dialog.getByLabel("Mapping target type", { exact: true }).selectOption("test");
      await dialog.getByLabel("Find mapping candidate", { exact: true }).fill("TEST-1");
      await dialog.getByRole("button", { name: "Choose TEST-1", exact: true }).click();
      await dialog
        .getByLabel("Draft scope", { exact: true })
        .fill("Selected test definition; execution unknown");
      await dialog.getByLabel("Draft source_version", { exact: true }).fill("2");
      await dialog.getByLabel("Draft review", { exact: true }).fill("unreviewed");
      await dialog.getByRole("button", { name: "Record connection", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const recorded = groups.getByRole("button", { name: /REQ-02 → TEST-1/ });
      await expect(recorded.locator("..")).toContainText("Selected test definition");
      await recorded.click();
      await inspector.getByText("Stored revision history · REQ-02", { exact: true }).click();
      await expect(
        inspector.getByRole("heading", { name: /v1 · project revision/ }).first(),
      ).toBeVisible();
      await expect(
        inspector.getByRole("heading", { name: /v2 · project revision/ }).first(),
      ).toBeVisible();
      await page.screenshot({ path: `/tmp/tracer-workspace-${domain}.png`, fullPage: true });
      page.once("dialog", (prompt) => prompt.accept());
      await inspector.getByRole("button", { name: "Remove mapping", exact: true }).click();
      await expect(recorded).toHaveCount(0);
      expect((await tracer.queryRelationships({ type: "mapped_to" })).items).toHaveLength(3);
      const library = page.locator(".workspace-view-library");
      const head = (await tracer.history()).items.length;
      await library.getByRole("button", { name: "Save view…", exact: true }).click();
      await library.getByLabel("Saved view name", { exact: true }).fill("Retained family scope");
      await library.getByRole("button", { name: "Save as new view", exact: true }).click();
      await expect
        .poll(async () =>
          (await tracer.savedViews.list()).some((view) => view.name === "Retained family scope"),
        )
        .toBe(true);
      await switchFamilyView(page, "Coverage");
      await library.getByRole("button", { name: "Open saved view", exact: true }).click();
      await expect(
        page.locator(".workspace-bar").getByRole("button", { name: "Relationships", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect((await tracer.history()).items.length).toBe(head);

      await page.reload();
      await showProjectBrowser(page);
      await openView(page, "Workspace");
      await expect(page.locator(".workspace-lane")).toHaveCount(domain === "software" ? 4 : 2);
      await page.getByRole("button", { name: "REQ-02 · v2", exact: true }).click();
      await inspector.getByText("Edit item", { exact: true }).click();
      await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
        "Saved requirement prose with unresolved scope.",
      );
      await showProjectBrowser(page);
      await browser
        .getByLabel("Find workspace items", { exact: true })
        .fill("no-such-project-item");
      await expect(
        browser.getByRole("heading", { name: "No matching items", exact: true }),
      ).toBeVisible();
      await showProjectBrowser(page);
      await browser.getByRole("button", { name: "Clear filters", exact: true }).click();
      await expect(browser.locator(".workspace-items tbody tr")).toHaveCount(
        domain === "software" ? 22 : 12,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      await page.screenshot({ path: `/tmp/tracer-workspace-${domain}-narrow.png`, fullPage: true });
      expect(errors).toEqual([]);
    } finally {
      await server.close();
      repo.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });

test("empty project: starter choice, first items and connection, cancellation and validation", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-empty-workspace-"));
  const repo = new SQLiteRepository(join(parent, "project.sqlite")),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await expect(page.getByLabel("Project schema JSON", { exact: true })).toBeHidden();
    await page.getByLabel("Starter structure", { exact: true }).selectOption("engineering");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await openView(page, "Workspace");
    await expect(
      page.getByRole("heading", { name: "Your project is empty", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "/tmp/tracer-workspace-empty.png", fullPage: true });
    await showProjectBrowser(page);
    await page.getByRole("button", { name: "New item", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Create item", exact: true });
    await dialog.getByLabel("New item key", { exact: true }).fill("UNSAVED");
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest("dialog")))
        .toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect((await tracer.getWorkingSet()).total).toBe(0);
    for (const [type, key, title] of [
      ["intent", "INT-NEW", "Carry task"],
      ["requirement", "REQ-NEW", "Inspect the attachment before carrying"],
    ]) {
      await showProjectBrowser(page);
      await page.getByRole("button", { name: "New item", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "Create item", exact: true });
      await dialog.getByLabel("New item type", { exact: true }).selectOption(type);
      await dialog.getByLabel("New item key", { exact: true }).fill(key);
      if (type === "intent") {
        await dialog.getByRole("button", { name: "Create item", exact: true }).click();
        await expect(dialog.getByRole("alert")).toContainText("Required field: title");
        await expect(dialog.getByLabel("New item key", { exact: true })).toHaveValue(key);
      }
      await dialog.getByLabel("Draft title", { exact: true }).fill(title);
      await dialog.getByRole("button", { name: "Create item", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await showProjectBrowser(page);
      await page.getByRole("button", { name: "Open created item", exact: true }).click();
      await expect(page.getByLabel("Workspace inspector", { exact: true })).toContainText(key);
      expect((await tracer.queryRelationships()).items).toHaveLength(0);
    }
    const browser = page.getByLabel("Project browser", { exact: true });
    await showProjectBrowser(page);
    await browser.locator(".workspace-items button").filter({ hasText: "INT-NEW" }).click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await inspector.getByText("Edit item", { exact: true }).click();
    await inspector.getByLabel("Workspace title", { exact: true }).fill("Retained parent draft");
    const refused = page.waitForEvent("dialog").then((confirmation) => confirmation.dismiss());
    await showProjectBrowser(page);
    await page.getByRole("button", { name: "Open created item", exact: true }).click();
    await refused;
    await expect(inspector.getByLabel("Workspace title", { exact: true })).toHaveValue(
      "Retained parent draft",
    );
    const accepted = page.waitForEvent("dialog").then((confirmation) => confirmation.accept());
    await showProjectBrowser(page);
    await page.getByRole("button", { name: "Open created item", exact: true }).click();
    await accepted;
    await expect(inspector).toContainText("REQ-NEW");
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    const mapping = page.getByRole("dialog", { name: "Record connection", exact: true });
    await mapping.getByLabel("Find mapping candidate", { exact: true }).fill("INT-NEW");
    await mapping.getByRole("button", { name: "Choose INT-NEW", exact: true }).click();
    await mapping.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(mapping).toHaveCount(0);
    expect((await tracer.queryRelationships()).items).toHaveLength(1);
    await page.reload();
    await showProjectBrowser(page);
    await openView(page, "Workspace");
    await expect(browser).toContainText("2 project items");
    await expect(page.locator(".workspace-lane")).toContainText(
      "1 / 1 incident connections loaded",
    );
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("conflicts and failed reads/writes retain captured mapping and item drafts without silent retry", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-workspace-failure-"));
  const fixture = await seedWorkspace(join(parent, "project"));
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(`${server.origin}/?item=${fixture.requirements[1].id}`);
    await openView(page, "Workspace");
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await inspector.getByText("Edit item", { exact: true }).click();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toBeEnabled();
    await inspector.getByLabel("Workspace statement", { exact: true }).fill("Preserved item draft");
    await page.route("**/api/family?**", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toBeDisabled();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
      "Preserved item draft",
    );
    await page.unroute("**/api/family?**");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toBeEnabled();
    await page.route("**/api/changesets", (route) => route.abort());
    await inspector.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("save may have completed");
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
      "Preserved item draft",
    );
    await page.unroute("**/api/changesets");
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await inspector.getByRole("button", { name: "Discard draft", exact: true }).click();
    await inspector.getByRole("button", { name: "Connect existing item", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Record connection", exact: true });
    await dialog.getByLabel("Mapping relationship", { exact: true }).selectOption("mapped_to");
    await dialog.getByLabel("Find mapping candidate", { exact: true }).fill("CODE-2");
    await dialog.getByRole("button", { name: "Choose CODE-2", exact: true }).click();
    await dialog.getByLabel("Draft scope", { exact: true }).fill("Preserved mapping scope");
    await dialog.getByLabel("Draft source_version", { exact: true }).fill("1");
    await dialog.getByLabel("Draft review", { exact: true }).fill("unreviewed");
    await dialog.getByRole("button", { name: "Change target", exact: true }).click();
    await dialog.getByLabel("Find mapping candidate", { exact: true }).fill("no-such-candidate");
    await expect(
      dialog.getByRole("button", { name: "Record connection", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Choose CODE-2", exact: true })).toHaveCount(0);
    await expect(
      dialog.getByText("No matches. Try another name or type.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Draft scope", { exact: true })).toHaveValue(
      "Preserved mapping scope",
    );
    await dialog.getByLabel("Find mapping candidate", { exact: true }).fill("CODE-2");
    await dialog.getByRole("button", { name: "Choose CODE-2", exact: true }).click();
    const source = fixture.requirements[1];
    await tracer.updateEntity(
      source.id,
      1,
      { fields: { ...source.fields, statement: "Concurrent edit" } },
      1,
      { actor: "other-editor" },
    );
    await dialog.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("conflict");
    await expect(dialog).toContainText("captured v1");
    await expect(dialog.getByLabel("Draft scope", { exact: true })).toHaveValue(
      "Preserved mapping scope",
    );
    expect((await tracer.queryRelationships({ type: "mapped_to" })).items).toHaveLength(3);
    await page.route("**/api/family?**", (route) => route.abort());
    // Refresh while preserving the selected target's captured tokens and values.
    await page.evaluate(() =>
      (
        Array.from(document.querySelectorAll("header button")).find(
          (button) => button.textContent === "Refresh current data",
        ) as HTMLButtonElement
      ).click(),
    );
    await expect(
      dialog.getByRole("button", { name: "Record connection", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("large project: off-page search and explicit bounded dense context", async ({ page }) => {
  test.setTimeout(90000);
  const parent = mkdtempSync(join(tmpdir(), "tracer-large-workspace-"));
  const fixture = await seedScaleProject(join(parent, "project"), "large");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    const browser = page.getByLabel("Project browser", { exact: true });
    await expect(browser.locator(".workspace-items tbody tr")).toHaveCount(30);
    await expect(browser).toContainText("10000 project items");
    await expect(browser.locator(".workspace-type-group")).toHaveCount(0);
    await expect(browser.getByRole("columnheader")).toHaveText([
      "Key",
      "Title",
      "Type",
      "Revision",
    ]);
    const firstIds = await browser.locator(".workspace-items button strong").allTextContents();
    const nativePage = await tracer.getWorkingSet({ limit: 30 });
    expect(firstIds).toEqual(nativePage.entities.items.map((entity) => entity.key));
    await showProjectBrowser(page);
    await browser.getByRole("button", { name: "Next items", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.stringify(await browser.locator(".workspace-items button strong").allTextContents()),
      )
      .not.toBe(JSON.stringify(firstIds));
    await showProjectBrowser(page);
    await browser.getByRole("button", { name: "Previous items", exact: true }).click();
    await expect
      .poll(async () => await browser.locator(".workspace-items button strong").allTextContents())
      .toEqual(firstIds);
    await showProjectBrowser(page);
    await browser.getByLabel("Find workspace items", { exact: true }).fill(fixture.tasks.dense!);
    const start = performance.now();
    await showProjectBrowser(page);
    await browser
      .locator(".workspace-items button")
      .filter({ hasText: fixture.tasks.dense! })
      .click();
    const result = await tracer.queryEntities({ key: fixture.tasks.dense });
    const root = result.items[0] as Entity;
    const context = await tracer.getFamily({ rootId: root.id });
    await expect(page.locator(".workspace-lane")).toContainText(
      `${context.connections[0].loaded} / ${context.connections[0].total} incident connections loaded`,
    );
    await expect(page.locator(".workspace-lane")).toContainText("more outside this view");
    expect(context.links.length).toBeLessThanOrEqual(200);
    console.log(
      JSON.stringify({
        workload: "10000 items / 100000 links",
        searchAndContextMs: Math.round(performance.now() - start),
        loaded: context.links.length,
        total: context.connections[0].total,
      }),
    );
    await page.screenshot({ path: "/tmp/tracer-workspace-large.png", fullPage: true });
    const outgoing = await tracer.queryRelationships({ source: root.id, limit: 1000 });
    const counts = new Map<string, number>();
    for (const link of outgoing.items) counts.set(link.type, (counts.get(link.type) ?? 0) + 1);
    const familyType = [...counts].sort((left, right) => right[1] - left[1])[0][0];
    const familyResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/family" && url.searchParams.get("direction") === "outgoing";
    });
    await (await familyControl(page, "Family scope")).selectOption(`outgoing:${familyType}`);
    const first = await (await familyResponse).json();
    expect(first.membership).toHaveLength(12);
    const nextResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/family" && url.searchParams.has("after");
    });
    await page.getByRole("button", { name: "Next family", exact: true }).click();
    const next = await (await nextResponse).json();
    expect(
      next.membership.some((link: { id: string }) =>
        first.membership.some((previous: { id: string }) => previous.id === link.id),
      ),
    ).toBe(false);
    await page.getByRole("button", { name: "Previous family", exact: true }).click();
    await expect(page.getByRole("button", { name: "Previous family", exact: true })).toBeDisabled();
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("unselected overview uses the working surface and selected rows stay readable", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-overview-browser-"));
  const fixture = await seedWorkspace(join(parent, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const longTitle =
    "The carrying assembly shall support positioning the instrument for the described task while preserving attachment inspection access, the intended grip and clearly stated limits under the recorded operating conditions.";
  const source = fixture.requirements[0];
  await tracer.updateEntity(
    source.id,
    source.version,
    { fields: { ...source.fields, title: longTitle } },
    1,
    { actor: "overview-regression" },
  );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    const browser = page.getByLabel("Project browser", { exact: true });
    const items = browser.locator(".workspace-items button");
    await expect(items).toHaveCount(12);
    await expect(page.getByLabel("Workspace inspector", { exact: true })).toHaveCount(0);
    await expect(page.locator(".workspace-surface")).toHaveCount(0);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      const workspaceBox = await browser.boundingBox();
      const rows = browser.locator(".workspace-items tbody tr");
      const rowBox = await rows.first().boundingBox();
      expect(rowBox!.width).toBeGreaterThan(380);
      expect(rowBox!.width).toBeGreaterThan(workspaceBox!.width * 0.9);
      const secondBox = await rows.nth(1).boundingBox();
      expect(secondBox!.y).toBeGreaterThan(rowBox!.y);
      expect(secondBox!.x).toBe(rowBox!.x);
      await expect(browser.getByRole("button", { name: "Next items" })).toHaveCount(0);
      await expect(browser.getByRole("button", { name: "Previous items" })).toHaveCount(0);
      await expect(browser).toContainText("12 of 12 project items");
      await expect(rows.filter({ hasText: "REQ-01" })).toContainText(longTitle);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await showProjectBrowser(page);
    await browser.getByLabel("Find workspace items", { exact: true }).fill("no-such-item");
    await expect(
      browser.getByRole("heading", { name: "No matching items", exact: true }),
    ).toBeVisible();
    await showProjectBrowser(page);
    await browser.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(items).toHaveCount(12);
    await showProjectBrowser(page);
    await browser.getByRole("button", { name: "New item", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create item", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    const row = items.filter({ hasText: "REQ-01" });
    await row.click();
    await expect(page.getByLabel("Workspace inspector", { exact: true })).toBeVisible();
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await showProjectBrowser(page);
    await expect
      .poll(async () => {
        const selectedBox = await row.boundingBox();
        const listBox = await row.locator("..").boundingBox();
        return (
          selectedBox!.y >= listBox!.y &&
          selectedBox!.y + selectedBox!.height <= listBox!.y + listBox!.height + 1
        );
      })
      .toBe(true);
    for (const hovered of [false, true]) {
      if (hovered) await row.hover();
      else await page.mouse.move(0, 0);
      const colors = await row.evaluate((element) => {
        const style = getComputedStyle(element);
        const nativeRow = element.closest("tr")!;
        const rowStyle = getComputedStyle(nativeRow);
        const root = getComputedStyle(document.documentElement);
        return {
          text: style.color,
          background: rowStyle.backgroundColor,
          selection: rowStyle.boxShadow,
          title: getComputedStyle(nativeRow.querySelector(".library-title")!).color,
          textToken: root.getPropertyValue("--color-text").trim(),
          mutedToken: root.getPropertyValue("--color-muted").trim(),
        };
      });
      expect(colors.text).toBe("rgb(230, 235, 232)");
      expect(colors.title).toBe(colors.text);
      await expect(row.locator("small")).toHaveCount(0);
      expect(colors.background).toBe("rgb(37, 55, 45)");
      expect(colors.selection).toContain("rgb(160, 217, 181)");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("software: inspect then explore relationships and return without reconstructing search", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-trace-navigation-"));
  const fixture = await seedWorkspace(join(parent, "project"), "software");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    const browser = page.getByLabel("Project browser", { exact: true });
    const search = browser.getByLabel("Find workspace items", { exact: true });
    await search.fill("Find services");
    await showProjectBrowser(page);
    await browser.locator(".workspace-items button").filter({ hasText: "INT-01" }).click();
    await expect(page.locator(".workspace-intent")).toHaveCount(0);
    await expect(page.locator(".workspace-lane")).toHaveCount(1);
    await page.getByRole("button", { name: "Inspect REQ-01", exact: true }).click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toBeHidden();
    await expect(page.locator(".workspace-bar h2")).toContainText("INT-01");
    await inspector
      .getByRole("button", { name: "Show relationships for REQ-01", exact: true })
      .click();
    await expect(page.locator(".workspace-bar h2")).toContainText("REQ-01");
    await expect(page.getByRole("button", { name: "Inspect CODE-1", exact: true })).toBeVisible();
    await expect(search).toHaveValue("Find services");
    await inspector.getByText("Edit item", { exact: true }).click();
    await inspector.getByLabel("Workspace statement", { exact: true }).fill("Retained trace draft");
    await expect(
      inspector.getByRole("button", { name: "Connect existing item", exact: true }),
    ).toBeDisabled();
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await page.getByRole("button", { name: /Hide details/ }).click();
    await page.getByRole("button", { name: /Show details/ }).click();
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
      "Retained trace draft",
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Return to relationships for INT-01", exact: true })
      .click();
    await expect(page.locator(".workspace-bar h2")).toContainText("REQ-01");
    await expect(inspector.getByLabel("Workspace statement", { exact: true })).toHaveValue(
      "Retained trace draft",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Return to relationships for INT-01", exact: true })
      .click();
    await expect(page.locator(".workspace-bar h2")).toContainText("INT-01");
    await expect(search).toHaveValue("Find services");
    await expect(page.getByRole("button", { name: "Inspect REQ-01", exact: true })).toBeVisible();
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("keyless authoring: single titles and declared incoming connection guidance", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-keyless-workspace-"));
  const repo = new SQLiteRepository(join(parent, "project.sqlite"));
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await openView(page, "Model");
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Starter structure", { exact: true }).selectOption("software");
    await page.getByRole("button", { name: "Save model", exact: true }).click();
    await openView(page, "Workspace");
    const browser = page.getByLabel("Project browser", { exact: true });
    const intentTitle = "Recover an interrupted venue search";
    const requirementTitle = "Retain search filters through interruption";
    for (const [type, title, statement] of [
      [
        "intent",
        intentTitle,
        "Let planners resume a venue search with date, location and capacity filters intact.",
      ],
      [
        "requirement",
        requirementTitle,
        "Retain date, location and capacity filters when the planner returns after interruption.",
      ],
    ]) {
      await showProjectBrowser(page);
      await browser.getByRole("button", { name: "New item", exact: true }).click();
      const create = page.getByRole("dialog", { name: "Create item", exact: true });
      await create.getByLabel("New item type", { exact: true }).selectOption(type);
      await create.getByLabel("Draft title", { exact: true }).fill(title);
      await create.getByLabel("Draft statement", { exact: true }).fill(statement);
      await create.getByRole("button", { name: "Create item", exact: true }).click();
      await expect(create).toHaveCount(0);
      const row = browser.locator(".workspace-items button").filter({ hasText: title });
      await expect(row).toHaveCount(1);
      expect((await row.innerText()).split(title)).toHaveLength(2);
      await expect(row.locator("strong")).toHaveCount(0);
      if (type === "intent") await row.click();
    }
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    const mapping = page.getByRole("dialog", { name: "Record connection", exact: true });
    await expect(mapping.getByLabel("Mapping direction")).toHaveValue("incoming");
    await expect(mapping.getByLabel("Mapping relationship")).toHaveValue("contributes_to");
    await expect(mapping.getByLabel("Find mapping candidate")).toBeVisible();
    await expect(
      mapping.getByRole("button", { name: "Record connection", exact: true }),
    ).toBeDisabled();
    await mapping.getByRole("button", { name: "Cancel", exact: true }).click();
    await showProjectBrowser(page);
    await browser.locator(".workspace-items button").filter({ hasText: requirementTitle }).click();
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    await mapping.getByLabel("Find mapping candidate", { exact: true }).fill("Recover");
    await mapping.getByRole("button", { name: `Choose ${intentTitle}`, exact: true }).click();
    await mapping.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(mapping).toHaveCount(0);
    const entities = (await tracer.getWorkingSet()).entities.items;
    const intent = entities.find((entity) => entity.type === "intent")!;
    const requirement = entities.find((entity) => entity.type === "requirement")!;
    const links = (await tracer.queryRelationships()).items;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      type: "contributes_to",
      source: requirement.id,
      target: intent.id,
    });
    await page.reload();
    await showProjectBrowser(page);
    await openView(page, "Workspace");
    await expect(browser).toContainText("2 project items");
    await expect(page.locator(".workspace-lane")).toContainText(
      "1 / 1 incident connections loaded",
    );
    await page.screenshot({
      path: "/tmp/tracer-ui-iterations-202605/round-3-repaired-recorded.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: "/tmp/tracer-ui-iterations-202605/round-3-repaired-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("engineering family comparison: visible shared mapping qualifiers and reversible inspection", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-family-comparison-"));
  const fixture = await seedWorkspace(join(parent, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await page
      .getByLabel("Project browser", { exact: true })
      .locator(".workspace-items button")
      .filter({ hasText: "INT-01" })
      .click();
    await (await familyControl(page, "Family scope")).selectOption("incoming:contributes_to");
    const groups = page.getByLabel("Shared connected items", { exact: true });
    const shared = groups
      .locator("article")
      .filter({ has: page.getByRole("button", { name: "Inspect DESIGN-1", exact: true }) });
    await expect(shared.locator(".workspace-connection")).toHaveCount(2);
    await expect(shared).toContainText(
      "Partial — browsing/positioning only; remaining scope unresolved",
    );
    await expect(shared).toContainText("Shared contribution; extent unreviewed");
    await expect(shared).toContainText("1 · current source v2");
    await expect(page.getByLabel("Family scope", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Workspace representation").getByRole("button")).toHaveCount(5);
    const box = await shared.boundingBox();
    expect(box).not.toBeNull();
    await expect(
      shared.getByRole("button", { name: "Inspect DESIGN-1", exact: true }),
    ).toBeInViewport();
    const requirement = page.locator(".workspace-lane").filter({ hasText: "REQ-01" });
    await expect(requirement.locator(".workspace-member-preview")).toBeVisible();
    await expect(requirement.locator(".workspace-member-preview")).toContainText(
      fixture.requirements[0].fields.title as string,
    );
    await expect(requirement.locator(".workspace-member-preview")).toContainText(
      "Preserve the surrounding task context.",
    );
    await shared.getByRole("button", { name: "Inspect DESIGN-1", exact: true }).click();
    await expect(page.locator(".workspace-lane.is-emphasized")).toHaveCount(2);
    await page.getByRole("button", { name: "Return to INT-01", exact: true }).click();
    await expect(page.getByLabel("Family scope", { exact: true })).toHaveValue(
      "incoming:contributes_to",
    );
    await switchFamilyView(page, "Coverage");
    const endpoint = requirement.getByRole("button", {
      name: "REQ-01 → DESIGN-1 · mapped to",
      exact: true,
    });
    await expect(endpoint).not.toContainText("Partial");
    await expect(endpoint.locator("..")).toContainText("1 · current source v2");
    await endpoint.click();
    await expect(page.getByLabel("Workspace inspector", { exact: true })).toContainText(
      "REQ-01 · current v2",
    );
    await switchFamilyView(page, "Relationships");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(shared.locator(".workspace-connection")).toHaveCount(2);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("long-form authoring expands in context and reads parent without changing draft owner", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-author-context-"));
  const fixture = await seedWorkspace(join(parent, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await page
      .getByLabel("Project browser", { exact: true })
      .locator(".workspace-items button")
      .filter({ hasText: "REQ-01" })
      .click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    const groups = page.getByLabel("Shared connected items", { exact: true });
    const before = await inspector.boundingBox();
    await inspector.getByText("Edit item", { exact: true }).click();
    await expect
      .poll(async () => (await inspector.boundingBox())!.width)
      .toBeGreaterThan(before!.width + 100);
    const statement = inspector.getByLabel("Workspace statement", { exact: true });
    const draft =
      "The carrying assembly must remain understandable in context while its attachment and handling requirements are revised. ".repeat(
        8,
      );
    await statement.fill(draft);
    expect((await statement.boundingBox())!.height).toBeGreaterThanOrEqual(300);
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await expect(
      groups.getByRole("button", { name: "Inspect INT-01", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".workspace-surface")).toContainText(
      "Connected-item Inspect is paused",
    );
    await groups.getByText("Read INT-01 details", { exact: true }).click();
    const intent = (await tracer.queryEntities({ type: "intent" })).items.find(
      (item) => item.key === "INT-01",
    )!;
    await expect(groups.locator("details[open]")).toContainText(String(intent.fields.statement));
    await expect(inspector.getByRole("heading", { name: "REQ-01", exact: true })).toBeVisible();
    await expect(statement).toHaveValue(draft);
    await openView(page, "Table");
    await openView(page, "Workspace");
    await expect(statement).toHaveValue(draft);
    await editableField(page, "Workspace statement");
    await inspector.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await expect(groups.getByRole("button", { name: "Inspect INT-01", exact: true })).toBeEnabled();
    const stored = page.locator(".workspace-lane details");
    await expect(stored.getByText("Stored statement", { exact: true })).toBeVisible();
    await expect(stored.locator("p")).toBeHidden();
    await stored.getByText("Stored statement", { exact: true }).click();
    await expect(stored.locator("p")).toHaveText(draft);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expect(statement).toHaveValue(draft);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("stored revisions show named before/current fields with raw snapshots collapsed", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-history-browser-"));
  const fixture = await seedWorkspace(join(parent, "project"), "software");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await showProjectBrowser(page);
    await page.getByPlaceholder("Key or content, across all pages").fill("REQ-01");
    await showProjectBrowser(page);
    await page.locator(".workspace-items button").filter({ hasText: "REQ-01" }).click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await inspector.getByText("Stored revision history · REQ-01", { exact: true }).click();
    const earlier = inspector.getByRole("region", { name: "Stored v1", exact: true });
    const current = inspector.getByRole("region", { name: "Stored v2", exact: true });
    await expect(earlier).toContainText("project revision");
    await expect(current).toContainText("· current");
    await expect(current.locator(":scope > dl dt")).toHaveText(["statement · changed"]);
    const values = current.locator(":scope > dl dd");
    await expect(values).toHaveCount(2);
    await expect(values.nth(0)).toContainText("Before · v1");
    await expect(values.nth(0)).not.toContainText("Preserve the surrounding task context.");
    await expect(values.nth(1)).toContainText("Stored · v2");
    await expect(values.nth(1)).toContainText("Preserve the surrounding task context.");
    await expect(inspector.locator(".workspace-revision pre").first()).toBeHidden();
    await expect(
      current.getByText("Unchanged fields", { exact: true }).locator(".."),
    ).not.toHaveAttribute("open", "");
    await current.getByText("Unchanged fields", { exact: true }).click();
    await expect(current.locator("dt")).toContainText(["statement · changed", "title", "notes"]);
    await current.getByText("Raw snapshot", { exact: true }).click();
    await expect(current.locator("pre")).toContainText('"version": 2');
    await expect(current.locator("pre")).toContainText(fixture.requirements[0].id);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(values.nth(1)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("connection confirmation: compact captured endpoints, change target and reachable controls", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-connection-confirmation-"));
  const fixture = await seedWorkspace(join(parent, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin);
    await openView(page, "Workspace");
    await showProjectBrowser(page);
    await page.locator(".workspace-items button").filter({ hasText: "REQ-03" }).click();
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Record connection", exact: true });
    await dialog.getByLabel("Mapping relationship").selectOption("mapped_to");
    await dialog.getByLabel("Find mapping candidate").fill("DESIGN");
    await dialog.getByRole("button", { name: "Choose DESIGN-1", exact: true }).click();
    await expect(dialog.getByLabel("Find mapping candidate")).toHaveCount(0);
    const source = dialog.locator(".workspace-captured-item").first();
    const requirement = fixture.requirements.find((item) => item.key === "REQ-03")!;
    await expect(source.locator(".workspace-captured-statement")).toHaveCount(1);
    await dialog
      .getByLabel("Draft scope", { exact: true })
      .fill("Grip interface only; task suitability not evaluated");
    await expect(
      dialog.locator("label").filter({ hasText: "REQ-03 source version" }),
    ).toBeVisible();
    await dialog.getByLabel("Draft source_version", { exact: true }).fill("1");
    await dialog.getByLabel("Draft review", { exact: true }).fill("unreviewed");
    await dialog.getByRole("button", { name: "Change target", exact: true }).click();
    await expect(dialog.getByLabel("Find mapping candidate")).toHaveValue("DESIGN");
    await dialog.getByRole("button", { name: "Choose DESIGN-1", exact: true }).click();
    await expect(dialog.getByLabel("Draft scope", { exact: true })).toHaveValue(
      "Grip interface only; task suitability not evaluated",
    );
    await expect(dialog.getByLabel("Connection direction")).toHaveText(
      "REQ-03 · captured v1 → mapped to → DESIGN-1 · captured v1",
    );
    await page.screenshot({
      path: "/tmp/tracer-ui-iterations-202605/round-7-repaired-desktop.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.getByLabel("Draft review", { exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    await expect(
      dialog.getByRole("button", { name: "Record connection", exact: true }),
    ).toBeInViewport();
    await expect(dialog.getByLabel("Connection direction")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: "/tmp/tracer-ui-iterations-202605/round-7-repaired-mobile.png" });
    await dialog.getByRole("button", { name: "Record connection", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = (
      await tracer.queryRelationships({ source: requirement.id, type: "mapped_to" })
    ).items.find((link) => link.target === fixture.outputs[0].id)!;
    expect(saved.fields).toMatchObject({
      scope: "Grip interface only; task suitability not evaluated",
      source_version: 1,
      review: "unreviewed",
    });
    await page.getByRole("button", { name: /^Show details/ }).click();
    await page.getByRole("button", { name: "Connect existing item", exact: true }).click();
    await dialog.getByLabel("Mapping relationship").selectOption("mapped_to");
    await dialog.getByLabel("Draft scope", { exact: true }).fill("Unsaved attempt");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("stacked keyboard selection reaches context and returns without losing filters or drafts", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-keyboard-context-"));
  const fixture = await seedWorkspace(join(parent, "project"), "software");
  const repo = new SQLiteRepository(fixture.database),
    tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 640, height: 450 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(server.origin);
      await openView(page, "Workspace");
      const browser = page.getByLabel("Project browser", { exact: true });
      await expect(browser).toContainText("22 project items");
      await expect(page.locator(".workspace-surface")).toHaveCount(0);
      await expect(browser.getByRole("button", { name: "Go to selected context" })).toHaveCount(0);
      const search = browser.getByLabel("Find workspace items", { exact: true });
      await search.fill("REQ");
      await showProjectBrowser(page);
      await browser.getByLabel("Workspace type", { exact: true }).selectOption("requirement");
      await expect(browser.locator(".workspace-items tbody tr")).toHaveCount(8);
      const card = browser.locator(".workspace-items button").filter({ hasText: "REQ-07" });
      await card.focus();
      await page.keyboard.press("Enter");
      const heading = page.getByRole("heading", { name: "REQ-07 context", exact: true });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(browser).toBeHidden();
      const box = await heading.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      // Scope entry stays within the persistent project frame; item inspection
      // has its own focused reading stage verified by studio-reading.

      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Inspect starting item REQ-07", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      const back = page.getByRole("button", { name: "Return to project items", exact: true });
      await expect(back).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(card).toBeFocused();
      await expect(search).toHaveValue("REQ");
      await expect(browser.getByLabel("Workspace type", { exact: true })).toHaveValue(
        "requirement",
      );
      const inspector = page.getByLabel("Workspace inspector", { exact: true });
      await editableField(page, "Workspace statement");
      const statement = inspector.getByLabel("Workspace statement", { exact: true });
      await statement.fill("Keyboard draft retained while returning to the list.");
      await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
      await back.click();
      await expect(card).toBeFocused();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(heading).toBeFocused();
      await expect(statement).toHaveValue("Keyboard draft retained while returning to the list.");
      await showProjectBrowser(page);
      await search.fill("no-such-item");
      await expect(
        browser.getByRole("heading", { name: "No matching items", exact: true }),
      ).toBeVisible();
      await back.click();
      await expect(
        browser.getByRole("heading", { name: "Items · requirement", exact: true }),
      ).toBeFocused();
      await expect(statement).toHaveValue("Keyboard draft retained while returning to the list.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    }
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
