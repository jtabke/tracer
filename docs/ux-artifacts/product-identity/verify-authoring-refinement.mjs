import { disposableOrigin } from "./verification-fixtures.mjs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
// Mutates only the caller's disposable fixture, including optional-field schema variants.
const origin = disposableOrigin();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 680, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const read = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
const geometry = () =>
  page
    .locator("[data-trace-row]")
    .evaluateAll((rows) => rows.map((r) => [r.offsetTop, r.offsetHeight]));
try {
  await page.goto(origin + "/?native=1&presentation=1&view=matrix");
  await page.locator('[role="grid"]').waitFor();
  const before = await read(),
    rows = await geometry();
  assert.equal(
    before.schema.entityTypes.product_requirement.fields.statement.required,
    true,
    "Use a fresh disposable Aster fixture for this schema-variant check.",
  );
  await page.locator("[data-grid-create-root]").click();
  assert.equal(await page.locator("#create-form input:visible").count(), 1);
  await page.locator('#create-form [name="title"]').fill("A requirement proposal");
  await page.locator('#create-form [name="title"]').press("Enter");
  await page.locator('#create-form [name="statement"]').waitFor();
  assert.equal(await page.locator('#create-form [name="key"]').count(), 0);
  assert.equal(await page.locator("#matrix-cell-popover.cell-editor-sheet").count(), 1);
  assert.equal((await read()).projectRevision, before.projectRevision);
  assert.deepEqual(await geometry(), rows);
  const box = await page.locator("#matrix-cell-popover").boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 680 && box.y + box.height <= 900);
  assert.equal(
    await page.locator("[data-cell-cancel]").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#create-form").count(), 0);
  // Relax only these two fields in this fixture; no fabricated statements/scope are needed.
  const schema = structuredClone(before.schema);
  delete schema.id;
  delete schema.version;
  schema.entityTypes.product_requirement.fields.statement.required = false;
  schema.relationshipTypes.realized_by.fields.scope.required = false;
  const token = (await (await page.request.get(origin + "/api/session")).json()).token;
  const changed = await page.request.post(origin + "/api/schema", {
    headers: { "X-Tracer-Token": token, Origin: origin },
    data: { schema, expectedVersion: before.schema.version },
  });
  assert.ok(changed.ok(), await changed.text());
  await page.reload();
  await page.locator('[role="grid"]').waitFor();
  const base = await read();
  await page.locator("[data-grid-create-root]").click();
  await page.locator('#create-form [name="title"]').fill("A title-only artifact");
  await page.locator('#create-form [name="title"]').press("Enter");
  await page.waitForFunction(() => !document.querySelector("#create-form"));
  let saved = await read();
  assert.equal(saved.projectRevision, base.projectRevision + 1);
  const root = saved.entities.find((e) => e.fields.title === "A title-only artifact");
  assert.ok(root.key);
  assert.equal(root.fields.statement, undefined);
  await page.locator(".trace-config-toggle summary").click();
  await page.locator("#trace-column-count").selectOption("1");
  await page.locator('[data-trace-relation="0"]').selectOption("realized_by");
  await page.locator('[data-trace-target="0"]').selectOption("design_output");
  await page.locator(".trace-config-toggle summary").click();
  await page.locator('[data-grid-col="1"] [data-cell-add]').click();
  await page.locator('#matrix-cell-form [name="query"]').fill("OUT-01");
  await page.locator('[data-picker-key="OUT-01"]').click();
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
  saved = await read();
  assert.equal(saved.projectRevision, base.projectRevision + 2);
  const output = saved.entities.find((e) => e.key === "OUT-01"),
    links = saved.relationships.filter((l) => l.source === root.id && l.target === output.id);
  assert.equal(links.length, 1);
  assert.equal(links[0].fields.scope, undefined);
  assert.ok((await page.locator(".connected-next").textContent()).includes("OUT-01"));
  await page.locator("[data-connected-another]").click();
  await page.locator('#matrix-cell-form [name="query"]').fill("OUT-01");
  assert.equal(await page.locator('[data-picker-key="OUT-01"]').isDisabled(), true);
  await page.keyboard.press("Escape");
  await page.locator("[data-connected-graph]").click();
  assert.equal(await page.locator(".edgehit").getAttribute("data-edge"), links[0].id);
  await page.reload();
  assert.equal((await read()).projectRevision, saved.projectRevision);
  assert.deepEqual(errors, []);
  console.log(
    "Authoring refinement passed: title-first row, required-statement progression without a write, stable rows, accessible narrow sheet, schema-optional title-only save and one-selection link, duplicate prevention, exact next action and reload persistence.",
  );
} finally {
  await browser.close();
}
