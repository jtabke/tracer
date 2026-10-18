import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test as base, expect, closeTestPage } from "./browser-test.ts";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

type WorkspaceFixture = {
  app: {
    origin: string;
    tracer: Tracer;
    fixture: Awaited<ReturnType<typeof seedWorkspace>>;
    errors: string[];
  };
};
const test = base.extend<WorkspaceFixture>({
  app: async ({ page }, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-input-lifetime-"));
    const fixture = await seedWorkspace(join(directory, "project"), "engineering");
    const repository = new SQLiteRepository(fixture.database),
      tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await use({ origin: server.origin, tracer, fixture, errors });
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

test("graph replacement cancels delayed selection and detached handlers; blur ends active pan", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await page.keyboard.press("/");
  await page.locator("#search").fill(app.fixture.requirements[0].key!);
  await page.locator(`[data-result="${app.fixture.requirements[0].key}"]`).click();
  await page.locator('[data-node-action="expand"]').click();
  const selected = await page.locator('.node[aria-pressed="true"]').getAttribute("data-key");
  const old = await page.locator('.node[aria-pressed="false"]').first().elementHandle();
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  // A resize replaces the canvas before the pointer single-click delay expires.
  await old!.evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
    window.dispatchEvent(new Event("resize"));
  });
  await page.clock.runFor(350);
  expect(await old!.evaluate((node) => node.isConnected)).toBe(false);
  await expect(page.locator('.node[aria-pressed="true"]')).toHaveAttribute("data-key", selected!);
  // Retained references to removed DOM cannot invoke selection or neighborhood actions.
  await old!.evaluate((node) => {
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    node.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
  });
  await expect(page.locator('.node[aria-pressed="true"]')).toHaveAttribute("data-key", selected!);
  const pending = page.locator('.node[aria-pressed="false"]').first();
  await pending.dispatchEvent("click", { detail: 1 });
  await page.keyboard.press("/");
  await page.clock.runFor(350);
  await expect(page.locator('.node[aria-pressed="true"]')).toHaveAttribute("data-key", selected!);
  await page.keyboard.press("Escape");
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-view="matrix"]').click();
    await page.locator('[data-view="graph"]').click();
  }
  const canvas = page.locator(".canvas"),
    scene = page.locator(".scene");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height - 120);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(bounds.x + 60, bounds.y + bounds.height - 80);
  await expect(canvas).toHaveClass(/panning/);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).not.toHaveClass(/panning/);
  const camera = await scene.getAttribute("style");
  await page.mouse.move(bounds.x + 120, bounds.y + bounds.height - 40);
  await expect(scene).toHaveAttribute("style", camera!);
  await page.mouse.up({ button: "middle" });
  await page.clock.runFor(160);
  const target = page.locator('.node[aria-pressed="false"]').first();
  const key = await target.getAttribute("data-key");
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.node[aria-pressed="true"]')).toHaveAttribute("data-key", key!);
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
  expect(app.errors).toEqual([]);
});

