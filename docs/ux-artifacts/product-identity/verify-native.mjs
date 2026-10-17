import { disposableOrigin } from "./verification-fixtures.mjs";
import assert from "node:assert/strict";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
import { mkdirSync } from "node:fs";
import { traceRows } from "./trace-table.mjs";
const output = new URL("../../../output/product-identity/", import.meta.url).pathname;
mkdirSync(output, { recursive: true });
// Parallel recorded links remain separate; missing stages remain explicit.
const records = new Map([
  ["A", { type: "requirement" }],
  ["B", { type: "design" }],
]);
assert.equal(
  traceRows(
    records,
    [
      { id: "one", source: "A", target: "B", type: "realizes" },
      { id: "two", source: "A", target: "B", type: "realizes" },
    ],
    ["A"],
    [{ type: "realizes", targetType: "design" }],
  ).rows.length,
  2,
);
assert.equal(
  traceRows(records, [], ["A"], [{ type: "realizes", targetType: "design" }]).rows[0].keys[1],
  null,
);
assert.equal(
  traceRows(records, [], ["A"], [{ type: "realizes", targetType: "design" }], 0).truncated,
  true,
);
const origin = disposableOrigin();
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const key = `PRS-NEW-${Date.now().toString().slice(-6)}`;
const snapshot = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
const capture = (name) => page.screenshot({ path: `${output}${name}.png` });
try {
  await page.goto(origin + "/?presentation=1&native=1");
  await page.locator(".node").first().waitFor();
  const start = await snapshot();
  await page.locator('[data-view="matrix"]').click();
  assert.equal(await page.locator(".traceability-matrix").count(), 1);
  await capture("workbench-traceability");
  await page.locator('[data-action="create-artifact"]').click();
  await page.locator("[data-cell-details]").click();
  await page.locator('#create-form [name="type"]').selectOption("product_requirement");
  await page.locator('#create-form [name="key"]').fill(key);
  await page
    .locator('#create-form [name="title"]')
    .fill("Preserve pressure accuracy across home temperatures");
  await page
    .locator('#create-form [name="statement"]')
    .fill("Maintain the stated pressure accuracy over the declared operating temperature range.");
  await page.locator('#create-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("#create-form"));
  assert.equal((await snapshot()).projectRevision, start.projectRevision + 1);
  assert.ok((await page.locator(".trace-artifact").first().textContent()).includes(key));
  await page.locator(".trace-config-toggle summary").click();
  await page.locator('[data-trace-relation="0"]').selectOption("realized_by");
  await page.locator('[data-trace-target="0"]').selectOption("design_output");
  await page.locator('[data-trace-relation="1"]').selectOption("verified_by");
  await page.locator('[data-trace-target="1"]').selectOption("verification_protocol");
  await page.locator("#trace-column-count").selectOption("2");
  assert.equal(await page.locator(".traceability-matrix th").count(), 3);
  await page.locator('[data-grid-col="1"] [data-cell-add]').click();
  await page.locator('#matrix-cell-form [name="query"]').fill("OUT-01");
  await page.locator('[data-picker-key="OUT-01"]').click();
  await page
    .locator('#matrix-cell-form [name="scope"]')
    .fill("Pressure acquisition design input for the declared temperature range.");
  await page.locator('#matrix-cell-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
  const linked = await snapshot();
  const entity = linked.entities.find((record) => record.key === key);
  const relation = linked.relationships.find((link) => link.source === entity.id);
  assert.equal(relation.type, "realized_by");
  assert.equal(linked.projectRevision, start.projectRevision + 2);
  assert.equal(await page.locator(`[data-matrix-edge="${relation.id}"]`).count(), 1);
  await capture("workbench-matrix-linked");
  await page.locator('[data-view="graph"]').click();
  assert.equal(await page.locator(".relationship-inspector").count(), 1);
  assert.ok(
    (await page.locator(".relationship-inspector").textContent()).includes(
      "Pressure acquisition design input",
    ),
  );
  await page.locator('.relationship-inspector [data-action="edit-edge"]').click();
  await page
    .locator('#connection-form [name="scope"]')
    .fill("Includes calibration across the expanded operating temperature range.");
  await page.locator('#connection-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  const updated = await snapshot();
  assert.equal(updated.projectRevision, start.projectRevision + 3);
  assert.equal(updated.relationships.find((link) => link.id === relation.id).version, 2);
  await capture("workbench-graph-edited");
  await page.locator('.relationship-inspector [data-action="relationship-history"]').click();
  assert.ok(
    (await page.locator(".field-diff .after").textContent()).includes("Includes calibration"),
  );
  assert.ok(
    (await page.locator(".field-diff .before").textContent()).includes(
      "Pressure acquisition design input",
    ),
  );
  await capture("workbench-history-saved");
  await page.reload();
  await page.locator('[data-view="graph"]').click();
  await page.locator(".node").first().waitFor();
  const persisted = await snapshot();
  assert.ok(persisted.entities.some((record) => record.id === entity.id));
  assert.equal(persisted.relationships.find((link) => link.id === relation.id).version, 2);
  // A stale form must retain its proposal and reject the obsolete version.
  await page.keyboard.press("/");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await page.locator('[data-view="matrix"]').click();
  await page.locator(".trace-config-toggle summary").click();
  await page.locator('[data-trace-relation="0"]').selectOption("realized_by");
  await page.locator('[data-trace-target="0"]').selectOption("design_output");
  await page.locator(`[data-matrix-edge="${relation.id}"]`).click();
  await page.locator("[data-grid-inspect]").click();
  await page.locator('[data-action="edit-edge"]').click();
  const token = (await (await page.request.get(origin + "/api/session")).json()).token;
  const concurrent = await page.request.post(origin + "/api/changesets", {
    headers: { "X-Tracer-Token": token, Origin: origin },
    data: {
      expectedSchemaVersion: persisted.schema.version,
      operations: [
        {
          op: "relationship.update",
          id: relation.id,
          expectedVersion: 2,
          input: {
            type: relation.type,
            source: relation.source,
            target: relation.target,
            fields: {
              ...updated.relationships.find((link) => link.id === relation.id).fields,
              scope: "Concurrent saved scope",
            },
          },
        },
      ],
    },
  });
  assert.equal(concurrent.status(), 200);
  await page.locator('#connection-form [name="scope"]').fill("Retained stale proposal");
  await page.locator('#connection-form [type="submit"]').click();
  await page
    .locator(".form-error")
    .filter({ hasText: /version|changed|conflict/i })
    .waitFor();
  assert.equal(
    await page.locator('#connection-form [name="scope"]').inputValue(),
    "Retained stale proposal",
  );
  assert.equal(
    (await snapshot()).relationships.find((link) => link.id === relation.id).fields.scope,
    "Concurrent saved scope",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 680, height: 900 });
  await page.locator('[data-action="close-inspector"]').click();
  await capture("workbench-matrix-680");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Artifact fields also use canonical mutations and produce a real native diff.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator('[data-view="graph"]').click();
  await page.locator(".node").first().waitFor();
  await page.keyboard.press("/");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await page.locator('[data-edit-field="statement"]').click();
  await page
    .locator("#inline-value")
    .fill("Maintain accuracy over 10–40 °C; preserve the complete result.");
  await page.locator('[data-apply-field="statement"]').click();
  await page.waitForFunction(() => !document.querySelector("#inline-value"));
  const editedEntity = (await snapshot()).entities.find((record) => record.id === entity.id);
  assert.equal(editedEntity.version, 2);
  assert.ok(editedEntity.fields.statement.includes("10–40"));
  await page.locator('[data-action="artifact-history"]').click();
  assert.ok((await page.locator(".field-diff .after").textContent()).includes("10–40"));
  // A committed write with a lost response stays locked until explicit inspection.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator('[data-view="graph"]').click();
  await page.locator(".node").first().waitFor();
  await page.keyboard.press("/");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await page.locator('[data-view="matrix"]').click();
  await page.locator(".trace-config-toggle summary").click();
  await page.locator('[data-trace-relation="0"]').selectOption("realized_by");
  await page.locator('[data-trace-target="0"]').selectOption("design_output");
  await page.locator(`[data-matrix-edge="${relation.id}"]`).click();
  await page.locator("[data-grid-inspect]").click();
  await page.locator('[data-action="edit-edge"]').click();
  let sent = 0;
  await page.route("**/api/changesets", async (route) => {
    sent++;
    await route.fetch();
    await route.abort("failed");
  });
  const beforeLost = (await snapshot()).projectRevision;
  await page.locator('#connection-form [name="scope"]').fill("Saved despite a lost response");
  await page.locator('#connection-form [type="submit"]').click();
  await page.locator("[data-inspect-outcome]").waitFor();
  assert.equal(await page.locator('#connection-form [type="submit"]').isDisabled(), true);
  assert.equal((await snapshot()).projectRevision, beforeLost + 1);
  await page.locator("[data-inspect-outcome]").click();
  await page.locator("[data-acknowledge-outcome]").waitFor();
  assert.ok(
    (await page.locator(".form-error").textContent()).includes("Saved despite a lost response"),
  );
  await page.locator("[data-acknowledge-outcome]").click();
  await page.waitForFunction(
    () => !document.querySelector('#connection-form [type="submit"]').disabled,
  );
  assert.equal(sent, 1);
  assert.equal(
    await page.locator('#connection-form [name="scope"]').inputValue(),
    "Saved despite a lost response",
  );
  await page.unroute("**/api/changesets");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.locator("#revision-range").fill(String(start.projectRevision));
  await page.locator("#revision-range").dispatchEvent("change");
  assert.equal(await page.locator('[data-action="create-artifact"]').isDisabled(), true);
  // Expected API conflict is a browser console 409; no script/CSP failures allowed.
  assert.deepEqual(
    errors.filter((error) => !error.includes("409") && !error.includes("net::ERR_FAILED")),
    [],
  );
  console.log(
    `Native workflow passed: ${key}, canonical create/link/update, versions and saved field diff, reload persistence, stale-write rejection, 680px matrix containment, inline native artifact editing, lost-response inspection without replay and historical write lock.`,
  );
} finally {
  await browser.close();
}
