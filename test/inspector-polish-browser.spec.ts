import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test as base, expect, closeTestPage, type Page } from "./browser-test.ts";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

type Fixture = {
  app: {
    origin: string;
    tracer: Tracer;
    entities: Awaited<ReturnType<typeof seedRealisticProject>>["entities"];
    errors: string[];
  };
};
const test = base.extend<Fixture>({
  app: async ({ page }, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-inspector-polish-"));
    const fixture = await seedRealisticProject(join(directory, "project"), "medical");
    const repository = new SQLiteRepository(fixture.database);
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await use({ origin: server.origin, tracer, entities: fixture.entities, errors });
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function selectArtifact(page: Page, key: string) {
  await expect(page.locator(".node").first()).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await page.locator('[data-action="details"]').click();
  const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
  if (await expand.isVisible()) await expand.click();
}

for (const width of [1440, 680, 390]) {
  test(`inspector retains draft fields, reading position and keyboard focus at ${width}px`, async ({
    page,
    app,
  }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(app.origin);
    await expect(page.locator(".node").first()).toBeVisible();
    await selectArtifact(page, "PRS-01");
    await page.keyboard.press("Control+k");
    await page.locator("#search").fill("pressure");
    await page.screenshot({ path: info.outputPath("search.png") });
    await page.keyboard.press("Escape");
    const original = await app.tracer.getEntity(app.entities["PRS-01"].id);
    const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
    const editStatement = page.getByRole("button", { name: "Edit statement", exact: true });
    await editStatement.click();
    await expect(page.locator("[data-inspector-draft-status]")).toHaveText("No changes yet");
    await page.locator("#inline-value").press("Escape");
    await expect(editStatement).toBeFocused();
    await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
    await page.locator("#draft-title").fill("Pending title retained in this tab");
    await page.locator("#draft-statement").fill("Revised statement saved independently.");
    await expect(page.locator("[data-inspector-draft-status]")).toHaveText("Unsaved changes");
    await page.locator('[data-view="matrix"]').click();
    await page.locator('[data-view="graph"]').click();
    await expect(page.locator("#draft-title")).toHaveValue("Pending title retained in this tab");
    await selectArtifact(page, "SYS-03");
    await selectArtifact(page, "PRS-01");
    await expect(page.locator(".retained-artifact-draft")).toContainText(
      "Unsaved edits in this tab",
    );
    await editStatement.click();
    const input = page.locator("#inline-value");
    await expect(input).toHaveValue("Revised statement saved independently.");
    await page.screenshot({ path: info.outputPath("statement-editor.png") });
    await input.press("Control+Enter");
    await expect(editStatement).toBeFocused();
    const saved = await app.tracer.getEntity(original.id);
    expect(saved.fields.title).toBe(original.fields.title);
    expect(saved.fields.statement).toBe("Revised statement saved independently.");
    await expect(page.getByRole("button", { name: "Resume editing", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit acceptance criterion", exact: true }).click();
    await page.locator("#inline-value").fill("Only this field should be cancelled.");
    await page.locator("#inline-value").press("Escape");
    await page.getByRole("button", { name: "Resume editing", exact: true }).click();
    await expect(page.locator("#draft-title")).toHaveValue("Pending title retained in this tab");
    await page.locator("#draft-title").press("Escape");
    await expect(page.getByRole("button", { name: "Edit artifact", exact: true })).toBeFocused();
    await expect(page.locator(".retained-artifact-draft")).toHaveCount(0);
    const panel = page.getByLabel("Artifact inspector", { exact: true });
    await panel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const scroll = await panel.evaluate((element) => element.scrollTop);
    expect(scroll).toBeGreaterThan(0);
    const camera = await page.locator(".scene").getAttribute("style");
    await page.locator('[data-view="matrix"]').click();
    await page.locator('[data-view="history"]').click();
    await page.locator('[data-view="graph"]').click();
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(scroll);
    await expect(page.locator(".scene")).toHaveAttribute("style", camera!);
    const inspectLink = page.getByRole("button", {
      name: "Inspect relationship PRS-01 to SYS-03",
      exact: true,
    });
    await inspectLink.scrollIntoViewIfNeeded();
    const linkScroll = await panel.evaluate((element) => element.scrollTop);
    await inspectLink.click();
    await expect(page.getByLabel("Relationship inspector", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit relationship scope", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Relationship scope", exact: true })
      .press("Control+Enter");
    await expect(
      page.getByRole("button", { name: "Edit relationship scope", exact: true }),
    ).toBeFocused();
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    await page.getByRole("button", { name: "Back to artifact", exact: false }).click();
    await expect(inspectLink).toBeFocused();
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(linkScroll);
    await editStatement.click();
    await input.fill("Unsaved preview of the polished inspector.");
    await expect(page.locator("[data-apply-field]")).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath("inspector.png") });
    await input.press("Escape");
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    expect(app.errors).toEqual([]);
  });

  test(`relationship search resolves titles to exact compatible targets at ${width}px`, async ({
    page,
    app,
  }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(app.origin);
    await expect(page.locator(".node").first()).toBeVisible();
    await selectArtifact(page, "PRS-01");
    const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    const form = page.locator("#connection-form");
    const target = page.getByRole("combobox", { name: "Target", exact: true });
    await expect(target).toBeFocused();
    await expect(page.locator("#connection-source-summary")).toContainText(
      "Report a completed measurement",
    );
    await target.fill("Acquire calibrated pressure samples");
    await expect(form.locator(".form-error")).toHaveText("");
    await expect(page.locator("[data-connection-candidate]")).toHaveCount(1);
    await target.press("Enter");
    await expect(target).toHaveValue("SYS-01");
    await expect(form).toBeVisible();
    await expect(target).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#connection-target-status")).toContainText(
      "SYS-01 · Acquire calibrated pressure samples",
    );
    await form
      .locator('[name="scope"]')
      .fill("Additional recorded allocation for this fictional example.");
    await page.screenshot({ path: info.outputPath("connection.png") });
    await form.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.locator("#workspace-dialog")).not.toBeVisible();
    await expect(page.getByLabel("Relationship inspector", { exact: true })).toContainText(
      "PRS-01",
    );
    await expect(page.getByLabel("Relationship inspector", { exact: true })).toContainText(
      "SYS-01",
    );
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    await page.getByRole("button", { name: "Back to artifact", exact: false }).click();
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    await target.fill("no matching artifact 83912");
    await expect(page.locator("#connection-target-status")).toContainText(
      "No compatible artifacts match",
    );
    await expect(form.getByRole("button", { name: "Connect", exact: true })).toBeDisabled();
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add relationship", exact: true })).toBeFocused();
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    expect(app.errors).toEqual([]);
  });
}

test("resize preserves an inspector caret and pending saves cannot be cancelled or duplicated", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await selectArtifact(page, "PRS-01");
  await page.getByRole("button", { name: "Edit statement", exact: true }).click();
  const input = page.locator("#inline-value");
  await input.fill("One guarded save from a retained editor.");
  await input.press("Home");
  await input.press("ArrowRight");
  const caret = await input.evaluate((element) => (element as HTMLTextAreaElement).selectionStart);
  await page.setViewportSize({ width: 900, height: 1000 });
  await expect(input).toBeFocused();
  expect(await input.evaluate((element) => (element as HTMLTextAreaElement).selectionStart)).toBe(
    caret,
  );
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/api/changesets", async (route) => {
    writes++;
    await pending;
    await route.continue();
  });
  await input.press("Control+Enter");
  await expect(page.locator("[data-apply-field]")).toHaveText("Saving…");
  await expect(input).toHaveAttribute("readonly", "");
  await expect(page.locator('[data-action="cancel-inline"]')).toBeDisabled();
  await input.press("Escape");
  await input.press("Control+Enter");
  await expect(input).toBeVisible();
  expect(writes).toBe(1);
  release();
  await expect(page.locator("#inline-value")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit statement", exact: true })).toBeFocused();
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
  expect(app.errors).toEqual([]);
});

