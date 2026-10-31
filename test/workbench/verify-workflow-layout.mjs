import assert from "node:assert/strict";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
const origin = process.env.TRACER_NATIVE_ORIGIN ?? "http://127.0.0.1:8176";
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const read = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
const screenshot = (name) => page.screenshot({ path: `output/product-identity/${name}.png` });
const camera = () => page.locator(".scene").evaluate((el) => getComputedStyle(el).transform);
const hit = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect(),
      top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return top === el || el.contains(top);
  });
const bounds = async () => {
  const canvas = await page.locator(".canvas").boundingBox();
  const boxes = await page.locator(".node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect(),
        title = node.querySelector("strong");
      const zoom = new DOMMatrix(getComputedStyle(document.querySelector(".scene")).transform).a;
      return {
        key: node.dataset.key,
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        titleVisible: getComputedStyle(title).display !== "none",
        screenFont: parseFloat(getComputedStyle(title).fontSize) * zoom,
      };
    }),
  );
  for (const box of boxes) {
    assert.ok(
      box.x >= canvas.x - 1 && box.right <= canvas.x + canvas.width + 1,
      `horizontal fit: ${JSON.stringify(box)}`,
    );
    assert.ok(
      box.y >= canvas.y - 1 && box.bottom <= canvas.y + canvas.height + 1,
      `vertical fit: ${JSON.stringify(box)}`,
    );
    assert.ok(box.titleVisible, `missing title: ${box.key}`);
    assert.ok(box.screenFont >= 10.9, `title too small: ${JSON.stringify(box)}`);
  }
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1))
      assert.ok(
        a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y,
        `overlapping nodes ${JSON.stringify(a)}/${JSON.stringify(b)}`,
      );
};
try {
  const before = await read();
  const key =
    process.env.TRACER_FLOW_KEY ??
    (before.entities.some((e) => e.key === "PRS-FLOW-01") ? "PRS-FLOW-01" : "PRS-02");
  const record = before.entities.find((e) => e.key === key);
  const history = await (await page.request.get(origin + "/api/history?limit=1000")).json();
  assert.ok(!history.nextAfter, "Use this bounded fixture check with complete native history.");
  const revision = Math.max(
    ...history.items.filter((e) => e.id === record.id).map((e) => e.projectRevision),
  );
  for (const width of [1440, 680]) {
    await page.setViewportSize({ width, height: width === 680 ? 900 : 1000 });
    await page.goto(origin + "/?native=1&presentation=1&view=matrix");
    await page.locator('[data-matrix-mode="traceability"]').click();
    await page.locator('[role="grid"]').waitFor();
    await page.locator('[data-action="search"]').click();
    await page.locator("#search").fill(key);
    await page.locator(`[data-result="${key}"]`).click();
    await page.locator('[data-view="history"]').click();
    if (Number(await page.locator("#revision-range").inputValue()) !== revision) {
      await page.locator("#revision-range").fill(String(revision));
      await page.locator("#revision-range").dispatchEvent("change");
    }
    await page.locator('[data-action="inspect-revision"]').click();
    assert.equal(await page.locator(".node.selected").getAttribute("data-key"), key);
    // No Fit click is made before checking entry framing and readable titles.
    await bounds();
    await screenshot(`layout-investigation-arrival-${width}`);
    const ids = await page
      .locator(".edgehit")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.edge).sort());
    if (width === 680) {
      if (!(await page.locator(".inspector").count()))
        await page.locator('[data-action="details"]').click();
      for (const state of ["collapsed", "partial"]) {
        if (state === "partial") await page.locator('[data-action="expand-sheet"]').click();
        for (const action of ["zoom-out", "frame", "zoom-in"])
          assert.ok(
            await hit(page.locator(`[data-action="${action}"]`)),
            `${action} covered by ${state} sheet`,
          );
        await page.locator('[data-action="frame"]').click();
        await bounds();
        const sheet = await page.locator(".inspector").boundingBox(),
          tools = await page.locator(".canvas-tools").boundingBox();
        assert.ok(tools.y + tools.height + 8 <= sheet.y);
        const nodes = await page
          .locator(".node")
          .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().bottom));
        assert.ok(
          nodes.every((bottom) => bottom < tools.y),
          `nodes extend into controls/sheet at ${state}`,
        );
        await screenshot(`layout-sheet-${state}-${width}`);
      }
      await page.locator('[data-action="collapse-sheet"]').click();
      await page.locator('[data-action="frame"]').click();
    }
    // Manual distant zoom may reduce detail; Fit must restore titles and full scope.
    const area = await page.locator(".canvas").boundingBox();
    await page.mouse.move(area.x + area.width * 0.5, area.y + 50);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(60);
    await page.locator('[data-action="frame"]').click();
    await bounds();
    // A selection/lens return must not unexpectedly reframe the user's camera.
    await page.mouse.move(area.x + 20, area.y + 20);
    await page.mouse.down();
    await page.mouse.move(area.x + 35, area.y + 30);
    await page.mouse.up();
    const moved = await camera();
    await page.locator(".node:not(.selected)").first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await camera(), moved);
    await page.locator('[data-view="matrix"]').click();
    await page.locator('[data-matrix-mode="relationships"]').click();
    assert.deepEqual(
      await page
        .locator("[data-matrix-edge]")
        .evaluateAll((es) => es.map((e) => e.dataset.matrixEdge).sort()),
      ids,
    );
    await page.locator('[data-view="graph"]').click();
    assert.equal(await camera(), moved);
  }
  // Inspect the sticky row identity in actual horizontal overflow, with/without selection.
  await page.setViewportSize({ width: 680, height: 900 });
  await page.goto(origin + "/?native=1&presentation=1&view=matrix");
  await page.locator('[data-matrix-mode="traceability"]').click();
  await page.locator('[role="grid"]').waitFor();
  const scroll = page.locator(".matrix-scroll");
  await scroll.evaluate((el) => (el.scrollLeft = el.scrollWidth - el.clientWidth));
  const source = page.locator('[data-grid-col="0"]').first();
  const opacity = () =>
    source.evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      isolation: getComputedStyle(el).isolation,
    }));
  for (const selected of [false, true]) {
    if (selected) {
      await source.locator("[data-grid-artifact]").first().click();
      await page.locator("[data-grid-edit]").waitFor();
    }
    const paint = await opacity();
    assert.ok(
      /^rgb\(/.test(paint.background),
      `sticky identity is transparent: ${JSON.stringify(paint)}`,
    );
    assert.equal(paint.isolation, "isolate");
    const col = await source.boundingBox(),
      port = await scroll.boundingBox();
    assert.ok(Math.abs(col.x - port.x) < 2);
    await screenshot(`layout-sticky-identity-${selected ? "selected" : "unselected"}-680`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal((await read()).projectRevision, before.projectRevision);
  assert.deepEqual(errors, []);
  console.log(
    "Workflow layout passed: automatic entry framing, readable fitted titles, clickable controls above collapsed/partial sheets, retained user camera, exact cross-view link identities and opaque sticky columns in both selection states. Read-only checks; no page errors.",
  );
} finally {
  await browser.close();
}
