import { closeTestPage } from "./browser-test.ts";
import { test as base, expect, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

const test = base.extend<{ project: Awaited<ReturnType<typeof seedRealisticProject>> }>({
  project: async ({ page }, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-map-session-"));
    const project = await seedRealisticProject(join(directory, "project"), "medical");
    const repository = new SQLiteRepository(project.database);
    const server = await startLocalServer(new Tracer(repository), resolve("dist"), 0);
    try {
      await page.goto(server.origin);
      await use(project);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function ready(page: Page) {
  await expect(page.getByLabel("Interactive development graph", { exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function trace(page: Page, key: string) {
  await page.getByRole("searchbox", { name: "Find an item" }).fill(key);
  await page
    .getByRole("button")
    .filter({ hasText: new RegExp(`^${key} ·`) })
    .click();
  await ready(page);
}
async function geometry(page: Page) {
  return page.locator(".canvas .react-flow").evaluate((canvas) => ({
    camera: (canvas.querySelector(".react-flow__viewport") as HTMLElement).style.transform,
    nodes: [...canvas.querySelectorAll<HTMLElement>(".react-flow__node")]
      .map((node) => [node.dataset.id, node.style.transform])
      .sort(),
  }));
}

test("native map preserves placement through branch reveal, undo, refocus and previous trace", async ({
  page,
  project,
}) => {
  await trace(page, "PRS-01");
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  let previous = "",
    stable = 0;
  await expect
    .poll(async () => {
      const { camera } = await geometry(page);
      stable = camera === previous ? stable + 1 : 0;
      previous = camera;
      return stable;
    })
    .toBeGreaterThanOrEqual(2);
  const start = await geometry(page);
  await page.locator(`.react-flow__node[data-id="${project.entities["SYS-03"].id}"]`).click();
  await ready(page);
  const expanded = await geometry(page);
  expect(expanded.nodes.length).toBeGreaterThan(start.nodes.length);
  expect(expanded.camera).toBe(start.camera);
  expect(expanded.nodes.filter(([id]) => start.nodes.some(([old]) => old === id))).toEqual(
    start.nodes,
  );
  await page.getByRole("button", { name: "Focus this trace", exact: true }).click();
  await ready(page);
  await expect(page.getByRole("heading", { name: "Trace · SYS-03", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Previous trace", exact: true }).click();
  await ready(page);
  expect(await geometry(page)).toEqual(expanded);
  await page.getByRole("button", { name: "Undo reveal", exact: true }).click();
  await ready(page);
  expect(await geometry(page)).toEqual(start);
});

test("display settings survive trace return and fast scope changes settle on the latest request", async ({
  page,
  project: _project,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByLabel("Connection labels", { exact: true }).selectOption("none");
  await page.getByLabel("Graph spacing", { exact: true }).selectOption("compact");
  await ready(page);
  await page.getByRole("button", { name: "Close display", exact: true }).click();
  await trace(page, "PRS-01");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("3");
  await page.getByLabel("Trace direction", { exact: true }).selectOption("upstream");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("0");
  await ready(page);
  await expect(page.locator(".canvas .react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await expect(page.getByLabel("Connection labels", { exact: true })).toHaveValue("none");
  await expect(page.getByLabel("Graph spacing", { exact: true })).toHaveValue("compact");
});

test("trace-walker keyboard return restores the starting map; organization wraps focus", async ({
  page,
  project: _project,
}) => {
  await trace(page, "PRS-01");
  const start = await geometry(page);
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  const walker = page.getByRole("dialog", { name: "Follow trace across folders", exact: true });
  const back = walker.getByRole("button", { name: "← Return to starting view", exact: true });
  await expect(walker.getByRole("button", { name: "Arrange path", exact: true })).toBeEnabled();
  await walker
    .getByRole("button", { name: "Follow SYS-03 via decomposes into", exact: true })
    .click();
  await expect(
    walker.getByRole("heading", {
      name: "SYS-03 · Reject motion-corrupted estimates",
      exact: true,
    }),
  ).toBeVisible();
  await walker.getByRole("button", { name: "← Back one step", exact: true }).click();
  await expect(walker.getByRole("heading").filter({ hasText: /^PRS-01 ·/ })).toBeVisible();
  await walker
    .getByRole("button", { name: "Follow SYS-03 via decomposes into", exact: true })
    .click();
  await expect(walker.getByRole("heading").filter({ hasText: /^SYS-03 ·/ })).toBeVisible();
  await back.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(back).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(back).toBeFocused();
  await expect(
    walker.getByRole("button", { name: "← Return to starting view", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(walker).toHaveCount(0);
  expect(await geometry(page)).toEqual(start);
  await page.getByRole("button", { name: "Organize item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Organize 1 item", exact: true });
  const first = dialog.getByRole("button", { name: "Cancel organization", exact: true });
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(first).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await first.click();
  await expect(dialog).toHaveCount(0);
});

test("resizing and closing the trace lens keeps the current map selection usable", async ({
  page,
  project: _project,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await trace(page, "PRS-01");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("0");
  await ready(page);
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  const walker = page.getByRole("dialog", { name: "Follow trace across folders", exact: true });
  await expect(walker.getByRole("button", { name: "Arrange path", exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await walker.getByRole("button", { name: "← Return to starting view", exact: true }).click();
  await expect(walker).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("heading", { name: "Trace · PRS-01", exact: true })).toBeVisible();
  await expect(page.locator(".canvas .react-flow__node")).toHaveCount(1);
  await expect
    .poll(async () => {
      const node = await page.locator(".canvas .react-flow__node").boundingBox();
      const canvas = await page
        .getByLabel("Interactive development graph", { exact: true })
        .boundingBox();
      return (
        !!node && !!canvas && node.x >= canvas.x && node.x + node.width <= canvas.x + canvas.width
      );
    })
    .toBe(true);
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  await expect(walker.getByRole("button", { name: "Arrange path", exact: true })).toBeEnabled();
  await expect(
    walker.getByRole("button", { name: "← Return to starting view", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(walker).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(failures).toEqual([]);
});
