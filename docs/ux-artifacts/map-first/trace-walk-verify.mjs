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
const dialog = () => page.getByRole("dialog", { name: "Follow trace across folders", exact: true });
async function settled(selector = ".canvas") {
  await page.waitForFunction((selector) => {
    const canvas = document.querySelector(selector);
    return (
      canvas?.getAttribute("aria-busy") === "false" &&
      canvas.querySelectorAll(".react-flow__node").length === Number(canvas.dataset.nodeCount) &&
      canvas.querySelectorAll(".react-flow__edge").length === Number(canvas.dataset.edgeCount)
    );
  }, selector);
  assert.equal(await page.locator(".canvas-error").count(), 0);
}
const screenshot = (name) => page.screenshot({ path: `${output}/${name}.png` });
const map = () =>
  page.locator(".application").evaluate((app) => ({
    viewport: app.querySelector(".react-flow__viewport").style.transform,
    nodes: [...app.querySelectorAll(".react-flow__node")].map((node) => [
      node.dataset.id,
      node.style.transform,
      node.style.width,
      node.style.height,
    ]),
    paths: [...app.querySelectorAll(".react-flow__edge-path")].map((path) =>
      path.getAttribute("d"),
    ),
    heading: app.querySelector("h1").textContent,
    status: app.querySelector(".statusbar").textContent,
  }));
const positions = () =>
  dialog()
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      Object.fromEntries(nodes.map((node) => [node.dataset.id, node.style.transform])),
    );
const walkView = () =>
  dialog()
    .locator(".react-flow__viewport")
    .evaluate((node) => node.style.transform);