test("opening and saving a clean optional-field draft neither warns on reload nor adds a revision", async ({
  page,
  app,
}) => {
  const original = await app.tracer.getEntity(app.entities["PRS-01"].id);
  const fields = { ...original.fields };
  delete fields.acceptance;
  const schema = (await app.tracer.getSchema())!;
  const clean = await app.tracer.createEntity(
    { key: "PRS-CLEAN", type: original.type, fields },
    schema.version,
    { actor: "inspector test" },
  );
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await selectArtifact(page, "PRS-CLEAN");
  await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
  let warnings = 0;
  page.on("dialog", async (dialog) => {
    warnings++;
    await dialog.dismiss();
  });
  await page.reload();
  await expect(page.locator(".node").first()).toBeVisible();
  expect(warnings).toBe(0);
  await selectArtifact(page, "PRS-CLEAN");
  await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
  await page.locator('[data-action="apply-edit"]').click();
  await expect(page.locator(".workspace-notice")).toContainText("No changes to save");
  expect((await app.tracer.getEntity(clean.id)).fields).not.toHaveProperty("acceptance");
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
  expect(app.errors).toEqual([]);
});

test("saving one field retains the confirmed version when another actor edits before refresh", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await selectArtifact(page, "PRS-01");
  await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
  await page.locator("#draft-title").fill("Retained title proposal");
  await page.locator("#draft-statement").fill("Confirmed statement update");
  await selectArtifact(page, "SYS-03");
  await selectArtifact(page, "PRS-01");
  await page.getByRole("button", { name: "Edit statement", exact: true }).click();
  let intervened = false;
  await page.route("**/api/project-snapshot", async (route) => {
    if (!intervened) {
      intervened = true;
      const current = await app.tracer.getEntity(app.entities["PRS-01"].id);
      await app.tracer.updateEntity(
        current.id,
        current.version,
        { fields: { ...current.fields, title: "Another actor's title" } },
        (await app.tracer.getSchema())!.version,
        { actor: "concurrent inspector test" },
      );
    }
    await route.continue();
  });
  await page.locator("#inline-value").press("Control+Enter");
  await expect(page.getByRole("button", { name: "Resume editing", exact: true })).toBeVisible();
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  await page.getByRole("button", { name: "Resume editing", exact: true }).click();
  await expect(page.locator("#draft-title")).toHaveValue("Retained title proposal");
  await page.locator("#draft-title").press("Control+Enter");
  await expect(page.locator(".workspace-notice")).toContainText("older version");
  expect((await app.tracer.getEntity(app.entities["PRS-01"].id)).fields.title).toBe(
    "Another actor's title",
  );
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
  await page.locator("#draft-title").press("Escape");
  expect(app.errors).toEqual([]);
});

