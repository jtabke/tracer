import assert from "node:assert/strict";
import { wheelIntent } from "./canvas-input.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
import { snapshotAt, diffAt, allowedTypes } from "./workspace-model.mjs";
import {
  relationshipLabel,
  historyFeed,
  focusedNeighborhood,
  connectedWork,
  potentialPaths,
} from "./workspace-journeys.mjs";
assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 2, deltaMode: 1 }, 800), {
  kind: "zoom",
  delta: 32,
});
assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 1, deltaMode: 2, shiftKey: true }, 800), {
  kind: "pan",
  x: 800,
  y: 0,
});
assert.deepEqual(wheelIntent({ deltaX: 6, deltaY: 12, deltaMode: 0 }, 800), {
  kind: "zoom",
  delta: 12,
});
assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 1.25, deltaMode: 0 }, 800), {
  kind: "zoom",
  delta: 1.25,
});
assert.deepEqual(wheelIntent({ deltaX: 6, deltaY: 0, deltaMode: 0 }, 800), {
  kind: "pan",
  x: 6,
  y: 0,
});
assert.deepEqual(wheelIntent({ deltaX: 6, deltaY: 12, deltaMode: 0, shiftKey: true }, 800), {
  kind: "pan",
  x: 6,
  y: 12,
});
assert.deepEqual(wheelIntent({ deltaX: 0, deltaY: 12, deltaMode: 0, ctrlKey: true }, 800), {
  kind: "zoom",
  delta: 12,
});
const data = JSON.parse(readFileSync(new URL("./data.json", import.meta.url))),
  head = data.snapshotReference.revision,
  latest = snapshotAt(data, head);
const output = new URL("../../../output/product-identity/", import.meta.url).pathname;
mkdirSync(output, { recursive: true });
const origin = process.env.TRACER_STUDY_ORIGIN ?? "http://127.0.0.1:8173",
  url = `${origin}${process.env.TRACER_STUDY_PATH ?? "/docs/ux-artifacts/product-identity/"}?presentation=1`;
assert.equal(latest.records.size, 113);
assert.equal(latest.links.length, 282);
assert.equal(relationshipLabel("decomposes_into", false), "Decomposed from");
assert.equal(relationshipLabel("verified_by", false), "Verification criteria for");
const verification = latest.links.find(
  (link) => link.source === "PRS-01" && link.target === "VER-03",
);
assert.ok(
  historyFeed(data, { linkId: verification.id }).every((event) =>
    event.entries.every((entry) => entry.id === verification.id),
  ),
);
assert.ok(connectedWork(data, 399).some((item) => item.record.key === "VER-01"));
assert.ok(connectedWork(data, 399).some((item) => item.record.key === "SYS-02"));
assert.equal(snapshotAt(data, 398).records.get("PRS-02").version, 1);
assert.equal(latest.records.get("PRS-02").version, 2);
assert.ok(diffAt(data, 399)[0].fields.some((field) => field.key === "statement"));
const depth = focusedNeighborhood(latest, "PRS-01", {
  direction: "downstream",
  depth: 3,
  verification: true,
});
assert.ok(depth.keys.includes("VER-03"));
assert.ok(depth.keys.some((key) => key.startsWith("CMP-")));
assert.equal(new Set(depth.keys).size, depth.keys.length);
assert.deepEqual(
  allowedTypes(data.schema, latest.records.get("VER-03"), latest.records.get("PRS-01")),
  [],
);
// Deleted versions must remain in an artifact/relationship's history scope.
const deleted = {
  ...data,
  revisions: [
    ...data.revisions,
    { kind: "relationship", id: verification.id, projectRevision: 400, version: 2, snapshot: null },
  ],
  changesets: [
    ...data.changesets,
    { projectRevision: 400, reason: "Synthetic deletion regression" },
  ],
};
assert.equal(historyFeed(deleted, { linkId: verification.id })[0].operation, "Removed");
const potential = potentialPaths(data, 399);
assert.ok(potential.keys.includes("SYS-02"));
assert.ok(potential.keys.includes("VER-01"));
assert.ok(potential.links.every((link) => latest.links.some((native) => native.id === link.id)));
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 }),
  errors = [];
