import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const output = fileURLToPath(new URL("../../../../output/ux-reset/map-first/", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const flowWarnings = [];
page.on("console", (msg) => {
  if (["warning", "error"].includes(msg.type())) console.log("BROWSER", msg.text().slice(0, 500));
  if (msg.text().includes("[React Flow]")) flowWarnings.push(msg.text());
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
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
const viewport = () =>
  page.locator(".react-flow__viewport").evaluate((element) => element.style.transform);
async function screenshot(name) {
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function positions() {
  return page
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      Object.fromEntries(nodes.map((node) => [node.dataset.id, node.style.transform])),
    );
}
async function paths() {
  return page
    .locator(".react-flow__edge")
    .evaluateAll((edges) =>
      Object.fromEntries(
        edges.map((edge) => [
          edge.dataset.id,
          edge.querySelector(".react-flow__edge-path").getAttribute("d"),
        ]),
      ),
    );
}
async function dragNode(locator, dx, dy) {
  const box = await locator.boundingBox();
  const x = box.x + 35,
    y = box.y + 20;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

try {
  await page.goto("http://127.0.0.1:4371/");
  // Preserve the original direct-item interaction regressions alongside folder mode.
  await page.getByLabel("Group detail", { exact: true }).selectOption("items");
  await settled();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Expand Product requirements", exact: true }).waitFor();
  await settled();
  assert.equal(await page.locator(".react-flow__node").count(), 5);
  assert.match(await page.locator(".statusbar").textContent(), /350 records in scope/);
  assert.match(await viewport(), /scale\(0\.[89]|scale\(1/);
  await screenshot("model-desktop");
  checks.push("readable grouped model with exact scope counts");

  const originalPositions = await positions(),
    originalPaths = await paths();
  const originalScope = await page.locator(".statusbar").textContent();
  await dragNode(page.locator('[data-id="group:user_need"] .group-heading'), 120, 35);
  assert.notDeepEqual(await positions(), originalPositions);
  assert.notDeepEqual(await paths(), originalPaths, "Connections follow dragged nodes");
  await screenshot("manual-layout");
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await settled();
  assert.deepEqual(await positions(), originalPositions);
  assert.deepEqual(await paths(), originalPaths);
  assert.equal(await page.locator(".statusbar").textContent(), originalScope);
  checks.push(
    "dragging updates connections; Arrange restores clean positions/routes without changing scope",
  );

  await page.locator('[data-id="group:product_requirement"] .model-group').dblclick();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 5);
  assert.ok((await page.locator(".react-flow__edge").count()) > 5);
  assert.equal(await page.locator(".inspector").count(), 0);
  const group = await page.locator('[data-id="group:product_requirement"]').boundingBox();
  const canvas = await page.locator(".canvas").boundingBox();
  assert.ok(
    group.y >= canvas.y && group.y + group.height <= canvas.y + canvas.height,
    "Expanded group fits vertically in the readable viewport",
  );
  await screenshot("expanded-desktop");
  checks.push("double-click expands a bounded group and attaches traces to actual visible records");

  await dragNode(page.locator('[data-id="group:product_requirement"] .group-heading'), 30, 15);
  const previousPositions = await positions();
  const previousViewport = await viewport();
  await page.locator(".record-node").getByText("PRS-02", { exact: true }).click();
  await settled();
  assert.equal(await page.getByLabel("Levels shown", { exact: true }).inputValue(), "1");
  assert.equal(
    await page.getByLabel("Trace direction", { exact: true }).inputValue(),
    "downstream",
  );
  assert.match(await page.locator(".inspector .statement").textContent(), /./);
  assert.match(await page.locator("h1").textContent(), /Trace · PRS-02/);
  assert.ok((await page.locator(".record-node").count()) > 1);
  const tracePositions = await positions();
  await dragNode(page.locator(".record-node.root-record"), 60, 20);
  assert.notDeepEqual(await positions(), tracePositions);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await settled();
  assert.deepEqual(await positions(), tracePositions);
  assert.match(await page.locator("h1").textContent(), /Trace · PRS-02/);
  checks.push("focused records can be dragged and arranged while retaining trace scope");
  await page.getByLabel("Levels shown", { exact: true }).selectOption("2");
  await settled();
  await screenshot("trace-desktop");
  await page.getByRole("button", { name: "← Data model", exact: true }).click();
  await settled();
  assert.equal(await viewport(), previousViewport);
  assert.deepEqual(
    await positions(),
    previousPositions,
    "Manual model positions survive trace return",
  );
  assert.equal(await page.locator(".record-node").count(), 5);
  checks.push("focused trace, depth control and exact model-camera/expansion return");

  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 5);
  assert.match(await page.locator(".inspector").textContent(), /PRS-02/);
  assert.equal(await page.getByLabel("Map scope", { exact: true }).inputValue(), "requirements");
  assert.notDeepEqual(await positions(), previousPositions);
  checks.push("Arrange keeps expanded groups, current page, selected record and filters");

  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  await page.getByRole("button", { name: "Next 5 →", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").getByText("PRS-01", { exact: true }).count(), 0);
  assert.equal(await page.locator(".record-node").count(), 5);
  checks.push("group paging replaces only individually shown records");

  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByLabel("Connection labels", { exact: true }).selectOption("none");
  assert.equal(await page.locator(".edge-label").count(), 0);
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Vertical", exact: true }).click();
  await settled();
  await page.getByLabel("Connection labels", { exact: true }).selectOption("context");
  await page.getByRole("button", { name: "Close display", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("tab", { name: "Items", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").count(), 6);
  await screenshot("filters-items-desktop");
  await page.getByRole("tab", { name: "Connections", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").count(), 4);
  await page.getByText("Requirements → Verification plans", { exact: true }).waitFor();
  await screenshot("filters-connections-desktop");
  await page.locator(".other-connections > summary").click();
  await page.getByLabel("Evaluation input selection", { exact: true }).uncheck();
  await page.locator(".other-connections > summary").click();
  await page.getByLabel("Requirement verification", { exact: true }).uncheck();
  await settled();
  assert.ok((await page.locator(".react-flow__edge").count()) > 0);
  assert.equal(
    await page
      .locator(".react-flow__edge")
      .evaluateAll(
        (edges) => edges.filter((edge) => JSON.parse(edge.dataset.id)[2] === "verified_by").length,
      ),
    0,
  );
  await page
    .getByRole("button", { name: "Connections · 3/4 relevant kinds", exact: true })
    .waitFor();
  const filteredNodeCount = await page.locator(".react-flow__node").count();
  await page.getByRole("button", { name: "Hide all relevant", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".react-flow__edge").count(), 0);
  assert.equal(await page.locator(".react-flow__node").count(), filteredNodeCount);
  await page.getByRole("button", { name: "Show all relevant", exact: true }).click();
  await settled();
  await page.keyboard.press("Escape");
  checks.push("display changes and relationship filtering with explicit active scope");
  checks.push(
    "separate item/connection filters show grouped choices, endpoint meanings and exact relevant counts",
  );

  await page.getByLabel("Map scope", { exact: true }).selectOption("all");
  await settled();
  assert.equal(await page.locator(".model-group").count(), 13);
  await page
    .getByRole("button", { name: "Connections · 14/15 relevant kinds", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Evaluation input selection", { exact: true }).isChecked(),
    false,
  );
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await settled();
  assert.equal(await page.getByLabel("Map scope", { exact: true }).inputValue(), "requirements");
  assert.equal(await page.locator(".model-group").count(), 5);
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Connections · All 4 relevant kinds", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.getByLabel("Map scope", { exact: true }).selectOption("all");
  await settled();
  checks.push(
    "out-of-scope connection choices survive scope changes; reset and close restore a clear scope and keyboard focus",
  );
  assert.ok(
    (await page.locator(".edge-label").filter({ hasText: "allowed · 0 links" }).count()) > 0,
  );
  checks.push("all model types and allowed-but-unrecorded routes remain distinguishable");

  await page.getByLabel("Project", { exact: true }).selectOption("scale");
  await settled();
  assert.match(await page.locator(".rail-foot").textContent(), /9,900 records/);
  assert.equal(await page.locator(".model-group").count(), 5);
  await page.getByRole("button", { name: "Expand Product requirements", exact: true }).click();
  await settled();
  assert.equal(await page.locator(".record-node").count(), 5);
  await page.getByRole("searchbox", { name: "Find an item" }).fill("PRS-02.100");
  await page.locator(".search-results .search-hit").click();
  await settled();
  assert.match(await page.locator("h1").textContent(), /PRS-02.100/);
  await screenshot("scale-focused");
  checks.push("9,900-record dataset stays bounded and search locates an off-page identity");

  await page.getByRole("searchbox", { name: "Find an item" }).fill("DEV-01.100");
  await page.locator(".search-results .search-hit").click();
  await settled();
  await page.getByLabel("Levels shown", { exact: true }).selectOption("3");
  await settled();
  assert.equal(await page.locator(".record-node").count(), 30);
  assert.match(await page.locator(".scope-boundary").textContent(), /reached records not drawn/);
  checks.push("dense traces disclose omitted reached records at the drawing bound");

  await page.getByLabel("Project", { exact: true }).selectOption("aster");
  await settled();
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  await page.getByRole("button", { name: "Expand User needs", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  await page.getByRole("button", { name: "Expand Product requirements", exact: true }).click();
  await settled();
  const itemIds = await page
    .locator(".record-node")
    .evaluateAll((nodes) => nodes.map((node) => node.closest("[data-id]").dataset.id));
  const directCount = await page.locator(".react-flow__edge").evaluateAll(
    (edges, ids) =>
      edges.filter((edge) => {
        const [source, target] = JSON.parse(edge.dataset.id);
        return ids.includes(source) && ids.includes(target);
      }).length,
    itemIds,
  );
  assert.ok(directCount > 0, "Expanded groups show real record-to-record edges");
  assert.equal(itemIds.length, 10);
  for (const orientation of ["Horizontal", "Vertical"]) {
    await page.getByRole("button", { name: orientation, exact: true }).click();
    await settled();
    const verification = await page
      .locator('[data-id="group:verification_protocol"]')
      .boundingBox();
    const validation = await page.locator('[data-id="group:validation_protocol"]').boundingBox();
    if (orientation === "Horizontal")
      assert.ok(validation.x >= verification.x + verification.width);
    else assert.ok(validation.y >= verification.y + verification.height);
  }
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Frame all", exact: true }).click();
  await screenshot("item-traces-horizontal");
  checks.push(
    "two expanded groups expose item-to-item traces; validation follows verification in both visible orientation choices",
  );
  await page.getByLabel("Project", { exact: true }).selectOption("scale");
  await settled();
  await page.getByLabel("Project", { exact: true }).selectOption("aster");
  await settled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => {
      const canvas = document.querySelector(".canvas").getBoundingClientRect();
      return [...document.querySelectorAll(".model-group")].some((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left < canvas.right &&
          box.right > canvas.left &&
          box.top < canvas.bottom &&
          box.bottom > canvas.top
        );
      });
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.ok((await page.locator(".canvas").boundingBox()).height > 300);
    await page.getByRole("button", { name: "Display", exact: true }).click();
    const panel = await page.getByRole("region", { name: "Graph display" }).boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width);
    await page.getByRole("button", { name: "Close display", exact: true }).click();
    await page
      .getByRole("button", { name: "Items · Requirements flow · 5/13 types", exact: true })
      .click();
    const filters = await page.getByRole("region", { name: "Graph filters" }).boundingBox();
    assert.ok(filters.x >= 0 && filters.x + filters.width <= width);
    await page.getByRole("tab", { name: "Connections", exact: true }).click();
    assert.equal(await page.getByRole("checkbox").count(), 4);
    await screenshot(`filters-${width}`);
    await page.getByRole("button", { name: "Close filters", exact: true }).click();
    await screenshot(`model-${width}`);
  }
  checks.push("390/320px controls remain reachable without page overflow");
  assert.deepEqual(errors, []);
  assert.deepEqual(flowWarnings, []);
  await writeFile(
    `${output}/browser-results.json`,
    JSON.stringify({ checks, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        checks,
        errors,
        state: await page.locator(".canvas").evaluate((e) => ({
          busy: e.getAttribute("aria-busy"),
          layoutEdges: e.dataset.layoutEdgeCount,
          direction: e.dataset.direction,
          nodes: e.dataset.nodeCount,
          edges: e.dataset.edgeCount,
          actualNodes: e.querySelectorAll(".react-flow__node").length,
          actualEdges: e.querySelectorAll(".react-flow__edge").length,
        })),
        status: await page.locator(".statusbar").textContent(),
      },
      null,
      2,
    ),
  );
  await screenshot("failure");
  throw error;
} finally {
  await browser.close();
}