test("a pending connection keeps its exact proposal and cannot be dismissed as a cancellation", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await selectArtifact(page, "PRS-01");
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  const form = page.locator("#connection-form");
  await page.locator("#connection-target").fill("SYS-01");
  await form.locator('[name="scope"]').fill("Retained exact connection proposal");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/changesets", async (route) => {
    await pending;
    await route.continue();
  });
  await form.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(form.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Close dialog", exact: true })).toBeDisabled();
  await expect(page.locator("#connection-target")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(form).toBeVisible();
  release();
  await expect(page.locator("#workspace-dialog")).not.toBeVisible();
  await expect(page.getByLabel("Relationship inspector", { exact: true })).toContainText(
    "Retained exact connection proposal",
  );
  expect(app.errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`connection keyboard navigation wraps and ignores composition at ${width}px`, async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(app.origin);
    await selectArtifact(page, "PRS-01");
    const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    const target = page.getByRole("combobox", { name: "Target", exact: true });
    const candidates = page.locator("[data-connection-candidate]");
    expect(await candidates.count()).toBeGreaterThan(1);
    await target.press("ArrowUp");
    await expect(candidates.last()).toHaveAttribute("aria-selected", "true");
    await expect(target).toBeFocused();
    await target.press("ArrowDown");
    await expect(candidates.first()).toHaveAttribute("aria-selected", "true");
    await target.dispatchEvent("keydown", { key: "ArrowDown", isComposing: true });
    await target.press("Control+ArrowDown");
    await expect(candidates.first()).toHaveAttribute("aria-selected", "true");
    await target.dispatchEvent("keydown", { key: "Enter", isComposing: true });
    await expect(target).toHaveValue("");
    await target.press("ArrowUp");
    await target.fill("pressure");
    await expect(candidates.first()).toBeInViewport({ ratio: 1 });
    await target.press("ArrowDown");
    const key = await candidates.nth(1).getAttribute("data-connection-candidate");
    await target.press("Enter");
    await expect(target).toHaveValue(key!);
    await expect(target).not.toHaveAttribute("aria-activedescendant");
    await expect(target).toBeFocused();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add relationship", exact: true })).toBeFocused();
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
    expect(app.errors).toEqual([]);
  });

  test(`graph relationship keyboard inspection returns focus without a connection row at ${width}px`, async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(app.origin);
    await selectArtifact(page, "PRS-01");
    const edge = page.locator('.edgehit:not([aria-label*="PRS-01"])').first();
    await edge.focus();
    await edge.press("Enter");
    const back = page.getByRole("button", { name: "Back to artifact", exact: false });
    await expect(back).toBeFocused();
    await back.press("Enter");
    await expect(page.locator("#artifact-heading")).toBeFocused();
    await expect(page.locator("#artifact-heading")).toHaveText("Report a completed measurement");
    // SVG paths are dialog openers too, including when resize replaces the path.
    const path = page.locator(".edgehit").first();
    const name = await path.getAttribute("aria-label");
    await path.focus();
    await page.keyboard.press("Control+k");
    await expect(page.locator("#search")).toBeFocused();
    const opener = await path.elementHandle();
    await page.setViewportSize({ width: width + 10, height: width === 390 ? 844 : 1000 });
    await expect.poll(() => opener!.evaluate((element) => element.isConnected)).toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: name!, exact: true })).toBeFocused();
    expect(app.errors).toEqual([]);
  });
}

