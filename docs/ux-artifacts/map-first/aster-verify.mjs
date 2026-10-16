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
    const canvas = document.querySelector(".canvas");
    return (
      canvas?.getAttribute("aria-busy") === "false" &&
      document.querySelectorAll(".react-flow__node").length === Number(canvas.dataset.nodeCount) &&
      document.querySelectorAll(".react-flow__edge").length === Number(canvas.dataset.edgeCount)
    );
  });
  assert.equal(await page.locator(".canvas-error").count(), 0);
}
const screenshot = (name) => page.screenshot({ path: `${output}/${name}.png` });
const cards = () => page.locator(".record-node .record-key").allTextContents();
async function find(key) {
  await page.getByRole("searchbox", { name: "Find an item", exact: true }).fill(key);
  await page.locator(".search-results .search-hit").click();
  await settled();
}
try {
  await page.goto("http://127.0.0.1:4371/");
  await settled();
  assert.match(await page.locator(".rail-foot").textContent(), /622 records\s*1,138 connections/);
  const prior = await page
    .locator(".react-flow__viewport")
    .evaluate((node) => node.style.transform);
  await page.getByRole("button", { name: "Browse folders", exact: true }).click();
  const browserPanel = page.getByRole("region", { name: "Folder browser", exact: true });
  await browserPanel.locator("summary").filter({ hasText: "Product requirements" }).click();
  await browserPanel.getByRole("button").filter({ hasText: "Power / Battery" }).click();
  await settled();
  assert.equal(await page.locator(".record-node.root-record").count(), 5);
  assert.ok((await cards()).includes("PRS-12"));
  await page.getByRole("button", { name: "Next folder items", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node.root-record").count(), 2);
  assert.ok((await cards()).includes("PRS-BAT-06"));
  assert.match(
    await page.getByRole("region", { name: "Folder trace scope", exact: true }).textContent(),
    /of 7 folder items/,
  );
  await screenshot("aster-battery-page-two");
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await settled();
  assert.equal(
    await page.locator(".react-flow__viewport").evaluate((node) => node.style.transform),
    prior,
  );
  checks.push(
    "Aster starts with 622 authored records and 1,138 links; seven Battery requirements page completely and return to the exact map camera",
  );

  await find("UN-BAT-01");
  await page.getByLabel("Trace direction", { exact: true }).selectOption("downstream");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("3");
  await settled();
  const needCards = await cards();
  for (const key of [
    "UN-BAT-01",
    "PRS-BAT-01",
    "PRS-BAT-02",
    "SYS-BAT-01A",
    "SYS-BAT-01B",
    "CMP-BAT-01A",
    "CMP-BAT-01B",
    "VER-BAT-01",
    "VAL-BAT-01",
  ])
    assert.ok(needCards.includes(key), key);
  assert.equal(new Set(needCards).size, needCards.length);
  await screenshot("aster-battery-need-decomposition");
  await find("CMP-BAT-01A");
  const componentCards = await cards();
  assert.ok(componentCards.includes("OUT-BAT-01"));
  assert.ok(componentCards.includes("VER-BAT-01"));
  checks.push(
    "authored battery need traces through two product obligations into distinct subsystem/component allocations and separate V&V plans; component traces reach the shared design and verification plan",
  );

  await find("CHG-BAT-REVIEW");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("1");
  await settled();
  const reviewCards = await cards();
  for (const key of [
    "PRS-BAT-03",
    "OUT-BAT-03",
    "VER-BAT-03",
    "PRS-SUP-04",
    "OUT-SUP-04",
    "VER-SUP-04",
    "PRS-REC-03",
    "OUT-REC-03",
    "VER-REC-03",
  ])
    assert.ok(reviewCards.includes(key), key);
  await page.getByRole("button", { name: "Inspect all 9 connections", exact: true }).click();
  const tray = page.getByRole("region", { name: "Connection records", exact: true });
  assert.equal(await tray.locator("tbody tr").count(), 9);
  assert.equal(await tray.getByText("PRS-REC-03", { exact: true }).count(), 1);
  await screenshot("aster-battery-save-review");
  checks.push(
    "battery-save change review exposes all nine exact review subjects across Battery, Supply integrity and Result review without cloning their identities",
  );
  await tray.getByRole("button", { name: "Close connection records", exact: true }).click();

  while (await page.getByRole("button", { name: "← Previous trace", exact: true }).count()) {
    await page.getByRole("button", { name: "← Previous trace", exact: true }).click();
    await settled();
  }
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Working category", { exact: true }).selectOption("Power");
    await settled();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.ok((await page.locator(".canvas").boundingBox()).height > 180);
    await screenshot(`aster-expanded-${width}`);
    await page.getByLabel("Working category", { exact: true }).selectOption("All areas");
    await settled();
  }
  checks.push(
    "expanded Aster category scopes retain a usable graph and reachable controls at 390/320px",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  await writeFile(
    `${output}/aster-results.json`,
    JSON.stringify({ checks, errors, warnings }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
} catch (error) {
  await screenshot("aster-failure");
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
  throw error;
} finally {
  await browser.close();
}