test("Matrix teardown cancels delayed focus and detached form handlers while retaining the current draft", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 680, height: 1000 });
  await page.clock.install();
  await page.goto(app.origin);
  await expect(page.locator(".node").first()).toBeVisible();
  await page.keyboard.press("/");
  await page.locator("#search").fill(app.fixture.requirements[0].key!);
  await page.locator(`[data-result="${app.fixture.requirements[0].key}"]`).click();
  await page.locator('[data-view="matrix"]').click();
  await page.locator(".trace-config-toggle summary").click();
  await page.locator("#trace-root-type").selectOption("requirement");
  await page.locator("#trace-column-count").selectOption("0");
  await page.locator("#matrix-scope").selectOption("project");
  const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
  const oldCell = await page.getByRole("gridcell").first().elementHandle();
  await oldCell!.evaluate((cell) => {
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-view="history"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-view="matrix"]')!.click();
    document.querySelector<HTMLInputElement>("#matrix-search")!.focus();
  });
  const current = await page.getByRole("gridcell").first().elementHandle();
  await page.clock.runFor(350);
  await expect(page.locator("#matrix-search")).toBeFocused();
  expect(await current!.evaluate((cell) => cell.isConnected)).toBe(true);
  await oldCell!.evaluate((cell) =>
    cell.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true })),
  );
  await expect(page.locator(".cell-editor")).toHaveCount(0);
  await page.locator('.matrix-actions [data-action="create-artifact"]').click();
  const title = page.locator('#matrix-cell-popover [name="title"]');
  await expect(title).toBeFocused();
  await title.fill("Draft remains across view changes");
  const oldTitle = await title.elementHandle();
  await page.locator('[data-view="history"]').click();
  await page.locator('[data-view="matrix"]').click();
  await expect(title).toHaveValue("Draft remains across view changes");
  await oldTitle!.evaluate((input) => {
    (input as HTMLInputElement).value = "Stale detached form";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    window.dispatchEvent(new Event("resize"));
  });
  await page.clock.runFor(50);
  await expect(title).toHaveValue("Draft remains across view changes");
  await title.focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".cell-editor")).toHaveCount(0);
  expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
  expect(app.errors).toEqual([]);
});

for (const width of [1440, 680, 390]) {
  test(`search supports keyboard discovery, empty recovery and dismissal at ${width}px`, async ({
    page,
    app,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(app.origin);
    await expect(page.locator(".node").first()).toBeVisible();
    const revision = (await app.tracer.getProjectSnapshot()).projectRevision;
    const trigger = page.locator('[data-action="search"]');
    await trigger.click();
    const input = page.getByRole("combobox", { name: "Search artifacts and commands" });
    const options = page.locator('#search-results [role="option"]');
    await expect(input).toBeFocused();
    const searchTop = (await input.boundingBox())!.y;
    await expect(page.locator("#search-status")).toContainText("12 artifacts");
    const initial = await options.first().getAttribute("id");
    await input.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await options.nth(1).getAttribute("id"))!,
    );
    await input.press("ArrowUp");
    await expect(input).toHaveAttribute("aria-activedescendant", initial!);
    await input.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await input.fill("nothing matches this search 90352");
    await expect(page.getByText("No matches found", { exact: true })).toBeVisible();
    expect(Math.abs((await input.boundingBox())!.y - searchTop)).toBeLessThanOrEqual(1);
    await expect(input).not.toHaveAttribute("aria-activedescendant");
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(input).toBeVisible();
    await page.locator("[data-clear-search]").click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await input.fill(app.fixture.requirements[0].key!.split("-")[0]);
    await expect(options.first()).toHaveAttribute("data-result", app.fixture.requirements[0].key!);
    await page.screenshot({ path: info.outputPath("search.png") });
    await input.fill(`  ${app.fixture.requirements[0].key!.toLowerCase()}  `);
    await expect(options.first()).toHaveAttribute("data-result", app.fixture.requirements[0].key!);
    await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
    await expect(input).toBeVisible();
    await input.press("Enter");
    await expect(page.locator("#workspace-dialog")).not.toBeVisible();
    await expect(page.locator('.node[aria-pressed="true"]')).toHaveAttribute(
      "data-key",
      app.fixture.requirements[0].key!,
    );
    await trigger.click();
    await input.fill("Project history");
    await input.press("Enter");
    await expect(page.locator('[data-view="history"]')).toHaveAttribute("aria-pressed", "true");
    await trigger.click();
    await input.fill("clear me");
    await page
      .locator(".search-input-row")
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    const dialog = page.locator("#workspace-dialog");
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(page.locator("#search-help")).toBeVisible();
    await input.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    // Resize replaces the opener. Dismissal must still return to a usable control.
    await page.setViewportSize({ width, height: 860 });
    await input.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect((await app.tracer.getProjectSnapshot()).projectRevision).toBe(revision);
    expect(app.errors).toEqual([]);
  });
}