async function follow(key, kind) {
  await dialog()
    .getByRole("button", { name: `Follow ${key} via ${kind}`, exact: true })
    .click();
  await settled(".walk-canvas");
}
async function find(key) {
  await page.getByRole("searchbox", { name: "Find an item", exact: true }).fill(key);
  await page.locator(".search-results .search-hit").click();
  await settled();
}
try {
  await page.goto("http://127.0.0.1:4371/");
  await settled();
  await page.getByRole("button", { name: "Browse folders", exact: true }).click();
  const folders = page.getByRole("region", { name: "Folder browser", exact: true });
  await folders.locator("summary").filter({ hasText: "Product requirements" }).click();
  await folders.getByRole("button").filter({ hasText: "Power / Battery" }).click();
  await settled();
  const sourceId = await page
    .getByLabel("Trace a folder item", { exact: true })
    .locator("option")
    .filter({ hasText: "PRS-BAT-03" })
    .getAttribute("value");
  await page.getByLabel("Trace a folder item", { exact: true }).selectOption(sourceId);
  await settled();
  const original = await map();
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  await settled(".walk-canvas");
  assert.equal(await dialog().locator(".react-flow__node").count(), 1);
  assert.match(await dialog().locator(".walk-header").textContent(), /Trace · PRS-BAT-03/);
  assert.equal(await page.locator(".application").getAttribute("inert"), "");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await dialog().evaluate((node) => node.contains(document.activeElement)), true);
  await page.keyboard.press("Tab");
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Return to starting view", exact: false })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  const zoom = (await walkView()).match(/scale\(([^)]+)\)/)[1];
  for (const [key, kind] of [
    ["SYS-BAT-03A", "allocated to subsystem"],
    ["CMP-BAT-03A", "allocated to component"],
    ["OUT-BAT-03", "implemented by"],
    ["OUT-REC-03", "depends on"],
    ["VER-REC-03", "examines output"],
  ]) {
    const before = await positions();
    await follow(key, kind);
    const after = await positions();
    for (const [id, value] of Object.entries(before))
      assert.equal(after[id], value, "Existing path item moved");
    assert.equal(
      (await walkView()).match(/scale\(([^)]+)\)/)[1],
      zoom,
      "Following changed reading zoom",
    );
    assert.deepEqual(await map(), original, "Underlying folder map changed");
  }
  assert.equal(await dialog().locator(".react-flow__node").count(), 6);
  assert.match(
    await dialog().getByRole("complementary", { name: "Current path item" }).textContent(),
    /Usability \/ Result review/,
  );
  assert.match(await dialog().locator(".walk-outside").textContent(), /original filters kept/);
  assert.equal(await dialog().locator(".react-flow__node-modelGroup").count(), 0);
  await screenshot("trace-walk-cross-folder");
  checks.push(
    "following exact links crosses requirement levels and folders without expanding siblings, changing the starting map or reducing reading zoom",
  );

  await follow("OUT-REC-03", "examines output");
  assert.equal(await dialog().locator(".react-flow__node").count(), 6, "Revisit cloned an item");
  assert.match(
    await dialog().locator(".walk-status").textContent(),
    /6 followed steps · 6 unique items · 5 recorded links/,
  );
  const crumbs = dialog().getByRole("navigation", { name: "Followed path", exact: true });
  await crumbs.getByRole("button", { name: "OUT-REC-03", exact: true }).first().click();
  await settled(".walk-canvas");
  assert.equal(await dialog().locator(".react-flow__node").count(), 5);
  const branchPositions = await positions(),
    branchCamera = await walkView();
  await dialog()
    .getByRole("searchbox", { name: "Find a connection to follow", exact: true })
    .fill("supply integrity");
  assert.equal(await dialog().locator(".walk-options button").count(), 1);
  await follow("OUT-SUP-04", "depends on");
  await dialog().getByRole("button", { name: "Back one step", exact: false }).click();
  await settled(".walk-canvas");
  assert.deepEqual(await positions(), branchPositions);
  assert.equal(await walkView(), branchCamera);
  await dialog().getByRole("button", { name: "Return to starting view", exact: false }).click();
  await dialog().waitFor({ state: "detached" });
  assert.deepEqual(await map(), original);
  await page.waitForFunction(
    () => document.activeElement?.textContent.trim() === "Follow connections",
  );
  checks.push(
    "revisited records retain canonical identity; breadcrumb branching and Back restore prior path geometry/camera; returning restores the exact folder map and keyboard focus",
  );

  await find("CHG-BAT-REVIEW");
  const traceOriginal = await map();
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  await settled(".walk-canvas");
  assert.match(await dialog().locator(".walk-header").textContent(), /Trace · CHG-BAT-REVIEW/);
  assert.equal(await dialog().locator(".walk-options button").count(), 8);
  await dialog().getByRole("button", { name: "Next connection choices", exact: true }).click();
  assert.equal(await dialog().locator(".walk-options button").count(), 1);
  await dialog()
    .getByRole("searchbox", { name: "Find a connection to follow", exact: true })
    .fill("no such item");
  assert.equal(await dialog().locator(".walk-options button").count(), 0);
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "detached" });
  assert.deepEqual(await map(), traceOriginal);
  checks.push(
    "all recorded choices are searchable/paged beyond the old first-five preview, with clear empty results and exact focused-trace return on Escape",
  );

  // The compact inspector preview is also an actual follow action.
  await page.locator(".inspector-connections button").first().click();
  await settled(".walk-canvas");
  assert.equal(await dialog().locator(".react-flow__node").count(), 2);
  const shortcutPositions = await positions(),
    shortcutCamera = await walkView();
  await follow("CHG-BAT-REVIEW", "requires review of");
  await dialog().getByRole("button", { name: "Back one step", exact: false }).click();
  await settled(".walk-canvas");
  assert.deepEqual(await positions(), shortcutPositions);
  assert.equal(await walkView(), shortcutCamera);
  await dialog().getByRole("button", { name: "Return to starting view", exact: false }).click();
  await dialog().waitFor({ state: "detached" });
  while (await page.getByRole("button", { name: "← Previous trace", exact: true }).count()) {
    await page.getByRole("button", { name: "← Previous trace", exact: true }).click();
    await settled();
  }
  await page.getByRole("button", { name: /^← (Data model|Folder)$/ }).click();
  await settled();
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  await settled();
  await find("OUT-REC-03");
  await page.getByRole("button", { name: "Follow connections", exact: true }).click();
  await settled(".walk-canvas");
  await follow("OUT-SUP-04", "depends on");
  const horizontal = await dialog()
    .locator(".react-flow__node")
    .evaluateAll((nodes) => nodes.map((node) => node.style.transform));
  assert.notEqual(horizontal[0], horizontal[1]);
  await screenshot("trace-walk-horizontal");
  checks.push(
    "inspector connection previews start a two-item path directly; horizontal paths reveal the next item incrementally",
  );
  await dialog().getByRole("button", { name: "Return to starting view", exact: false }).click();
  await dialog().waitFor({ state: "detached" });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await settled();
    await page.getByRole("button", { name: "Item details", exact: true }).click();
    await page.getByRole("button", { name: "Follow connections", exact: true }).click();
    await settled(".walk-canvas");
    await follow("OUT-SUP-04", "depends on");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.ok((await dialog().locator(".walk-canvas").boundingBox()).height >= 180);
    const exit = await dialog()
      .getByRole("button", { name: "Return to starting view", exact: false })
      .boundingBox();
    assert.ok(
      exit.x >= 0 && exit.x + exit.width <= width && exit.y >= 0 && exit.y + exit.height < 1000,
    );
    await screenshot(`trace-walk-${width}`);
    await page.keyboard.press("Escape");
    await dialog().waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Close details", exact: true }).click();
  }
  checks.push(
    "390/320px paths keep a usable graph, scrollable connection choices and a reachable return control without page overflow",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  await writeFile(
    `${output}/trace-walk-results.json`,
    JSON.stringify({ checks, errors, warnings }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
} catch (error) {
  await screenshot("trace-walk-failure");
  console.log(JSON.stringify({ checks, errors, warnings }, null, 2));
  throw error;
} finally {
  await browser.close();
}
