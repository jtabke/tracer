import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { openView } from "./browser-navigation.ts";

const screenshots = "/tmp/tracer-model-configuration";

test("Visual/Text configure one draft: fields, port connections, arrangement, invalid JSON and captured save conflicts", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-visual-config-"));
  const fixture = await seedWorkspace(join(dir, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database);
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(screenshots, { recursive: true });
  try {
    const head = (await tracer.timeline()).head;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${server.origin}/?view=model`);
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    const editor = page.getByLabel("Configure project model", { exact: true });
    const visual = editor.getByRole("button", { name: "Visual", exact: true });
    const text = editor.getByRole("button", { name: "Text", exact: true });
    await expect(visual).toHaveAttribute("aria-pressed", "true");
    await expect(editor.locator(".schema-properties")).toBeHidden();
    await editor.getByRole("button", { name: "Select type · requirement", exact: true }).click();
    await editor.getByLabel("New field name", { exact: true }).fill("budget");
    await editor.getByRole("button", { name: "Add field", exact: true }).click();
    await editor.getByLabel("Field type · budget", { exact: true }).selectOption("number");
    await text.click();
    await editor.getByLabel("Advanced JSON", { exact: true }).check();
    const json = editor.getByLabel("Project schema JSON", { exact: true });
    const draft = JSON.parse(await json.inputValue());
    expect(draft.entityTypes.requirement.fields.budget.type).toBe("number");
    draft.entityTypes.review_note = { fields: {} };
    await json.fill(JSON.stringify(draft, null, 2));
    await visual.click();
    await editor.getByRole("button", { name: /Return to .* draft flow/ }).click();
    await expect(
      editor.getByRole("button", { name: "Select type · review_note", exact: true }),
    ).toBeVisible();
    await editor.getByRole("button", { name: "Connect from requirement", exact: true }).click();
    await editor.getByRole("button", { name: "Connect to review_note", exact: true }).click();
    const connection = editor.getByRole("form", { name: "Link model types", exact: true });
    await connection.getByLabel("Connection name", { exact: true }).fill("informs_review");
    await text.click();
    const updated = JSON.parse(await json.inputValue());
    updated.entityTypes.review_note.fields.note = { type: "string" };
    await json.fill(JSON.stringify(updated, null, 2));
    await visual.click();
    await expect(connection.getByLabel("Connection name", { exact: true })).toHaveValue(
      "informs_review",
    );
    await connection.getByRole("button", { name: "Add connection", exact: true }).click();
    await expect(connection).toHaveCount(0);
    await expect(editor.locator(".model-flow-route")).toHaveCount(1);
    expect((await tracer.getSchema())?.version).toBe(1);
    expect((await tracer.timeline()).head).toBe(head);
    await text.click();
    const merged = JSON.parse(await json.inputValue());
    expect(merged.entityTypes.review_note.fields.note.type).toBe("string");
    expect(merged.relationshipTypes.informs_review).toEqual({
      source: ["requirement"],
      target: ["review_note"],
      fields: {},
      workflow: [
        {
          source: "requirement",
          target: "review_note",
          direction: "forward",
          label: "informs review",
        },
      ],
    });
    await json.fill("{unfinished");
    await visual.click();
    await expect(text).toHaveAttribute("aria-pressed", "true");
    await expect(json).toBeFocused();
    await expect(json).toHaveValue("{unfinished");
    await expect(editor.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
    await json.fill(JSON.stringify(merged, null, 2));
    await visual.click();
    await editor.getByRole("button", { name: /Return to .* draft flow/ }).click();
    const requirement = editor.getByRole("button", {
      name: "Select type · requirement",
      exact: true,
    });
    const before = await requirement.locator("..").getAttribute("style");
    await requirement.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect(requirement.locator("..")).not.toHaveAttribute("style", before!);
    const note = editor.getByRole("button", { name: "Select type · review_note", exact: true });
    const noteBefore = await note.locator("..").getAttribute("style");
    await note.dragTo(editor.locator(".model-flow-canvas"), { targetPosition: { x: 260, y: 110 } });
    await expect(note.locator("..")).not.toHaveAttribute("style", noteBefore!);
    await text.click();
    await visual.click();
    await expect(note.locator("..")).not.toHaveAttribute("style", noteBefore!);
    await page.screenshot({ path: join(screenshots, "visual-1440.png") });
    await editor.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const saved = (await tracer.getSchema())!;
    expect(saved.version).toBe(2);
    expect(saved.entityTypes.requirement.fields.budget.type).toBe("number");
    expect(saved.entityTypes.review_note.fields.note.type).toBe("string");
    expect(saved.relationshipTypes.informs_review.target).toEqual(["review_note"]);
    expect((await tracer.timeline()).head).toBe(head + 1);
    await page.reload();
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await editor.getByLabel("Workflow connection", { exact: true }).selectOption("informs_review");
    await editor
      .getByRole("group", { name: "Sources", exact: true })
      .getByLabel("design", { exact: true })
      .check();
    await text.click();
    await editor.getByLabel("Advanced JSON", { exact: true }).check();
    expect(JSON.parse(await json.inputValue()).relationshipTypes.informs_review.source).toEqual([
      "requirement",
      "design",
    ]);
    await visual.click();
    await expect(editor.locator(".model-flow-route")).toHaveCount(1);
    await editor.getByRole("button", { name: /Return to .* draft flow/ }).click();
    await editor.getByRole("button", { name: "Trace connections", exact: true }).click();
    await expect(editor.locator(".model-flow-route")).toHaveCount(2);
    await tracer.setSchema(
      { entityTypes: saved.entityTypes, relationshipTypes: saved.relationshipTypes },
      2,
      { actor: "visual-config-conflict" },
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await editor.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("conflict");
    await expect(editor).toContainText("Based on schema v2");
    await openView(page, "Project");
    await openView(page, "Model");
    await expect(editor.locator(".model-flow-route")).toHaveCount(2);
    for (const width of [2560, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: join(screenshots, `visual-${width}.png`) });
    }
    expect((await tracer.getSchema())?.relationshipTypes.informs_review.source).toEqual([
      "requirement",
    ]);
    page.once("dialog", (dialog) => dialog.accept());
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project model", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
