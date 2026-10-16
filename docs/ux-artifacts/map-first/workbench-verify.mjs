import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../../../../output/ux-reset/map-first/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
const errors = [],
  warnings = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.text().includes("[React Flow]")) warnings.push(message.text());
});
async function settled() {
  await page.waitForFunction(() => {
    const c = document.querySelector(".canvas");
    return (
      c?.getAttribute("aria-busy") === "false" &&
      document.querySelectorAll(".react-flow__node").length === Number(c.dataset.nodeCount) &&
      document.querySelectorAll(".react-flow__edge").length === Number(c.dataset.edgeCount)
    );
  });
  assert.equal(await page.locator(".canvas-error").count(), 0);
}
const screenshot = (name) => page.screenshot({ path: `${output}/${name}.png` });
const viewport = () => page.locator(".react-flow__viewport").evaluate((e) => e.style.transform);
const category = (name) =>
  page
    .getByRole("region", { name: "Working categories", exact: true })
    .getByRole("button", { name: new RegExp(`^${name}\\s*\\d`) });

try {
  await page.goto("http://127.0.0.1:4371/");
  await settled();
  assert.equal(await page.getByLabel("Group detail", { exact: true }).inputValue(), "folders");
  const positions = () =>
    page
      .locator(".react-flow__node")
      .evaluateAll((nodes) =>
        Object.fromEntries(nodes.map((node) => [node.dataset.id, node.style.transform])),
      );
  const initialCamera = await viewport(),
    initialPositions = await positions();
  await page.getByRole("button", { name: "Expand User needs", exact: true }).click();
  await settled();
  assert.equal(await viewport(), initialCamera);
  assert.equal((await positions())["group:user_need"], initialPositions["group:user_need"]);
  const overview = await positions(),
    overviewCamera = await viewport();
  await page.getByRole("button", { name: "Open Maintenance · User needs", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".model-group").count(), 0);
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  assert.equal(
    await page.getByLabel("Trace direction", { exact: true }).inputValue(),
    "downstream",
  );
  await page.getByRole("button", { name: "Cleaning · 3", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 12);
  assert.equal(await page.locator(".model-group").count(), 0);
  assert.equal(await page.locator(".react-flow__edge").count(), 9);
  await screenshot("workbench-cleaning-direct-traces");
  checks.push(
    "type expansion keeps its anchor; opening a folder replaces containers with flat source items and exact one-level downstream traces",
  );
  const cleaning = await positions(),
    cleaningCamera = await viewport();
  await page.locator(".record-node").getByText("UN-CLN-01", { exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 4);
  assert.match(await page.locator("h1").textContent(), /Trace · UN-CLN-01/);
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("2");
  await settled();
  assert.ok((await page.locator(".record-node").count()) > 4);
  await page.getByRole("button", { name: "← Folder", exact: true }).click();
  await settled();
  assert.deepEqual(await positions(), cleaning);
  assert.equal(await viewport(), cleaningCamera);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  assert.deepEqual(await positions(), overview);
  assert.equal(await viewport(), overviewCamera);
  checks.push(
    "clicking an item defaults to direct downstream tracing; configurable levels and Back restore exact folder and overview positions/cameras",
  );
  await page.getByRole("button", { name: "Focus User needs group", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".model-group").count(), 0);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  assert.deepEqual(await positions(), overview);
  assert.equal(await viewport(), overviewCamera);
  checks.push(
    "the group-focus shortcut also opens flat item traces and restores the unchanged overview",
  );
  await page.getByRole("searchbox", { name: "Find an item", exact: true }).fill("UN-CLN-01");
  await page.locator(".search-results .search-hit").click();
  await settled();
  await page.getByLabel("Levels shown", { exact: true }).selectOption("2");
  await settled();
  const beforeDisplay = await positions(),
    allLines = await page.locator(".react-flow__edge").count();
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByLabel("Draw connections", { exact: true }).selectOption("selection");
  await settled();
  const selectedLines = await page.locator(".react-flow__edge").count();
  assert.ok(selectedLines > 0 && selectedLines < allLines);
  assert.deepEqual(await positions(), beforeDisplay);
  await page.getByLabel("Draw connections", { exact: true }).selectOption("none");
  await settled();
  assert.equal(await page.locator(".react-flow__edge").count(), 0);
  await page.getByRole("button", { name: "Close display", exact: true }).click();
  await page.getByRole("button", { name: "Show all connections", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".react-flow__edge").count(), allLines);
  checks.push(
    "selection-only and hidden connections simplify individual traces without changing positions or reached scope",
  );

  await page.getByLabel("Project", { exact: true }).selectOption("connected");
  await settled();
  await category("Power").click();
  await settled();
  await page.getByRole("button", { name: "Show outside groups", exact: true }).click();
  await settled();
  const labels = await page
    .locator(".edge-label")
    .evaluateAll((elements) => elements.map((element) => element.dataset.bundleId));
  const chosen = labels.findIndex((id) => {
    if (!id.startsWith("[")) return false;
    const value = JSON.parse(id);
    return value[1] === "boundary:verification_protocol" && value[2] === "verified_by";
  });
  assert.ok(chosen >= 0);
  await page.locator(".edge-label").nth(chosen).click();
  const tray = page.getByRole("region", { name: "Connection records", exact: true });
  await tray.waitFor();
  const total = Number(
    (await tray.locator(".table-heading span").textContent()).match(/^(\d+)/)[1],
  );
  const linkIds = [];
  while (true) {
    linkIds.push(
      ...(await tray
        .locator("tbody tr")
        .evaluateAll((rows) => rows.map((row) => row.dataset.linkId))),
    );
    const next = tray.getByRole("button", { name: "Next connection pages", exact: true });
    if (await next.isDisabled()) break;
    await next.click();
  }
  assert.equal(linkIds.length, total);
  assert.equal(new Set(linkIds).size, total);
  await tray.getByRole("button", { name: "Reveal this page on map", exact: true }).click();
  await settled();
  assert.ok((await page.locator(".external-record").count()) > 0);
  const focusedBox = await page.locator(".record-node.chosen").boundingBox(),
    focusedCanvas = await page.locator(".canvas").boundingBox();
  assert.ok(
    focusedBox.x >= focusedCanvas.x &&
      focusedBox.x + focusedBox.width <= focusedCanvas.x + focusedCanvas.width &&
      focusedBox.y >= focusedCanvas.y &&
      focusedBox.y + focusedBox.height <= focusedCanvas.y + focusedCanvas.height,
  );
  assert.ok((await page.locator(".record-node").count()) <= 24 + 25);
  assert.equal(await category("Power").getAttribute("aria-pressed"), "true");
  await screenshot("workbench-connection-inspection");
  checks.push(
    "every selected bundle link is pageable once; revealing a page exposes exact outside endpoints without recategorizing them",
  );
  await tray.getByRole("button", { name: "Close connection records", exact: true }).click();

  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await page.getByLabel("Session view name", { exact: true }).fill("Power review");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const savedViewport = await viewport();
  await category("Measurement").click();
  await settled();
  await page
    .getByRole("region", { name: "Saved session views", exact: true })
    .getByRole("button", { name: "Power review", exact: true })
    .click();
  await settled();
  assert.equal(await category("Power").getAttribute("aria-pressed"), "true");
  assert.equal(await viewport(), savedViewport);
  checks.push("saved session view restores category, detail, revealed endpoints and camera");

  await category("Power").click();
  await settled();
  await page.getByRole("button", { name: "Items table", exact: true }).click();
  const records = page.getByRole("region", { name: "Items in working scope", exact: true });
  assert.equal(await records.locator("tbody tr").count(), 12);
  await records.getByRole("button", { name: "Next item pages", exact: true }).click();
  const pageKey = await records.locator("tbody .table-item small").first().textContent();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await page.getByRole("button", { name: "Items table", exact: true }).click();
  assert.equal(await records.locator("tbody .table-item small").first().textContent(), pageKey);
  await records.getByRole("button", { name: "Previous item pages", exact: true }).click();
  const first = records.locator("tbody tr").first();
  const key = await first.locator(".table-item small").textContent(),
    oldPath = await first.locator("td").nth(3).textContent();
  await records.getByLabel(`Select ${key}`, { exact: true }).check();
  await records.getByRole("button", { name: "Organize 1 item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Folder within each item's type", { exact: true }).fill("Power / Review");
  await dialog.getByRole("button", { name: "Apply to 1 item", exact: true }).click();
  assert.equal(await first.locator("td").nth(3).textContent(), "Power / Review");
  await page.getByRole("button", { name: "Undo organization", exact: true }).click();
  assert.equal(await first.locator("td").nth(3).textContent(), oldPath);
  await records.getByLabel(`Select ${key}`, { exact: true }).check();
  await records.getByRole("button", { name: "Organize 1 item", exact: true }).click();
  await dialog.getByLabel("Action", { exact: true }).selectOption("add");
  await dialog.getByLabel("Category", { exact: true }).fill("Cross discipline");
  await dialog.getByRole("button", { name: "Apply to 1 item", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Cancel organization", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await dialog.getByRole("button", { name: "Apply to 1 item", exact: true }).click();
  await category("Cross discipline").click();
  await settled();
  assert.equal(await records.locator("tbody tr").count(), 1);
  assert.equal(await records.locator("tbody .table-item small").textContent(), key);
  assert.match(await records.locator("tbody tr td").nth(4).textContent(), /Power/);
  await screenshot("workbench-organized-table");
  checks.push(
    "item table shares scope; folder move and undo retain identity; category addition creates an overlapping working view",
  );

  await category("Uncategorized").click();
  await settled();
  await records.getByText("PRS-UNFILED", { exact: true }).waitFor();
  assert.equal(await records.locator("tbody tr").count(), 1);
  checks.push("unlinked and uncategorized item remains discoverable");
  await page.getByLabel("Project", { exact: true }).selectOption("aster");
  await settled();
  await page.getByLabel("Project", { exact: true }).selectOption("connected");
  await settled();
  await category("Cross discipline").waitFor();
  await page
    .getByRole("region", { name: "Saved session views", exact: true })
    .getByRole("button", { name: "Power review", exact: true })
    .waitFor();
  checks.push(
    "table paging survives representation changes; modal keyboard focus is contained; project switching retains session organization and views",
  );

  await page.getByRole("button", { name: "Hide categories", exact: true }).click();
  assert.equal(
    await page.locator(".application").getAttribute("class"),
    "application rail-collapsed",
  );
  await page.getByRole("button", { name: "Show categories", exact: true }).click();
  await category("Power").click();
  await settled();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Working category", { exact: true }).selectOption("Measurement");
    await settled();
    await page.getByLabel("Working category", { exact: true }).selectOption("Power");
    await settled();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const bounds = await page.locator(".canvas").boundingBox();
    assert.ok(bounds.height > 180, JSON.stringify(bounds));
    await page.getByRole("button", { name: "Connections", exact: true }).click();
    await page.getByRole("region", { name: "Connection records", exact: true }).waitFor();
    const close = await page
      .getByRole("button", { name: "Close connection records", exact: true })
      .boundingBox();
    assert.ok(close.y >= 0 && close.y + close.height <= 1000);
    await screenshot(`workbench-${width}`);
    await page.getByRole("button", { name: "Close connection records", exact: true }).click();
  }
  checks.push(
    "optional category rail and mobile category picker work; graph and connection drawer remain reachable at 390/320px",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  await writeFile(
    `${output}/workbench-results.json`,
    JSON.stringify({ checks, errors, warnings }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
} catch (error) {
  await screenshot("workbench-failure");
  console.log(
    JSON.stringify(
      { checks, errors, warnings, status: await page.locator(".statusbar").textContent() },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
