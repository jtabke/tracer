import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../../../../output/ux-reset/map-first/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
const checks = [],
  errors = [],
  warnings = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.text().includes("[React Flow]")) warnings.push(message.text());
});
async function settled() {
  await page.waitForFunction(() => {
    const c = document.querySelector(".canvas");
    return (
      c?.getAttribute("aria-busy") === "false" &&
      c.querySelectorAll(".react-flow__node").length === Number(c.dataset.nodeCount) &&
      c.querySelectorAll(".react-flow__edge").length === Number(c.dataset.edgeCount)
    );
  });
  assert.equal(await page.locator(".canvas-error").count(), 0);
}
const screenshot = (name) => page.screenshot({ path: `${output}/${name}.png` });
const state = () =>
  page.locator(".canvas").evaluate((c) => ({
    viewport: c.querySelector(".react-flow__viewport").style.transform,
    nodes: [...c.querySelectorAll(".react-flow__node")].map((node) => [
      node.dataset.id,
      node.style.transform,
    ]),
    edges: [...c.querySelectorAll(".react-flow__edge-path")].map((node) =>
      node
        .getAttribute("d")
        .replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi, (value) =>
          String(Math.round(Number(value) * 1000) / 1000),
        ),
    ),
  }));
const keys = () => page.locator(".record-node .record-key").allTextContents();
try {
  await page.goto("http://127.0.0.1:4371/");
  await settled();
  await page.getByRole("button", { name: "Expand User needs", exact: true }).click();
  await settled();
  const overview = await state();
  await page.getByRole("button", { name: "Open Maintenance · User needs", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".model-group").count(), 0);
  await page.getByRole("button", { name: "Cleaning · 3", exact: true }).click();
  await settled();
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  assert.equal(
    await page.getByLabel("Trace direction", { exact: true }).inputValue(),
    "downstream",
  );
  assert.equal(await page.locator(".record-node").count(), 12);
  assert.equal(await page.locator(".model-group").count(), 0);
  assert.equal(await page.locator(".react-flow__edge").count(), 9);
  assert.equal(await page.locator(".edge-label").count(), 9);
  const source = await page
      .locator(".record-node")
      .getByText("UN-CLN-01", { exact: true })
      .boundingBox(),
    canvas = await page.locator(".canvas").boundingBox();
  assert.ok(
    source.x >= canvas.x &&
      source.x + source.width <= canvas.x + canvas.width &&
      source.y >= canvas.y &&
      source.y + source.height <= canvas.y + canvas.height,
  );
  const cleaning = await state();
  await screenshot("detail-cleaning-one-level");
  await page.locator(".record-node").getByText("PRS-CLN-01", { exact: true }).click();
  await settled();
  const folderRevealed = await state();
  assert.equal(folderRevealed.viewport, cleaning.viewport);
  for (const node of cleaning.nodes)
    assert.deepEqual(
      folderRevealed.nodes.find((next) => next[0] === node[0]),
      node,
    );
  assert.ok((await keys()).includes("SYS-CLN-01A"));
  assert.equal(await page.locator("h1").textContent(), "Cleaning");
  await page.getByRole("button", { name: "Undo reveal", exact: true }).click();
  await settled();
  assert.deepEqual(await state(), cleaning);

  checks.push(
    "opening Maintenance/Cleaning shows three source needs, six actual requirements and three validation plans with labeled individual links and zero nested containers",
  );

  await page.locator(".record-node").getByText("UN-CLN-01", { exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 4);
  assert.equal(await page.locator(".react-flow__edge").count(), 3);
  assert.ok((await keys()).includes("PRS-CLN-01"));
  assert.ok((await keys()).includes("PRS-CLN-02"));
  assert.ok((await keys()).includes("VAL-CLN-01"));
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  await screenshot("detail-selected-need-direct");
  const beforeReveal = await state();
  const beforeRevealCanvas = await page.locator(".canvas").boundingBox();
  await page.locator(".record-node").getByText("PRS-CLN-01", { exact: true }).click();
  await settled();
  const firstReveal = await state();
  assert.equal(firstReveal.viewport, beforeReveal.viewport);
  assert.equal((await page.locator(".canvas").boundingBox()).y, beforeRevealCanvas.y);
  for (const node of beforeReveal.nodes)
    assert.deepEqual(
      firstReveal.nodes.find((next) => next[0] === node[0]),
      node,
    );
  assert.ok((await keys()).includes("SYS-CLN-01A"));
  assert.ok(!(await keys()).includes("SYS-CLN-02A"));
  assert.ok((await keys()).includes("UN-CLN-01"));
  // The appended branch can be below the viewport; click its canonical card
  // without altering the camera, then verify the second reveal independently.
  await page
    .locator(".record-node")
    .getByText("SYS-CLN-01A", { exact: true })
    .dispatchEvent("click");
  await settled();
  const secondReveal = await state();
  assert.ok((await keys()).includes("CMP-CLN-01A"));
  for (const node of firstReveal.nodes)
    assert.deepEqual(
      secondReveal.nodes.find((next) => next[0] === node[0]),
      node,
    );
  assert.equal(secondReveal.viewport, firstReveal.viewport);
  await screenshot("detail-path-revealed");
  await page.getByRole("button", { name: "Undo reveal", exact: true }).click();
  await settled();
  assert.deepEqual(await state(), firstReveal);
  await page.getByRole("button", { name: "Undo reveal", exact: true }).click();
  await settled();
  assert.deepEqual(await state(), beforeReveal);
  checks.push(
    "linked-item clicks append only chosen next-level branches, preserve every existing position/root/camera and undo one reveal at a time",
  );

  await page.getByLabel("Levels shown", { exact: true }).selectOption("2");
  await settled();
  assert.ok((await keys()).includes("SYS-CLN-01A"));
  assert.equal(
    (await keys()).some((key) => key.startsWith("CMP-")),
    false,
  );
  await page.getByLabel("Levels shown", { exact: true }).selectOption("3");
  await settled();
  assert.ok((await keys()).includes("CMP-CLN-01A"));
  await page.getByLabel("Levels shown", { exact: true }).selectOption("0");
  await settled();
  assert.equal(await page.locator(".record-node").count(), 1);
  await page.getByRole("button", { name: "← Folder", exact: true }).click();
  await settled();
  assert.deepEqual(await state(), cleaning);
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  checks.push(
    "single-clicking a need opens its one-level downstream trace; visible 0–3 levels alter real reach and Back restores the complete folder view, controls and camera",
  );

  await page.getByLabel("Levels shown", { exact: true }).selectOption("3");
  await settled();
  assert.equal(await page.locator(".record-node").count(), 30);
  assert.match(await page.locator(".scope-boundary").textContent(), /reached records not drawn/);
  await page.getByLabel("Levels shown", { exact: true }).selectOption("1");
  await settled();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Intended-use validation", exact: true }).uncheck();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 9);
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  assert.deepEqual(await state(), overview);
  checks.push(
    "multi-source higher levels disclose drawing limits; relationship filtering removes only real matching neighbors and returning preserves the expanded overview exactly",
  );

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Browse folders", exact: true }).click();
    const folders = page.getByRole("region", { name: "Folder browser", exact: true });
    await folders.locator("summary").filter({ hasText: "User needs" }).click();
    await folders.getByRole("button").filter({ hasText: "Maintenance / Cleaning" }).click();
    await settled();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    const bounds = await page.locator(".canvas").boundingBox();
    assert.ok(bounds.height >= 180, JSON.stringify(bounds));
    const levels = await page.getByLabel("Levels shown", { exact: true }).boundingBox();
    assert.ok(
      levels.x >= 0 && levels.x + levels.width <= width && levels.y + levels.height <= 1000,
    );
    assert.equal(await page.locator(".model-group").count(), 0);
    const sourceCard = await page
      .locator(".record-node")
      .filter({ hasText: "UN-CLN-01" })
      .boundingBox();
    assert.ok(
      sourceCard.x >= bounds.x && sourceCard.x + sourceCard.width <= bounds.x + bounds.width,
      JSON.stringify(sourceCard),
    );
    await screenshot(`detail-folder-${width}`);
    await page.getByRole("button", { name: "← Back", exact: true }).click();
    await settled();
  }
  checks.push(
    "flat folder tracing and level controls remain reachable at 390/320px without page overflow",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  await writeFile(
    `${output}/detail-results.json`,
    JSON.stringify({ checks, errors, warnings }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
} catch (error) {
  await screenshot("detail-failure");
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
  throw error;
} finally {
  await browser.close();
}