test("dialog cancellation restores its logical opener after a workspace resize", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.origin);
  await selectArtifact(page, "PRS-01");
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  const opener = await page
    .getByRole("button", { name: "Add relationship", exact: true })
    .elementHandle();
  await page.setViewportSize({ width: 1380, height: 960 });
  await expect.poll(() => opener!.evaluate((element) => element.isConnected)).toBe(false);
  await page.getByRole("combobox", { name: "Target", exact: true }).fill("pressure");
  await page.keyboard.press("Escape");
  await expect(page.locator("#workspace-dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Add relationship", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#connection-form")).toBeVisible();
  expect(app.errors).toEqual([]);
});

for (const width of [1440, 680, 390]) {
  test(`inspector replacement and cached-page return discard detached bindings at ${width}px`, async ({
    page,
    app,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(app.origin);
    await selectArtifact(page, "PRS-01");
    const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
    const oldRelated = await page.locator(".inspector [data-related]").first().elementHandle();
    const oldHistory = await page
      .locator(".inspector [data-artifact-event]")
      .first()
      .elementHandle();
    const oldResize = await page.$(".inspector-resize");
    await page.getByRole("button", { name: "Edit statement", exact: true }).click();
    const input = page.locator("#inline-value");
    await input.fill("Draft survives inspector binding replacement.");
    const oldInput = await input.elementHandle();
    const oldSave = await page.locator("[data-apply-field]").elementHandle();
    const oldCancel = await page.locator('[data-action="cancel-inline"]').elementHandle();
    await page.setViewportSize({ width: width + 1, height: 1000 });
    await expect.poll(() => oldInput!.evaluate((element) => element.isConnected)).toBe(false);
    for (const element of [oldRelated, oldHistory, oldSave, oldCancel]) {
      await element!.evaluate((node) =>
        node.dispatchEvent(new MouseEvent("click", { bubbles: true })),
      );
    }
    await oldInput!.evaluate((node) => {
      if (!(node instanceof HTMLTextAreaElement)) throw new Error("Expected the statement editor");
      node.value = "Detached input must not overwrite the retained draft.";
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
      );
    });
    if (oldResize)
      await oldResize.evaluate((node) =>
        node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })),
      );
    await expect(input).toHaveValue("Draft survives inspector binding replacement.");
    await expect(page.locator(".inspector")).toHaveAttribute(
      "data-inspector-context",
      /artifact:PRS-01:/,
    );
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);

    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
    );
    await page.locator("[data-apply-field]").dispatchEvent("click");
    await page.locator('[data-action="cancel-inline"]').dispatchEvent("click");
    await input.dispatchEvent("keydown", { key: "Enter", ctrlKey: true });
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
    await expect(input).toHaveValue("Draft survives inspector binding replacement.");
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    );
    await expect(input).toHaveValue("Draft survives inspector binding replacement.");
    await input.press("Control+Enter");
    await expect(page.getByRole("button", { name: "Edit statement", exact: true })).toContainText(
      "Draft survives inspector binding replacement.",
    );
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    await page.locator(".inspector [data-inspect-link]").first().click();
    await page.locator("[data-edit-relationship-scope]").click();
    const scope = page.locator("#relationship-scope-form textarea");
    await scope.fill("Relationship draft survives binding replacement.");
    const oldScope = await scope.elementHandle();
    const oldForm = await page.locator("#relationship-scope-form").elementHandle();
    const oldScopeCancel = await page.locator("[data-cancel-relationship-scope]").elementHandle();
    await page.setViewportSize({ width: width + 2, height: 1000 });
    await expect.poll(() => oldScope!.evaluate((element) => element.isConnected)).toBe(false);
    await oldForm!.evaluate((form) =>
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    await oldScopeCancel!.evaluate((button) =>
      button.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await oldScope!.evaluate((node) => {
      if (!(node instanceof HTMLTextAreaElement)) throw new Error("Expected the scope editor");
      node.value = "Detached scope must not overwrite the retained draft.";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(scope).toHaveValue("Relationship draft survives binding replacement.");
    await scope.press("Escape");
    await expect(page.locator("[data-edit-relationship-scope]")).toBeFocused();
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision + 1);
    expect(app.errors).toEqual([]);
  });
}

test("Matrix grid owns cell editing while relationship tables retain direct inspection", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.origin + "/?view=matrix");
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  await page.locator('[data-grid-col="1"] [data-grid-artifact]').first().dblclick();
  await expect(page.locator("#matrix-cell-form")).toHaveAttribute(
    "aria-label",
    "Replace relationship target",
  );
  await expect(page.locator(".chosen-target")).toContainText("SYS-03");
  await page.locator("[data-cell-cancel]").click();
  await expect(page.locator('[data-grid-row="0"][data-grid-col="1"]')).toBeFocused();
  await page.locator('[data-matrix-mode="relationships"]').click();
  const edge = page.locator(".matrix table:not([role=grid]) [data-matrix-edge]").first();
  const id = await edge.getAttribute("data-matrix-edge");
  await edge.click();
  await expect(page.locator(".relationship-inspector")).toHaveAttribute(
    "data-inspector-context",
    `relationship:${id}`,
  );
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
  expect(app.errors).toEqual([]);
});