page.setDefaultTimeout(10000);
page.on("pageerror", (error) => errors.push(error.message));
const node = (key) => page.locator(`.node[data-key="${key}"]`),
  capture = (name) => page.screenshot({ path: `${output}${name}.png` });
const point = (key) => node(key).evaluate((el) => ({ x: el.style.left, y: el.style.top }));
const selectNode = async (key) => {
  await node(key).click();
  await page.waitForFunction(
    (key) => document.querySelector(".node.selected")?.dataset.key === key,
    key,
  );
};
const reset = async () => {
  await page.goto(url);
  await page.locator(".node").first().waitFor();
};
const search = async (key) => {
  await page.keyboard.press("/");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
};
const drag = async (key) => {
  const box = await node(key).boundingBox();
  await page.mouse.move(box.x + 40, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 });
  await page.mouse.up();
};
try {
  await reset();
  // View configuration is directly operable rather than hidden in disclosure menus.
  for (const width of [1440, 680, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    assert.equal(await page.locator(".graph-toolbar details").count(), 0);
    for (const selector of ["#focus-direction", "#focus-depth", "#node-detail"]) {
      assert.equal(await page.locator(selector).isVisible(), true);
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
    }
    await page.locator("#node-detail").selectOption("expanded");
    assert.equal(await page.locator(".density-expanded").count(), 1);
    await page.locator("#node-detail").selectOption("compact");
    assert.equal(await page.locator("#database-picker").isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reset();
  assert.equal(await page.locator(".node").count(), 6);
  assert.equal(await page.locator(".edgehit").count(), 6);
  assert.equal(await page.locator(".topbar [data-view]").count(), 3);
  assert.equal(await page.locator(".context [data-view]").count(), 0);
  assert.equal(await page.locator(".context h1").textContent(), "Requirement trace");
  assert.equal(
    await page.locator(".inspector h2").textContent(),
    latest.records.get("PRS-01").title,
  );
  assert.equal(await page.locator(".artifact-status").count(), 0);
  assert.ok((await page.locator(".relationship-groups").textContent()).includes("Decomposed from"));
  assert.ok(
    !(await page.locator(".relationship-groups h4").allTextContents()).some(
      (text) => text.includes("←") || text.includes("→"),
    ),
  );
  const boxes = [];
  for (const key of data.trace.keys) {
    assert.equal(await node(key).locator("strong").textContent(), latest.records.get(key).title);
    const box = await node(key).boundingBox();
    assert.ok(box.height < 80);
    for (const other of boxes)
      assert.ok(
        box.x + box.width <= other.x ||
          other.x + other.width <= box.x ||
          box.y + box.height <= other.y ||
          other.y + other.height <= box.y,
      );
    boxes.push(box);
  }
  await capture("workflow-discover");
  assert.equal(await page.locator("[data-mode]").count(), 0);
  // Wheel zoom preserves the world point under the cursor and does not scroll the page.
  const canvasBox = await page.locator(".canvas").boundingBox();
  // Chromium reports integer mouse coordinates; use the actual pointer anchor after layout changes.
  const pointer = {
    x: Math.round(canvasBox.x + canvasBox.width * 0.4),
    y: Math.round(canvasBox.y + canvasBox.height * 0.4),
  };
  const zoomPoint = { x: pointer.x - canvasBox.x, y: pointer.y - canvasBox.y };
  const camera = () =>
    page.locator(".scene").evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { zoom: m.a, x: m.e, y: m.f, scroll: window.scrollY };
    });
  const beforeZoom = await camera();
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(
    () => parseFloat(document.querySelector(".canvas").style.getPropertyValue("--camera-zoom")) > 1,
  );
  const afterZoom = await camera();
  assert.ok(afterZoom.zoom > beforeZoom.zoom);
  assert.ok(
    Math.abs(
      (zoomPoint.x - beforeZoom.x) / beforeZoom.zoom - (zoomPoint.x - afterZoom.x) / afterZoom.zoom,
    ) < 0.01,
  );
  assert.equal(afterZoom.scroll, beforeZoom.scroll);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(
    () =>
      Math.abs(
        parseFloat(document.querySelector(".canvas").style.getPropertyValue("--camera-zoom")) - 1,
      ) < 0.001,
  );
  const beforePan = await camera();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 120);
  await page.keyboard.up("Shift");
  await page.waitForFunction(
    (x) => new DOMMatrix(getComputedStyle(document.querySelector(".scene")).transform).e !== x,
    beforePan.x,
  );
  const shifted = await camera();
  assert.equal(shifted.zoom, beforePan.zoom);
  assert.ok(shifted.x < beforePan.x);
  assert.equal(await page.locator("#canvas-input").count(), 0);
  // Pixel-precision trackpad scroll follows the same zoom map, without a preference.
  const beforeSmoothZoom = await camera();
  await page.mouse.wheel(1.5, -8.25);
  await page.waitForFunction(
    (zoom) => new DOMMatrix(getComputedStyle(document.querySelector(".scene")).transform).a > zoom,
    beforeSmoothZoom.zoom,
  );
  const afterSmoothZoom = await camera();
  assert.ok(
    Math.abs(
      (zoomPoint.x - beforeSmoothZoom.x) / beforeSmoothZoom.zoom -
        (zoomPoint.x - afterSmoothZoom.x) / afterSmoothZoom.zoom,
    ) < 0.01,
  );
  // Shift-scroll pans in two axes on either device; horizontal-only scroll also pans.
  const trackpadBefore = await camera();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(35, 65);
  await page.keyboard.up("Shift");
  await page.waitForFunction(
    (y) => new DOMMatrix(getComputedStyle(document.querySelector(".scene")).transform).f !== y,
    trackpadBefore.y,
  );
  const trackpadAfter = await camera();
  assert.equal(trackpadAfter.zoom, trackpadBefore.zoom);
  assert.ok(trackpadAfter.x < trackpadBefore.x && trackpadAfter.y < trackpadBefore.y);
  await page.locator(".canvas").dispatchEvent("wheel", {
    deltaY: -40,
    deltaX: 0,
    ctrlKey: true,
    clientX: canvasBox.x + zoomPoint.x,
    clientY: canvasBox.y + zoomPoint.y,
    bubbles: true,
    cancelable: true,
  });
  assert.ok((await camera()).zoom > trackpadAfter.zoom);

  await reset();
  const nodeBeforePan = await point("PRS-01"),
    nodeBounds = await node("PRS-01").boundingBox();
  await page.locator(".context h1").click();
  const spaceBefore = await camera();
  await page.keyboard.down("Space");
  await page.mouse.move(nodeBounds.x + 30, nodeBounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(nodeBounds.x + 65, nodeBounds.y + 55, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  assert.deepEqual(await point("PRS-01"), nodeBeforePan);
  assert.ok((await camera()).x > spaceBefore.x);
  const middleBefore = await camera();
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 100);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(canvasBox.x + 420, canvasBox.y + 130, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  assert.ok((await camera()).y > middleBefore.y);
  await reset();
  // All relationships are visible without opening groups.
  await selectNode("SYS-04");
  assert.equal(await page.locator(".inspector details").count(), 0);
  assert.equal(await page.locator(".relationship-entry").count(), 5);
  for (const entry of await page.locator(".relationship-entry").all())
    assert.equal(await entry.isVisible(), true);
  await capture("direct-controls-inspector");
  await selectNode("PRS-01");
  // Discover: organized expansion, contraction, focus and return.
  const root = await point("PRS-01");
  await page.locator('[data-node-action="expand"]').click();
  assert.equal(await page.locator(".node").count(), 9);
  assert.deepEqual(await point("PRS-01"), root);
  const expandedBoxes = await page.locator(".node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }),
  );
  const expandedCanvas = await page.locator(".canvas").boundingBox();
  for (const [index, box] of expandedBoxes.entries()) {
    assert.ok(box.x >= expandedCanvas.x && box.right <= expandedCanvas.x + expandedCanvas.width);
    assert.ok(box.y >= expandedCanvas.y && box.bottom <= expandedCanvas.y + expandedCanvas.height);
    for (const other of expandedBoxes.slice(index + 1))
      assert.ok(
        box.right <= other.x ||
          other.right <= box.x ||
          box.bottom <= other.y ||
          other.bottom <= box.y,
      );
  }
  await capture("organized-expanded-graph");
  await page.locator('[data-node-action="collapse"]').click();
  assert.equal(await page.locator(".node").count(), 6);
  await page.locator('#focus-form [name="depth"]').selectOption("3");
  await page.locator('#focus-form button[type="submit"]').click();
  assert.ok((await page.locator(".node").count()) > 6);
  assert.deepEqual(await point("PRS-01"), root);
  await page.locator(".return-scope").click();
  assert.equal(await page.locator(".node").count(), 6);
  await page.locator('[data-node-action="more"]').click();
  await page.locator('[data-action="pin"]').click();
  await drag("PRS-01");
  assert.deepEqual(await point("PRS-01"), root);
  await page.locator('[data-node-action="more"]').click();
  await page.locator('[data-action="pin"]').click();
  await drag("SYS-04");
  // Matrix is a lens on the selection, not a new unscoped register. Relationship selection survives all views.
  await selectNode("PRS-01");
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.equal(await page.locator("tr.selected .mono").first().textContent(), "PRS-01");
  await page.getByRole("button", { name: "PRS-01 verified by VER-03", exact: true }).click();
  await page.locator('[data-view="history"]').click();
  assert.ok(
    (await page.locator("#event-filter option:checked").textContent()).includes("PRS-01 → VER-03"),
  );
  assert.equal(await page.locator(".changeset-feed [data-event]").count(), 1);
  assert.equal(
    await page.locator(".changeset-feed [data-event]").getAttribute("data-event"),
    String(historyFeed(data, { linkId: verification.id })[0].revision),
  );
  assert.equal(await page.locator(".history-events").count(), 0);
  assert.equal(await page.locator(".event-timeline").count(), 0);
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  assert.ok(
    (await page.locator(".change-heading").textContent()).includes(
      "No change to this selection at r399",
    ),
  );
  await page.locator(".changeset-feed [data-event]").click();
  assert.equal(
    await page.locator("#revision-range").inputValue(),
    String(historyFeed(data, { linkId: verification.id })[0].revision),
  );
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator(".selected-link").count(), 1);
  await capture("workflow-matrix-context");
  // Modify: direct field edits; validation, shared projections, draft retention and read-only history.
  await reset();
  await page.locator('[data-edit-field="statement"]').click();
  await page.locator("#inline-value").fill("");
  await page.locator('[data-apply-field="statement"]').click();
  assert.ok((await page.locator(".workspace-notice").textContent()).includes("required"));
  await page.locator("#inline-value").fill("Locally revised completed measurement statement.");
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator(".inspector").count(), 0);
  await page.locator('[data-action="details"]').click();
  await page.locator('[data-edit-field="statement"]').click();
  assert.equal(
    await page.locator("#inline-value").inputValue(),
    "Locally revised completed measurement statement.",
  );
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-apply-field="statement"]').click();
  assert.ok(
    (await page.locator('[data-edit-field="statement"]').textContent()).includes("Locally revised"),
  );
  await page.locator('[data-edit-field="acceptance"]').click();
  await page.locator("#inline-value").fill("Locally revised acceptance criterion.");
  await page.locator('[data-apply-field="acceptance"]').click();
  assert.ok(
    (await page.locator('[data-edit-field="acceptance"]').textContent()).includes(
      "Locally revised acceptance",
    ),
  );
  await page.locator('[data-edit-field="statement"]').click();
  await page.locator("#inline-value").fill("Cancelled change");
  await page.locator('[data-action="cancel-inline"]').click();
  assert.ok(
    !(await page.locator('[data-edit-field="statement"]').textContent()).includes("Cancelled"),
  );
  await page.locator(".inspector-resize").focus();
  await page.keyboard.press("ArrowLeft");
  assert.ok((await page.locator(".view").boundingBox()).width >= 640);
  const beforeEditor = await point("PRS-01");
  await page.locator('[aria-label="Open artifact editor"]').click();
  assert.equal(await page.locator(".inspector.full-artifact").count(), 1);
  assert.ok(await page.locator(".view").evaluate((el) => el.inert));
  await capture("workflow-artifact-editor");
  await page.locator('[data-action="back-workspace"]').click();
  assert.equal(await page.locator(".inspector.full-artifact").count(), 0);
  assert.deepEqual(await point("PRS-01"), beforeEditor);
  await node("SYS-10").dblclick();
  await page.locator("#draft-title").fill("Local atomic reading draft");
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator("#draft-title").inputValue(), "Local atomic reading draft");
  await page.locator('[data-action="apply-edit"]').click();
  await page.locator('[data-view="graph"]').click();
  assert.equal(await node("SYS-10").locator("strong").textContent(), "Local atomic reading draft");
  await page.locator("#link-filter").selectOption("verified_by");
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator("#matrix-filter").inputValue(), "verified_by");
  await page.locator('[data-view="graph"]').click();
  assert.equal(await page.locator("#link-filter").inputValue(), "verified_by");
  await page.locator("#link-filter").selectOption("all");
  // Actual project search/commands and schema-permitted local connection editing/removal.
  await search("PRS-02");
  await page.keyboard.press("/");
  await page.locator("#search").fill("Fit graph");
  await page.locator("[data-command]").click();
  assert.equal(await page.locator(".canvas").count(), 1);
  await page.locator('[data-node-action="connect"]').click();
  await page.locator("#connection-source").fill("PRS-02");
  await page.locator("#connection-target").fill("VER-03");
  await page.locator("#connection-type").selectOption("verified_by");
  await page.locator('textarea[name="scope"]').fill("Local workflow verification link");
  await page.locator('#connection-form button[type="submit"]').click();
  const localLink = () => page.locator('.edgehit[aria-label="PRS-02 verified by VER-03"]');
  await localLink().focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-action="relationship-history"]').click();
  assert.ok(
    (await page.locator(".history-workspace").textContent()).includes("No recorded revisions"),
  );
  assert.equal(await page.locator(".field-diff").count(), 0);
  await page.locator('[data-view="graph"]').click();
  await localLink().focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-action="edit-edge"]').click();
  await page.locator('textarea[name="scope"]').fill("Revised local scope");
  await page.locator('#connection-form button[type="submit"]').click();
  await localLink().focus();
  await page.keyboard.press("Enter");
  assert.ok((await page.locator(".edge-detail").textContent()).includes("Revised local scope"));
  await page.locator('[data-action="remove-edge"]').click();
  assert.equal(await localLink().count(), 0);
  // Assess: changed fields + real connected work, distinct from assessed impacts.
  await reset();
  await search("PRS-02");
  await page.locator('[data-view="history"]').click();
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  assert.ok((await page.locator(".field-diff .before").textContent()).includes("15–35"));
  assert.ok((await page.locator(".field-diff .after").textContent()).includes("10–40"));
  assert.ok((await page.locator(".connected-work").textContent()).includes("not assessed impacts"));
  assert.ok(await page.locator('[data-review-artifact="VER-01"]').count());
  assert.ok(await page.locator('[data-review-artifact="SYS-02"]').count());
  await capture("workflow-assess");
  await page.locator('[data-review-artifact="VER-01"]').click();
  assert.equal(
    await page.locator(".inspector h2").textContent(),
    "Pressure-channel bench characterization",
  );
  assert.ok((await page.locator("#event-filter option:checked").textContent()).includes("PRS-02"));
  assert.ok((await page.locator(".field-diff .after").textContent()).includes("10–40"));
  await page.locator('[data-action="inspect-revision"]').first().click();
  assert.equal(await node("PRS-02").locator(".change-mark").textContent(), "Δ");
  assert.equal(await page.locator(".node.changed").count(), 1);
  assert.ok(await node("VER-01").count());
  await capture("workflow-change-graph");
  const anchor = await point("PRS-02");
  await page.locator('[data-view="history"]').click();
  await page.keyboard.press("ArrowLeft");
  assert.ok(Number(await page.locator("#revision-range").inputValue()) < 399);
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  await page.locator('[data-view="graph"]').click();
  assert.deepEqual(await point("PRS-02"), anchor);
  // Revision axis uses actual project revisions and locks all edit entry points.
  await page.locator("#revision-range").fill("398");
  await page.locator("#revision-range").dispatchEvent("change");
  assert.equal(await page.locator('[data-node-action="edit"]').isDisabled(), true);
  assert.equal(await page.locator('[data-edit-field="statement"]').count(), 0);
  await page.locator('[data-action="latest"]').click();
  // Blank-canvas add/create is local, and reload restores canonical records/links.
  await page.locator(".canvas").dblclick({ position: { x: 25, y: 35 } });
  await page.locator("#create-new").click();
  await page.locator('#create-form [name="type"]').selectOption("product_requirement");
  await page.locator('#create-form [name="key"]').fill("LOCAL-01");
  await page.locator('#create-form [name="title"]').fill("Local workflow artifact");
  await page.locator('#create-form [name="statement"]').fill("Local only.");
  await page.locator('#create-form button[type="submit"]').click();
  assert.ok(await node("LOCAL-01").count());
  await reset();
  assert.equal(await node("LOCAL-01").count(), 0);
  assert.equal(
    await node("SYS-10").locator("strong").textContent(),
    latest.records.get("SYS-10").title,
  );
  // Dedicated demonstration: preserve engineering state and view-specific inspector preferences.
  await reset();
  await search("PRS-02");
  await page.locator('[data-view="history"]').click();
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  assert.ok((await page.locator(".inspector-state").textContent()).includes("r399 · Latest"));
  await capture("cross-view-history");
  await page.locator('[data-action="inspect-revision"]').click();
  assert.equal(await page.locator(".node.selected").getAttribute("data-key"), "PRS-02");
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  const graphLinks = (
    await page.locator(".edgehit").evaluateAll((nodes) => nodes.map((node) => node.dataset.edge))
  ).sort();
  assert.deepEqual(graphLinks, [...potential.links.map((link) => link.id)].sort());
  const changePosition = await point("PRS-02");
  assert.equal(await page.locator(".node.changed").count(), 1);
  assert.equal(await page.locator(".recorded-path").count(), graphLinks.length);
  await page.locator(".path-summary summary").click();
  assert.ok((await page.locator(".path-summary").textContent()).includes("verified by"));
  await page.locator(".path-summary summary").click();
  await capture("cross-view-graph");
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  const closedGraphPosition = await point("PRS-02");
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator(".inspector").count(), 0);
  assert.equal(await page.locator("#matrix-scope").inputValue(), "neighborhood");
  const matrixLinks = (
    await page
      .locator("[data-matrix-edge]")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.matrixEdge))
  ).sort();
  assert.deepEqual(matrixLinks, graphLinks);
  await page.getByRole("button", { name: "PRS-02 verified by VER-01", exact: true }).click();
  assert.equal(await page.locator('[aria-label="Relationship inspector"]').count(), 1);
  assert.equal(await page.locator(".inspector .statement").count(), 0);
  assert.ok((await page.locator(".relationship-endpoints").textContent()).includes("PRS-02"));
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  await capture("cross-view-matrix");
  await page.locator('[data-action="return-change"]').click();
  assert.ok((await page.locator(".field-diff .after").textContent()).includes("10–40"));
  assert.ok(
    (await page.locator("#event-filter option:checked").textContent()).includes("PRS-02 only"),
  );
  assert.equal(await page.locator("#revision-range").inputValue(), "399");
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  await page.locator('[data-view="graph"]').click();
  assert.equal(await page.locator(".inspector").count(), 0);
  assert.deepEqual(await point("PRS-02"), closedGraphPosition);
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator('[aria-label="Relationship inspector"]').count(), 1);
  await page.locator('[data-action="return-change"]').click();
  assert.equal(await page.locator(".inspector").count(), 0);
  // Explicit historical state in the artifact inspector, without silently changing the revision on view switches.
  await page.locator("#revision-range").fill("398");
  await page.locator("#revision-range").dispatchEvent("change");
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-action="details"]').click();
  assert.ok((await page.locator(".inspector-state").textContent()).includes("r398 · Historical"));
  assert.ok((await page.locator(".statement").textContent()).includes("15–35"));
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator("#revision-range").inputValue(), "398");
  await page.locator('[data-action="return-change"]').click();
  await page.locator("#timeline-scope").selectOption("selected");
  assert.equal(await page.locator("#revision-range").getAttribute("max"), "399");
  assert.ok(await page.locator("[data-axis-event]").count());
  const marker = page.locator("[data-axis-event]").first();
  const markerRevision = Number(await marker.getAttribute("data-axis-event"));
  assert.ok(
    Math.abs(
      (await marker.evaluate((el) => parseFloat(el.style.left))) -
        ((markerRevision - 1) / (head - 1)) * 100,
    ) < 0.001,
  );
  await reset();
  // Inspector supplements the workspace. Full artifact editing is an explicit transition.
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForFunction(() => document.body.dataset.panel === "drawer");
  const drawerControls = page.locator(
    '.inspector button:not(:disabled), .inspector input, .inspector textarea, .inspector select, .inspector [tabindex="0"]',
  );
  await drawerControls.last().focus();
  await page.keyboard.press("Tab");
  assert.equal(await drawerControls.first().evaluate((el) => document.activeElement === el), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await drawerControls.last().evaluate((el) => document.activeElement === el), true);
  assert.equal(await page.locator(".inspector").getAttribute("aria-modal"), "true");
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  await page.setViewportSize({ width: 680, height: 900 });
  await page.waitForFunction(() => document.body.dataset.panel === "sheet");
  await page.locator('[data-action="details"]').click();
  assert.equal(await page.locator(".inspector").getAttribute("aria-modal"), null);
  assert.equal(await page.locator(".view").evaluate((el) => el.inert), false);
  const sheet = await page.locator(".inspector").boundingBox(),
    area = await page.locator(".workarea").boundingBox();
  assert.ok(sheet.height <= 90);
  assert.equal(await page.locator(".canvas.zoom-overview").count(), 0);
  for (const key of data.trace.keys) {
    assert.equal(await node(key).locator("strong").isVisible(), true);
    assert.ok(
      await node(key)
        .locator("strong")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 11),
    );
  }

  await capture("cross-view-narrow-collapsed");
  await page.locator('[data-action="expand-sheet"]').click();
  assert.ok((await page.locator(".inspector").boundingBox()).height <= area.height * 0.35);
  await capture("cross-view-narrow-partial");
  await page.locator('[data-action="collapse-sheet"]').click();
  assert.ok((await page.locator(".inspector").boundingBox()).height <= 90);
  await capture("workflow-narrow-inspector");
  await page.locator('[aria-label="Open artifact editor"]').click();
  assert.equal(
    Math.round((await page.locator(".inspector.full-artifact").boundingBox()).width),
    Math.round(area.width),
  );
  await capture("workflow-narrow-editor");
  await page.locator('[data-action="back-workspace"]').click();
  assert.equal(await page.locator(".inspector.full-artifact").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".inspector").count(), 0);
  await page.locator('[data-view="matrix"]').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture("workflow-narrow-matrix");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("/");
  assert.ok(await page.locator("#workspace-dialog").evaluate((el) => el.open));
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#workspace-dialog").evaluate((el) => el.open), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-action="frame"]').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture("workflow-phone");
  await page.keyboard.press("/");
  await page.locator("#search").fill("SYS-03");
  await page.locator('[data-result="SYS-03"]').click();
  await page.locator("#timeline-scope").selectOption("selected");
  await page.keyboard.press("/");
  await page.locator("#search").fill("Show traceability");
  await page.locator("[data-command]").click();
  assert.equal(await page.locator("#trace-root-type").inputValue(), "subsystem_requirement");
  await page.locator('[data-matrix-mode="relationships"]').click();
  const adjacency = page.locator(".matrix table:not([role=grid]) td button").first();
  await adjacency.focus();
  await adjacency.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  assert.ok(await page.evaluate(() => !!document.activeElement.closest(".matrix td")));
  assert.deepEqual(errors, []);
  console.log(
    "Passed Discover / Modify / Assess: exact canonical trace; control hierarchy; anchor-preserving expand/collapse/focus; cursor-anchored wheel zoom and organized expansion; pin/drag; selected matrix/relationship history; direct statement/acceptance editing and validation; full editor/back; shared drafts/filters; local link edit/remove/create; native diffs and unassessed connected work; changed-only graph marks; keyboard/revision locks; responsive peek/full editor, drawer, 390px/680px overflow; reduced motion; reload isolation; zero page errors.",
  );
} finally {
  await browser.close();
}
