import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { checkPalette, checkFocus } from "./palette-check.mjs";

const out = "/tmp/tracer-link-design-prototype";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [],
  network = [],
  palette = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.goto(new URL("./index.html", import.meta.url).href);
  const inspector = page.getByRole("complementary", { name: "Selected requirement" });
  const picker = page.getByRole("dialog");
  const link = page.locator("#open-picker");
  const search = page.getByRole("searchbox", { name: "Search artifacts" });
  const record = page.getByRole("button", { name: "Record link" });
  const discovery = page.getByRole("button", { name: /discovery.ts src\/discovery.ts/ });
  const filters = page.getByRole("button", { name: /filters.ts src\/filters.ts/ });
  const mappingCount = page.locator(".inspector-link-list .file-name");
  const assertPickerContext = async (version, statement) => {
    const context = await page.locator("#picker-context").innerText();
    assert.match(context, version);
    assert.match(context, statement);
  };
  const assertRelationshipsActive = async () => {
    assert.equal(
      await page
        .getByRole("button", { name: "Relationships", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
  };
  const closePickerByEscape = async () => {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog").open);
  };
  const assertNoPageOverflow = async () => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  };
  const assertSharedDiscovery = async (mappings) => {
    assert.equal(await page.locator(".realization-group").count(), 1);
    assert.equal(await page.locator('.realization-group[data-artifact="discovery"] h3').count(), 1);
    assert.equal(await page.locator(".contribution-mapping").count(), mappings);
  };
  const inspectSource = async (statement, screenshot) => {
    await page.getByRole("button", { name: "Inspect source ↓" }).click();
    assert.match(await page.locator(".source-preview").innerText(), statement);
    palette.push(await checkPalette(page));
    await page.screenshot({ path: `${out}/${screenshot}.png`, fullPage: true });
  };
  const recordFilters = async () => {
    await page.getByRole("button", { name: /REQ-01.*Browse categories/ }).click();
    await link.click();
    await filters.click();
    await record.click();
    await page.waitForFunction(() => !document.querySelector("dialog").open);
  };
  assert.equal(await page.locator("button[data-treatment], .treatment-control").count(), 0);
  assert.equal(await page.locator("body").getAttribute("data-treatment"), "precision");
  await inspector.getByRole("heading", { name: "Filter results" }).waitFor();
  assert.equal(await page.locator(".study-bar, .page-heading").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Service discovery", exact: true }).count(),
    1,
  );
  assert.equal(await page.locator(".view-toolbar").count(), 1);
  assert.equal(await page.locator(".view-toolbar #reset").count(), 1);
  for (const width of [1440, 1920, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.evaluate(() => {
      const workspace = document.querySelector(".workspace").getBoundingClientRect();
      const main = document.querySelector("main").getBoundingClientRect();
      const heading = document.querySelector("h1").getBoundingClientRect();
      const pane = document.querySelector(".content-pane").getBoundingClientRect();
      const inspector = document.querySelector(".inspector").getBoundingClientRect();
      const notice = document.querySelector(".session-note").getBoundingClientRect();
      return {
        compactHeader: heading.height < 32,
        workNearTop: workspace.top < 170,
        fillsMain:
          Math.abs(workspace.left - main.left) < 1 && Math.abs(workspace.right - main.right) < 1,
        dockedInspector:
          Math.abs(pane.top - inspector.top) < 1 && Math.abs(inspector.right - main.right) < 1,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
        quietNoticeVisible: notice.bottom <= innerHeight + 1,
      };
    });
    for (const [name, passed] of Object.entries(layout))
      assert.equal(passed, true, `${width}px: ${name}`);
    if (width !== 1440)
      await page.screenshot({ path: `${out}/workbench-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.match(await page.locator("#remaining-work").innerText(), /existing code may be unlinked/);
  palette.push(await checkPalette(page));
  await page.screenshot({ path: `${out}/precision.png`, fullPage: true });

  // Inspect a fixture mapping without changing selection or entering add-link search.
  const initialMapping = page.getByRole("button", {
    name: "Inspect discovery.ts mapping for REQ-01",
    exact: true,
  });
  await initialMapping.click();
  assert.equal(
    await picker.getByRole("heading", { name: "Inspect recorded mapping" }).isVisible(),
    true,
  );
  await assertPickerContext(/REQ-01 \/ v2/, /search within a selected category/);
  assert.match(await page.locator("#draft-line").innerText(), /Partial · Browsing only/);
  assert.equal(await page.locator("#candidate-search").isVisible(), false);
  assert.equal(await page.locator("#confirm-link").isVisible(), false);
  assert.match(await page.locator(".source-preview").innerText(), /Fictional fixture/);
  await page.keyboard.press("/");
  assert.notEqual(await page.evaluate(() => document.activeElement.id), "search");
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest("dialog")), true);
  }
  await page.screenshot({ path: `${out}/precision-recorded-inspection.png`, fullPage: true });
  await picker.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.dataset.mapping === "discovery");
  assert.match(await inspector.innerText(), /REQ-02/);
  assert.equal(await mappingCount.count(), 0);
  await page.getByRole("button", { name: "Relationships", exact: true }).click();
  assert.match(await inspector.innerText(), /REQ-02/);
  assert.match(await page.locator(".parent-intent").innerText(), /INT-01.*PARENT INTENT/);
  assert.match(await page.locator(".parent-intent").innerText(), /contributes to/);
  assert.equal(await page.locator(".contribution-lane").count(), 3);
  assert.equal(await page.locator(".contribution-statement").count(), 3);
  assert.match(
    await page.locator('[data-lane="REQ-01"]').innerText(),
    /search within category not mapped/,
  );
  assert.match(
    await page.locator('[data-lane="REQ-01"]').innerText(),
    /Test mapping outdated · REQ-01 v1/,
  );
  assert.match(
    await page.locator('[data-lane="REQ-02"]').innerText(),
    /without losing their current search text/,
  );
  assert.match(
    await page.locator('[data-lane="REQ-02"]').innerText(),
    /existing code may be unlinked/,
  );
  await assertSharedDiscovery(2);
  const scopeOffsets = await page
    .locator(".contribution-remainder")
    .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().top));
  assert.ok(Math.max(...scopeOffsets) - Math.min(...scopeOffsets) < 1);
  assert.equal(await page.locator('#view [data-mapping][data-requirement="REQ-02"]').count(), 0);
  const firstContribution = page.locator('[data-lane="REQ-01"] .contribution-select');
  await firstContribution.focus();
  await page.keyboard.press("Enter");
  assert.match(await inspector.innerText(), /REQ-01/);
  assert.equal(
    await page.locator('[data-lane="REQ-01"] .contribution-select').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".contribution-lane.selected").count(), 1);
  await page.locator('[data-lane="REQ-02"] .contribution-select').click();
  assert.match(await inspector.innerText(), /REQ-02/);
  palette.push(await checkPalette(page));
  await page.screenshot({ path: `${out}/precision-contributions.png`, fullPage: true });
  const artifactSelect = page.getByRole("button", {
    name: "Select discovery.ts artifact",
    exact: true,
  });
  await artifactSelect.focus();
  await page.keyboard.press("Enter");
  assert.equal(await artifactSelect.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".contribution-lane.related").count(), 2);
  assert.equal(
    await page.locator('[data-lane="REQ-02"]').getAttribute("data-emphasis"),
    "unrelated",
  );
  assert.equal(await page.locator(".contribution-lane.selected").count(), 0);
  for (const lane of await page.locator(".contribution-lane").all())
    assert.equal(await lane.isVisible(), true);
  const artifactInspector = page.getByRole("complementary", { name: "Selected artifact" });
  assert.match(await artifactInspector.innerText(), /discovery.ts/);
  assert.match(await artifactInspector.innerText(), /Partial · Browsing only/);
  assert.match(await artifactInspector.innerText(), /Mapped · Extent unreviewed/);
  assert.equal(await artifactInspector.locator(".requirement-statement").count(), 0);
  palette.push(await checkPalette(page));
  await page.screenshot({ path: `${out}/precision-artifact-focus.png`, fullPage: true });
  await artifactInspector.locator(".artifact-source summary").click();
  assert.match(await artifactInspector.locator(".source-preview").innerText(), /Fictional fixture/);
  await page.getByRole("button", { name: "Coverage", exact: true }).click();
  assert.match(await inspector.innerText(), /REQ-02/);
  await page.getByRole("button", { name: "Relationships", exact: true }).click();
  assert.equal(await artifactSelect.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".contribution-lane.related").count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoPageOverflow();
  assert.equal(await page.locator(".contribution-lane.related").count(), 2);
  await page.screenshot({ path: `${out}/artifact-focus-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await artifactInspector
    .getByRole("button", { name: "Inspect discovery.ts mapping for REQ-01", exact: true })
    .click();
  assert.match(await page.locator("#picker-context").innerText(), /REQ-01 \/ v2/);
  await closePickerByEscape();
  assert.equal(await page.locator(".contribution-lane.related").count(), 2);
  await page.locator("#clear-emphasis").click();
  assert.match(await inspector.innerText(), /REQ-02/);
  assert.equal(await mappingCount.count(), 0);
  assert.equal(await page.locator(".requirement-statement").count(), 0);
  await page.locator('[data-lane="REQ-01"] .contribution-select').click();
  await page.locator('[data-lane="REQ-02"] [data-find-code]').click();
  await assertPickerContext(/REQ-02 \/ v1/, /without losing/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  assert.match(await inspector.innerText(), /REQ-01/);
  await page.locator('[data-lane="REQ-01"] .version-context summary').click();
  assert.match(
    await page.locator(".version-context[open]").innerText(),
    /current requirement is v2/,
  );
  assert.match(await page.locator(".version-context[open]").innerText(), /not a failed test/);
  await page.getByRole("button", { name: "Review covered scope for REQ-01", exact: true }).click();
  assert.match(await page.locator("#draft-line").innerText(), /Partial · Browsing only/);
  await closePickerByEscape();
  await page.locator('[data-lane="REQ-02"] .contribution-select').click();
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.equal(await page.locator(".contribution-statement").count(), 3);
    await page.screenshot({ path: `${out}/contributions-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Coverage", exact: true }).click();

  await link.click();
  assert.equal(await page.locator("#search").evaluate((e) => e === document.activeElement), true);
  await assertPickerContext(/REQ-02 \/ v1/, /without losing their current search text/);
  assert.equal(await page.locator("#result-count").getAttribute("role"), "status");
  assert.equal(await page.locator("#draft-line").getAttribute("role"), "status");
  assert.equal(await record.isDisabled(), true);
  await search.fill("<img src=x onerror=alert(1)>");
  await page.getByText("No artifacts match. Try a filename or path.").waitFor();
  assert.equal(await page.locator("img").count(), 0);
  await search.fill("discovery");
  await discovery.click();
  await inspectSource(/Fictional fixture/, "precision-picker");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (i === 0) palette.push(await checkFocus(page));
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest("dialog")), true);
  }
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === "open-picker");
  assert.match(await page.locator("#gap-count").innerText(), /1 \/ 3/);
  await link.click();
  await search.fill("discovery");
  await discovery.click();
  await record.click();
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  assert.match(await inspector.innerText(), /discovery.ts/);
  assert.match(await inspector.innerText(), /Extent unreviewed/);
  assert.match(
    await page.locator("#gap-count").innerText(),
    /Service discovery · 0 \/ 3 requirements without code mappings/,
  );
  assert.match(
    await page.locator("#remaining-work").innerText(),
    /mapping extent still needs review/,
  );
  assert.match(await page.locator("#remaining-work").innerText(), /No test mapping recorded/);
  assert.match(
    await page.locator(".session-note").innerText(),
    /results and impact are not assessed/,
  );
  palette.push(await checkPalette(page));
  await page.screenshot({ path: `${out}/precision-linked.png`, fullPage: true });
  await page.getByRole("button", { name: "Relationships", exact: true }).click();
  assert.match(
    await page.locator('[data-lane="REQ-02"]').innerText(),
    /Code mapping recorded; extent unreviewed/,
  );
  await assertSharedDiscovery(3);
  await assertRelationshipsActive();
  await page
    .locator("#view")
    .getByRole("button", { name: "Inspect discovery.ts mapping for REQ-02", exact: true })
    .click();
  assert.match(await page.locator("#draft-line").innerText(), /Extent unreviewed/);
  await closePickerByEscape();
  await assertRelationshipsActive();
  await page.screenshot({ path: `${out}/precision-relationships.png`, fullPage: true });
  await link.click();
  await search.fill("discovery");
  await discovery.click();
  assert.equal(await record.isDisabled(), true);
  assert.match(await page.locator("#draft-line").innerText(), /Already mapped/);
  await search.fill("filters");
  assert.equal(await record.isDisabled(), true);
  await filters.click();
  assert.equal(await page.locator(".source-preview").count(), 0);
  await inspectSource(/Preservation of search text is unassessed/, "precision-inspected-picker");
  await closePickerByEscape();
  assert.equal(await mappingCount.count(), 1);
  await page.getByRole("button", { name: "Coverage", exact: true }).click();
  await recordFilters();
  assert.match(await inspector.innerText(), /REQ-01/);
  assert.equal(await mappingCount.count(), 2);

  // Undo updates the family model too, retaining fixture and other session mappings.
  await page.getByRole("button", { name: "Relationships", exact: true }).click();
  assert.equal(await page.locator('.realization-group[data-artifact="filters"]').count(), 1);
  assert.equal(await page.locator(".artifact-identity h3").count(), 2);
  await page.getByRole("button", { name: "Select filters.ts artifact", exact: true }).click();
  assert.equal(await page.locator(".contribution-lane.related").count(), 1);
  assert.equal(await page.locator('[data-lane="REQ-01"]').getAttribute("data-emphasis"), "related");
  assert.equal(
    await page.locator('[data-artifact="discovery"]').getAttribute("data-emphasis"),
    "unrelated",
  );
  await page.getByRole("button", { name: "Select discovery.ts artifact", exact: true }).click();
  assert.equal(await page.locator(".contribution-lane.related").count(), 3);
  await page.locator("#return-requirement").click();
  assert.match(
    await page.locator('[data-lane="REQ-01"]').innerText(),
    /Other mapping extent unreviewed/,
  );
  await page
    .getByRole("button", { name: "Undo link to filters.ts for REQ-01", exact: true })
    .click();
  assert.equal(await mappingCount.count(), 1);
  assert.equal(await page.locator('.realization-group[data-artifact="filters"]').count(), 0);
  assert.equal(await page.locator(".contribution-mapping").count(), 3);
  await assertRelationshipsActive();
  await page.getByRole("button", { name: "Coverage", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Undo link to discovery.ts for REQ-01", exact: true })
      .count(),
    0,
  );
  assert.match(await inspector.innerText(), /REQ-01/);
  await page.getByRole("button", { name: /REQ-02.*Filter results/ }).click();
  assert.equal(await mappingCount.count(), 1);
  assert.match(await inspector.innerText(), /discovery.ts/);
  await recordFilters();
  await link.click();
  await filters.click();
  assert.match(await page.locator("#artifact-detail").innerText(), /Recorded here: REQ-01: mapped/);
  assert.equal(await record.isDisabled(), true);
  await closePickerByEscape();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Reset session ↺" }).click();
  assert.equal(await mappingCount.count(), 2);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset session ↺" }).click();
  await inspector.getByRole("heading", { name: "Filter results" }).waitFor();
  assert.equal(await mappingCount.count(), 0);
  await page.screenshot({ path: `${out}/precision-reset.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoPageOverflow();
  assert.match(await page.locator("#gap-count").innerText(), /Service discovery · 1 \/ 3/);
  assert.equal(await page.locator(".scope-chip").isVisible(), true);
  assert.equal(
    await page.locator("#gap-count").evaluate((e) => e.scrollWidth <= e.clientWidth),
    true,
  );
  await link.click();
  await filters.click();
  assert.match(
    await page.locator("#picker-context").innerText(),
    /without losing their current search text/,
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("dialog").getBoundingClientRect().right <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: `${out}/mobile-picker.png`, fullPage: true });
  await record.click();
  await page.reload();
  assert.match(await page.locator("#gap-count").innerText(), /1 \/ 3/);
  assert.equal(await mappingCount.count(), 0);
  await page.setViewportSize({ width: 720, height: 650 });
  await assertNoPageOverflow();
  await page.screenshot({ path: `${out}/zoom-reflow.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log(
    JSON.stringify({
      status: "PASS",
      checks: [
        "selected Precision only",
        "compact header/single toolbar/full-width workbench/docked inspector at 1024–1920px",
        "selection/view context",
        "explicit parent/family semantics and simultaneous requirement statements",
        "single shared artifact identity with per-requirement mapping qualifiers",
        "zero-link contribution stays unconnected; live grouping after record/undo",
        "contribution selection by keyboard and narrow relationship bounds",
        "bidirectional artifact/requirement emphasis without hiding unrelated contributions",
        "artifact inspector and reversible focus preserve selection and links",
        "contextual find/review/version actions capture correct requirement",
        "full requirement/version in picker",
        "direct read-only mapping inspection/focus return",
        "remaining uncertainty/scoped counts",
        "individual undo preserves other session and fixture links",
        "dynamic result/draft status semantics",
        "safe search and fictional source",
        "modal Tab/Escape/Cancel/focus return",
        "explicit captured-requirement recording and duplicate guard",
        "reset confirmation",
        "390px and 720px reflow bounds",
        "reload resets",
        "no page errors or HTTP requests",
      ],
      palette,
      screenshots: out,
    }),
  );
} finally {
  await browser.close();
}
