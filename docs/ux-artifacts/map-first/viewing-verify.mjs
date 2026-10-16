import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../../../../output/ux-reset/map-first/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.text().includes("[React Flow]")) errors.push(message.text());
});
async function settled() {
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".canvas");
    return (
      canvas?.getAttribute("aria-busy") === "false" &&
      canvas.querySelectorAll(".react-flow__node").length === Number(canvas.dataset.nodeCount)
    );
  });
}
const snapshot = () =>
  page.locator(".canvas").evaluate((canvas) => ({
    camera: canvas.querySelector(".react-flow__viewport").style.transform,
    nodes: [...canvas.querySelectorAll(".react-flow__node")].map((node) => [
      node.dataset.id,
      node.style.transform,
    ]),
  }));
const find = async (key) => {
  await page.getByRole("searchbox", { name: "Find an item", exact: true }).fill(key);
  await page.locator(".search-hit").click();
  await settled();
};
try {
  await page.goto("http://127.0.0.1:4371/");
  await settled();
  await page.getByLabel("Map scope", { exact: true }).selectOption("development");
  await settled();
  assert.equal(
    await page.locator(".record-node").filter({ hasText: "Aster Home BP monitor" }).count(),
    1,
  );
  assert.equal(await page.getByRole("button", { name: "Expand Product", exact: true }).count(), 0);
  assert.match(
    await page.locator(".record-node").textContent(),
    /Product context · Intended use & scope/,
  );
  await page.screenshot({ path: `${output}/viewing-product-context.png` });
  const fullDevelopment = await snapshot();
  await page.locator(".record-node").getByText("DEV-01", { exact: true }).click();
  await settled();
  assert.match(
    await page.locator(".inspector .statement").textContent(),
    /Fictional battery-powered/,
  );
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  assert.deepEqual(await snapshot(), fullDevelopment);
  await page.getByLabel("Map scope", { exact: true }).selectOption("all");
  await settled();
  assert.equal(
    await page
      .getByRole("button", { name: "Expand Evaluation configurations", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.locator(".record-node").filter({ hasText: "Evaluation configurations" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  await page.waitForTimeout(250); // Explicit camera animation, then click the actual visible group control.
  await page.getByRole("button", { name: "Expand Design changes", exact: true }).click();
  await settled();
  assert.equal(
    await page.locator('.react-flow__node[data-id="group:design_change"] .record-node').count(),
    0,
  );
  const changes = await page
    .locator(".record-node")
    .filter({ hasText: "Design changes /" })
    .count();
  assert.equal(changes, 5);
  await page.getByRole("button", { name: "Browse folders", exact: true }).click();
  const browser = page.getByRole("region", { name: "Folder browser", exact: true });
  await browser.locator("summary").filter({ hasText: "Design changes" }).click();
  assert.equal(
    await browser.getByRole("button", { name: "All design changes", exact: true }).count(),
    1,
  );
  assert.equal(
    await browser
      .locator("details")
      .filter({ hasText: "All design changes" })
      .locator(".folder-row")
      .filter({ hasText: "Power / Battery" })
      .count(),
    0,
  );
  await browser.locator("summary").filter({ hasText: "Recorded runs" }).click();
  assert.equal(
    await browser.getByRole("button").filter({ hasText: "Safety / Pressure protection" }).count(),
    1,
  );
  assert.equal(await browser.getByRole("button", { name: "Safety 2", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Close folder browser", exact: true }).click();
  checks.push(
    "all types expose the single configuration directly, design changes expand directly to five records, and folder browsing skips pass-through/sparse layers",
  );
  await page.getByLabel("Map scope", { exact: true }).selectOption("requirements");
  await settled();
  checks.push(
    "the single product appears directly with its actual title/context; inspecting it retains native meaning and returns to the exact overview",
  );
  await page.getByRole("searchbox", { name: "Find an item", exact: true }).fill("battery");
  const first = await page.locator(".search-hit").allTextContents();
  await page.getByRole("button", { name: "Next results", exact: true }).click();
  const second = await page.locator(".search-hit").allTextContents();
  assert.ok(
    first.length === 8 && second.length === 8 && !second.some((text) => first.includes(text)),
  );
  await page.getByLabel("Search item type", { exact: true }).selectOption("product_requirement");
  assert.ok(
    (await page.locator(".search-hit").allTextContents()).every((text) =>
      text.includes("Product requirements"),
    ),
  );
  assert.ok(await page.getByRole("button", { name: "Previous results", exact: true }).isDisabled());
  await page.getByLabel("Search item type", { exact: true }).selectOption("");
  await find("PRS-BAT-03");
  assert.match(await page.locator("h1").textContent(), /PRS-BAT-03/);
  checks.push(
    "broad project search pages distinct results completely, narrows by type, shows folder context and opens a specific canonical record",
  );
  const initial = await snapshot();
  await page.locator(".record-node").getByText("SYS-BAT-03A", { exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Locate new items", exact: true }).click();
  assert.equal(
    await page.locator(".inspector > .panel-heading strong").textContent(),
    "CMP-BAT-03A",
  );
  await page.getByRole("button", { name: "Reveal next connections", exact: true }).click();
  await settled();
  const branch = await snapshot();
  assert.ok(
    await page
      .getByRole("navigation", { name: "Trace exploration" })
      .getByRole("button", { name: "SYS-BAT-03A", exact: true })
      .count(),
  );
  assert.ok(
    await page
      .getByRole("navigation", { name: "Trace exploration" })
      .getByRole("button", { name: "CMP-BAT-03A", exact: true })
      .count(),
  );
  for (const node of initial.nodes)
    assert.deepEqual(
      branch.nodes.find((entry) => entry[0] === node[0]),
      node,
    );
  await page
    .getByRole("navigation", { name: "Trace exploration" })
    .getByRole("button", { name: "PRS-BAT-03", exact: true })
    .click();
  const located = await snapshot();
  assert.notEqual(located.camera, branch.camera);
  assert.deepEqual(located.nodes, branch.nodes);
  checks.push(
    "expanded branches expose named locator buttons; Locate new items and Start change only camera/selection, preserving existing positions",
  );
  await page
    .getByRole("navigation", { name: "Trace exploration" })
    .getByRole("button", { name: "CMP-BAT-03A", exact: true })
    .click();
  await page.getByRole("button", { name: "Locate on graph", exact: true }).click();
  assert.match(await page.locator("h1").textContent(), /PRS-BAT-03/);
  const beforeIsolation = await snapshot();
  assert.equal(await page.locator(".trace-path-halo").count(), 2);
  await page.getByRole("button", { name: "Isolate path", exact: true }).click();
  assert.equal(await page.locator(".canvas").getAttribute("data-edge-count"), "2");
  assert.deepEqual(await snapshot(), beforeIsolation);
  assert.match(await page.locator(".graph-key").textContent(), /Other connections hidden/);
  await page.screenshot({ path: `${output}/viewing-isolated-path.png` });
  await page.getByRole("button", { name: "Show context", exact: true }).click();
  assert.ok(Number(await page.locator(".canvas").getAttribute("data-edge-count")) > 2);
  assert.deepEqual(await snapshot(), beforeIsolation);
  await page.screenshot({ path: `${output}/viewing-path-context.png` });
  checks.push(
    "the selected route keeps two ancestor links highlighted; isolating/restoring context preserves all record positions, scope and camera",
  );
  const beforeRebase = await snapshot();
  await page.getByRole("button", { name: "Focus this trace", exact: true }).click();
  await settled();
  assert.match(await page.locator("h1").textContent(), /CMP-BAT-03A/);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Subsystem allocation", exact: true }).uncheck();
  await settled();
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await page.getByRole("button", { name: "← Previous trace", exact: true }).click();
  await settled();
  assert.match(await page.locator("h1").textContent(), /PRS-BAT-03/);
  assert.deepEqual(await snapshot(), beforeRebase);
  assert.match(await page.locator(".scope-summary").textContent(), /All 15/);
  const beforeHidden = await snapshot();
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByLabel("Draw connections", { exact: true }).selectOption("none");
  assert.equal(await page.locator(".canvas").getAttribute("data-edge-count"), "0");
  assert.match(await page.locator(".graph-key").textContent(), /Connections hidden/);
  assert.deepEqual(await snapshot(), beforeHidden);
  await page.getByRole("button", { name: "Show all connections", exact: true }).click();
  await page.getByRole("button", { name: "Close display", exact: true }).click();
  assert.ok(Number(await page.locator(".canvas").getAttribute("data-edge-count")) > 0);
  checks.push(
    "hidden connections stay explicitly labeled without dropping records; trace return restores the prior relationship filters",
  );

  await page.screenshot({ path: `${output}/viewing-branch-return.png` });
  checks.push(
    "refocusing a neighbor retains the expanded trace; Previous trace restores its exact camera, geometry and selected item",
  );
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Items table", exact: true }).click();
  await page.getByRole("button", { name: /PRS-02 Pressure-channel/ }).click();
  assert.equal(await page.locator(".inspector .boundary").count(), 0);
  await page.getByRole("button", { name: "Focus this trace", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  assert.ok(await page.locator(".record-table").isVisible());
  checks.push(
    "table selection is not falsely labeled hidden by graph grouping, and returning from tracing restores the table",
  );
  await page
    .locator(".area-navigation button")
    .filter({ hasText: /^Power/ })
    .click();
  await settled();
  await find("OUT-BAT-03");
  assert.match(
    await page.locator(".scope-boundary").textContent(),
    /[1-9]\d* reached items outside Power/,
  );
  await find("VER-BAT-03");
  await page.getByRole("button", { name: "Reveal next connections", exact: true }).click();
  assert.match(
    await page.locator(".trace-reveal-actions").textContent(),
    /No additional matching items from VER-BAT-03/,
  );
  await page.getByRole("button", { name: "← Previous trace", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  checks.push(
    "cross-category reach is counted explicitly and terminal plans give visible no-additional-items feedback without inventing results",
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await find("PRS-BAT-03");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const canvas = await page.locator(".canvas").boundingBox();
    assert.ok(canvas.height >= 180);
    assert.equal(await page.locator(".inspector").isVisible(), false);
    await page.getByRole("button", { name: "Item details", exact: true }).click();
    assert.equal(await page.locator(".inspector").isVisible(), true);
    await page.getByRole("button", { name: "Close details", exact: true }).click();
    assert.equal(await page.locator(".inspector").isVisible(), false);
    await page.screenshot({ path: `${output}/viewing-${width}.png` });
    await page.getByRole("button", { name: "← Data model", exact: true }).click();
    await settled();
  }
  checks.push(
    "viewing controls and retained return context remain usable at 390/320px without document overflow",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/viewing-results.json`,
    JSON.stringify({ checks, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/viewing-failure.png` });
  throw error;
} finally {
  await browser.close();
}
