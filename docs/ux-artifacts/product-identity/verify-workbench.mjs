import { disposableOrigin } from "./verification-fixtures.mjs";
import assert from "node:assert/strict";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
const origin = disposableOrigin();
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 });
page.setDefaultTimeout(10000);
const errors = [];
const run = String(Date.now());
const quickTitle = `Completed result · ${run}`;
const scopeProposal = `Scope edited directly while retaining the exact recorded relationship. ${run}`;
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
const open = async (view = "matrix", project = "default") => {
  await page.goto(`${origin}/?native=1&presentation=1&view=${view}&project=${project}`);
  await page.locator('[data-action="reset"]').click();
  const latest = page.locator('[data-action="latest"]').first();
  if (await latest.isVisible()) await latest.click();
  await page.locator(`[data-view="${view}"]`).click();
  await page
    .locator(view === "matrix" ? '[role="grid"]' : ".node")
    .first()
    .waitFor();
};
const geometry = () =>
  page.locator("[data-trace-row]").evaluateAll((rows) =>
    rows.map((row) => {
      const r = row.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
  );
const screenshot = (name) => page.screenshot({ path: `output/product-identity/${name}.png` });
const select = async (locator) => {
  await locator.click();
  await page.locator("[data-grid-edit]").waitFor();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
try {
  await open();
  const start = await snapshot(),
    root = start.entities.find((e) => e.key === "PRS-01");
  await select(page.locator('[data-grid-artifact="PRS-01"]'));
  const before = await geometry();
  await page.keyboard.press("F2");
  assert.equal(
    await page.locator("#matrix-cell-popover").evaluate((el) => el.matches(":popover-open")),
    true,
  );
  assert.deepEqual(
    await geometry(),
    before,
    "opening a cell editor must not resize or reposition table rows",
  );
  await page
    .locator('#matrix-cell-form [name="statement"]')
    .fill("An unsaved multiline proposal.\nThe table should remain stable.");
  assert.deepEqual(await geometry(), before);
  await screenshot("workbench-floating-editor");
  await page.keyboard.press("Escape");
  assert.deepEqual(await geometry(), before);
  assert.equal(await page.locator('[role="gridcell"]:focus').count(), 1);
  await page.keyboard.type("Q");
  assert.equal(await page.locator('#matrix-cell-form [name="title"]').inputValue(), "Q");
  assert.equal(await page.locator('#matrix-cell-form [name="statement"]').count(), 0);
  await page.locator('#matrix-cell-form [name="title"]').fill(quickTitle);
  await page.locator('#matrix-cell-form [name="title"]').press("Enter");
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
  let current = await snapshot();
  assert.equal(current.projectRevision, start.projectRevision + 1);
  assert.equal(
    current.entities.find((e) => e.id === root.id).fields.statement,
    root.fields.statement,
  );
  // Typing a replacement target and pressing Enter preserves required metadata and link identity.
  const subCell = page.locator('[data-grid-col="1"] [data-grid-artifact]').first();
  const previousLinkId = await subCell.getAttribute("data-matrix-edge");
  const previousLink = current.relationships.find((e) => e.id === previousLinkId);
  const replacement = current.entities.find(
    (e) =>
      e.type === "subsystem_requirement" &&
      !current.relationships.some(
        (l) => l.source === root.id && l.target === e.id && l.type === previousLink.type,
      ),
  );
  await select(subCell);
  await page.keyboard.type(replacement.key);
  assert.equal(
    await page.locator('#matrix-cell-form [name="query"]').inputValue(),
    replacement.key,
  );
  await page.locator('#matrix-cell-form [name="query"]').press("Enter");
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
  current = await snapshot();
  const changedLink = current.relationships.find((l) => l.id === previousLinkId);
  assert.equal(changedLink.target, replacement.id);
  assert.equal(changedLink.fields.scope, previousLink.fields.scope);
  assert.equal(changedLink.version, previousLink.version + 1);
  // Existing links are explained and cannot accidentally be recreated from the picker.
  await page.locator('[data-grid-col="1"] [data-cell-add]').first().click();
  await page.locator('#matrix-cell-form [name="query"]').fill(replacement.key);
  assert.equal(await page.locator(`[data-picker-key="${replacement.key}"]`).isDisabled(), true);
  assert.ok(
    (await page.locator(`[data-picker-key="${replacement.key}"]`).textContent()).includes(
      "Already linked",
    ),
  );
  await page.locator('#matrix-cell-form [name="query"]').press("Enter");
  assert.equal((await snapshot()).projectRevision, current.projectRevision);
  await screenshot("workbench-duplicate-aware-picker");
  await page.keyboard.press("Escape");
  // Range selection/copy traverses rendered merged cells without cloning canonical records.
  await select(page.locator('[data-grid-row="0"][data-grid-col="1"]'));
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  await page.locator(".range-selection-label").waitFor();
  assert.ok((await page.locator('.grid-range-selected[aria-selected="true"]').count()) >= 3);
  const copied = await page.locator(".grid-cell-selected").evaluate((cell) => {
    const data = new DataTransfer();
    cell.dispatchEvent(
      new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }),
    );
    return data.getData("text/plain");
  });
  assert.equal(copied.split("\n").length, 2);
  assert.ok(copied.split("\n").every((row) => row.split("\t").length === 2));
  await screenshot("workbench-range-selection");
  // Creation is also floating: no placeholder form row is injected into the projection.
  const beforeRoot = await geometry();
  await page.locator('[data-action="create-artifact"]').click();
  assert.deepEqual(await geometry(), beforeRoot);
  await page.keyboard.press("Escape");
  // Compact relationship properties edit in place, retain drafts across lenses and save real history.
  await open("graph");
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill("Show traceability");
  await page.locator("[data-command]").click();
  await page.locator('[role="grid"]').waitFor();
  assert.equal(await page.locator("#matrix-scope option:checked").textContent(), "PRS-01 only");
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-node-action="connect"]').click();
  assert.equal(await page.locator("#connection-source").evaluate((el) => el.tagName), "INPUT");
  await page.locator("#connection-target").fill("UNKNOWN");
  assert.equal(await page.locator('#connection-form [type="submit"]').isDisabled(), true);
  await page.locator("#connection-target").fill("VER-03");
  assert.ok(await page.locator('#connection-targets option[value="VER-03"]').count());
  assert.equal(await page.locator("#connection-type").inputValue(), "verified_by");
  await page.keyboard.press("Escape");
  await page.locator('.edgehit[aria-label="PRS-01 verified by VER-03"]').focus();
  await page.keyboard.press("Enter");
  // Reload now preserves a collapsed inspector; opening details is an explicit task step.
  await page.locator('[data-action="details"]').click();
  await page.locator("[data-edit-relationship-scope]").click();
  await page.locator("#relationship-scope-form textarea").fill(scopeProposal);
  await page.locator('[data-view="matrix"]').click();
  await page.locator('[data-view="graph"]').click();
  assert.equal(await page.locator("#relationship-scope-form textarea").inputValue(), scopeProposal);
  await page.locator("#database-picker").selectOption("gatherline");
  await page.locator("#cancel-database-switch").click();
  await screenshot("workbench-inline-relationship");
  await page.locator("#relationship-scope-form textarea").press("Control+Enter");
  await page.waitForFunction(() => !document.querySelector("#relationship-scope-form"));
  await page.locator('[data-action="relationship-history"]').click();
  assert.ok(
    (await page.locator(".field-diff .after").allTextContents())
      .join(" ")
      .includes("Scope edited directly"),
  );
  // Scope quick edits use the same captured-version protection as the structured editor.
  await page.locator('[data-view="graph"]').click();
  await page.locator("[data-edit-relationship-scope]").click();
  await page
    .locator("#relationship-scope-form textarea")
    .fill("Retain this conflicting scope proposal.");
  const observed = await snapshot();
  const source = observed.entities.find((e) => e.key === "PRS-01");
  const targetEntity = observed.entities.find((e) => e.key === "VER-03");
  const relation = observed.relationships.find(
    (l) => l.source === source.id && l.target === targetEntity.id && l.type === "verified_by",
  );
  const token = (await (await page.request.get(origin + "/api/session")).json()).token;
  const external = await page.request.post(origin + "/api/changesets", {
    headers: { "X-Tracer-Token": token, Origin: origin },
    data: {
      expectedSchemaVersion: observed.schema.version,
      operations: [
        {
          op: "relationship.update",
          id: relation.id,
          expectedVersion: relation.version,
          input: {
            source: relation.source,
            target: relation.target,
            type: relation.type,
            fields: { ...relation.fields, scope: "Concurrent saved scope." },
          },
        },
      ],
    },
  });
  assert.equal(external.status(), 200);
  await page.locator('#relationship-scope-form [type="submit"]').click();
  await page
    .locator("#relationship-scope-form .form-error")
    .filter({ hasText: /version|conflict|changed/i })
    .waitFor();
  assert.equal(
    await page.locator("#relationship-scope-form textarea").inputValue(),
    "Retain this conflicting scope proposal.",
  );
  assert.equal(
    (await snapshot()).relationships.find((l) => l.id === relation.id).fields.scope,
    "Concurrent saved scope.",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator(".node").first().waitFor();
  await page.locator('[data-view="history"]').click();
  // One explicit historical status persists through all three views.
  await page.locator("#revision-range").fill("398");
  await page.locator("#revision-range").dispatchEvent("change");
  for (const view of ["graph", "matrix", "history"]) {
    await page.locator(`[data-view="${view}"]`).click();
    assert.equal(await page.locator("#revision-range").inputValue(), "398");
    assert.ok(
      (await page.locator(".temporal-context").textContent()).includes(
        "Viewing revision 398 · Read only",
      ),
    );
    assert.equal(await page.locator("#matrix-cell-form").count(), 0);
  }
  await screenshot("workbench-global-historical-state");
  // The recorded r399 investigation retains its origin and exact scope across lenses.
  await page.locator('[data-action="latest"]').click();
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill("PRS-02");
  await page.locator('[data-result="PRS-02"]').click();
  await page.locator('[data-view="history"]').click();
  await page.locator("#revision-range").fill("399");
  await page.locator("#revision-range").dispatchEvent("change");
  await page.locator('[data-action="inspect-revision"]').click();
  const ids = await page
    .locator(".edgehit")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.edge).sort());
  assert.equal(ids.length, 20);
  await page.locator('[data-view="matrix"]').click();
  assert.ok(
    (await page.locator(".shared-investigation-context").textContent()).includes("20 links"),
  );
  assert.ok((await page.locator(".shared-investigation-context").textContent()).includes("PRS-02"));
  await screenshot("workbench-shared-investigation");
  await page.locator('[data-action="return-change"]').click();
  assert.ok((await page.locator(".field-diff .after").textContent()).includes("10–40"));
  // Narrow floating editor is bounded while retaining the table's exact geometry.
  await open();
  await page.setViewportSize({ width: 680, height: 900 });
  await page.waitForFunction(() => document.body.dataset.panel === "sheet");
  await select(page.locator('[data-grid-artifact="PRS-01"]'));
  const narrowGeometry = await geometry();
  await page.keyboard.press("F2");
  assert.deepEqual(await geometry(), narrowGeometry);
  const bounds = await page.locator("#matrix-cell-popover").boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 680 && bounds.y + bounds.height <= 900);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot("workbench-floating-editor-680");
  await page.keyboard.press("Escape");
  // Repeat keyboard title editing with Gatherline's unrelated schema.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("matrix", "gatherline");
  const target = page.locator('[data-grid-col="0"] [data-grid-artifact]').first();
  const gatherKey = await target.getAttribute("data-grid-artifact");
  await select(target);
  await page.keyboard.type("G");
  await page
    .locator('#matrix-cell-form [name="title"]')
    .fill("Gatherline — coordinated offline event work");
  await page.locator('#matrix-cell-form [name="title"]').press("Enter");
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
  assert.ok(
    (await page.locator(`[data-grid-artifact="${gatherKey}"]`).textContent()).includes(
      "coordinated offline event work",
    ),
  );
  await page.locator('[data-view="graph"]').click();
  assert.ok(
    !(await page.locator(".graph-lane").allTextContents())
      .join(" ")
      .includes("Subsystem allocations"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Workbench passed: stable desktop/narrow table geometry, quick title save, type-to-search/Enter replacement, duplicate prevention, merged range selection/TSV copy, floating creation, inline scope/history, retained drafts, shared historical/investigation state and Gatherline authoring.",
  );
} finally {
  await browser.close();
}
