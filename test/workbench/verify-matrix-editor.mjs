import { disposableOrigin } from "./verification-fixtures.mjs";
import assert from "node:assert/strict";
import { diffAt } from "./workspace-model.mjs";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
import { traceRows, groupedTraceRows, ancestorSpans } from "./trace-table.mjs";
// The 10 × 5 × 4 example must not expand to 200 grouped rows or invent transitions.
const records = new Map([["R", { type: "root" }]]),
  links = [];
for (let s = 0; s < 10; s++) {
  const source = `S${s}`;
  records.set(source, { type: "sub" });
  links.push({ id: `rs${s}`, source: "R", target: source, type: "allocates" });
  for (let o = 0; o < 5; o++) {
    const output = `O${s}-${o}`;
    records.set(output, { type: "output" });
    links.push({ id: `so${s}-${o}`, source, target: output, type: "realizes" });
    for (let t = 0; t < 4; t++) {
      const test = `V${s}-${o}-${t}`;
      records.set(test, { type: "test" });
      links.push({ id: test, source: output, target: test, type: "verifies" });
    }
  }
}
const steps = [
  { type: "allocates", targetType: "sub" },
  { type: "realizes", targetType: "output" },
  { type: "verifies", targetType: "test" },
];
assert.equal(traceRows(records, links, ["R"], steps).rows.length, 200);
const grouped = groupedTraceRows(records, links, ["R"], steps);
assert.equal(grouped.rows.length, 50);
assert.ok(grouped.rows.every((row) => row.terminals.length === 4));
assert.equal(ancestorSpans(grouped.rows, 4)[0][0], 50);
assert.equal(ancestorSpans(grouped.rows, 4)[0][1], 5);
const directIds = new Set(links.map((link) => link.id));
assert.ok(grouped.rows.every((row) => row.links.filter(Boolean).every((id) => directIds.has(id))));
// A shared child under two parents, or parallel canonical links, must stay distinct.
const sharedRecords = new Map([
  ["A", { type: "root" }],
  ["B", { type: "root" }],
  ["C", { type: "sub" }],
]);
const sharedLinks = [
  { id: "AC1", source: "A", target: "C", type: "allocates" },
  { id: "AC2", source: "A", target: "C", type: "allocates" },
  { id: "BC", source: "B", target: "C", type: "allocates" },
];
assert.equal(
  groupedTraceRows(sharedRecords, sharedLinks, ["A", "B"], [steps[0]]).rows[0].terminals.length,
  2,
);
assert.equal(
  groupedTraceRows(sharedRecords, sharedLinks, ["A", "B"], [steps[0], steps[1]]).rows.length,
  3,
);
assert.equal(groupedTraceRows(records, links, ["R"], steps, 3).truncated, true);
assert.equal(
  diffAt(
    {
      revisions: [
        {
          kind: "relationship",
          id: "link",
          projectRevision: 1,
          snapshot: { source: "A", target: "B", type: "realizes", fields: { scope: "Recorded" } },
        },
        {
          kind: "relationship",
          id: "link",
          projectRevision: 2,
          snapshot: { source: "A", target: "C", type: "realizes", fields: { scope: "Recorded" } },
        },
      ],
    },
    2,
  )[0].fields.find((field) => field.key === "target").after,
  "C",
);
const origin = disposableOrigin();
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
const capture = (name) => page.screenshot({ path: `output/product-identity/${name}.png` });
const saveCell = async () => {
  await page.locator('#matrix-cell-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
};
const configure = async () => {
  await page.locator(".trace-config-toggle summary").click();
  await page.locator("#trace-column-count").selectOption("2");
  await page.locator('[data-trace-relation="0"]').selectOption("realized_by");
  await page.locator('[data-trace-target="0"]').selectOption("design_output");
  await page.locator('[data-trace-relation="1"]').selectOption("verified_by");
  await page.locator('[data-trace-target="1"]').selectOption("verification_protocol");
  await page.locator(".trace-config-toggle summary").click();
};
const key = `GRID-${Date.now().toString().slice(-7)}`,
  verification = `GRID-VER-${Date.now().toString().slice(-7)}`;
try {
  await page.goto(origin + "/?native=1&presentation=1&view=matrix");
  await page.locator('[role="grid"]').waitFor();
  assert.equal(await page.locator("[data-trace-row]").count(), 5);
  assert.equal(await page.locator('[data-grid-artifact="PRS-01"]').count(), 1);
  assert.equal(await page.locator('[data-grid-artifact="SYS-04"]').count(), 1);
  const outputCell = page
    .locator('[data-grid-artifact="OUT-06"]')
    .locator("..")
    .locator("xpath=following-sibling::td");
  assert.equal(await outputCell.locator("[data-grid-artifact]").count(), 2);
  await capture("matrix-grouped-editable");
  await page.locator("#trace-presentation").selectOption("flat");
  assert.equal(await page.locator("[data-trace-row]").count(), 7);
  await page.locator("#trace-presentation").selectOption("grouped");
  await page.locator("#trace-density").selectOption("compact");
  assert.ok((await page.locator('[data-trace-row="0"]').boundingBox()).height <= 50);
  await capture("matrix-compact");
  await page.locator("#trace-density").selectOption("comfortable");
  const start = await snapshot();
  await page.locator('[data-grid-artifact="PRS-01"]').dblclick();
  await page
    .locator('#matrix-cell-form [name="title"]')
    .fill("Present a complete home measurement");
  await page
    .locator('#matrix-cell-form [name="statement"]')
    .fill("Present the complete pressure and pulse result after a valid cycle.");
  await saveCell();
  let current = await snapshot();
  assert.equal(current.projectRevision, start.projectRevision + 1);
  assert.equal(
    current.entities.find((record) => record.key === "PRS-01").version,
    start.entities.find((record) => record.key === "PRS-01").version + 1,
  );
  await page.locator('[data-action="create-artifact"]').click();
  await page.locator("[data-cell-details]").click();
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.locator('#create-form [name="key"]').fill(key);
  await page.locator('#create-form [name="title"]').fill("Control the stated operating envelope");
  await page
    .locator('#create-form [name="statement"]')
    .fill("Maintain the engineering target throughout the declared operating envelope.");
  await page.locator('#create-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector("#create-form"));
  await configure();
  await page.locator('[data-grid-col="1"] [data-cell-add]').click();
  await page.locator('#matrix-cell-form [name="query"]').fill("OUT-01");
  await page.locator('#matrix-cell-form [name="query"]').press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.locator('#matrix-cell-form [name="scope"]').fill("Pressure acquisition design input.");
  await saveCell();
  current = await snapshot();
  const root = current.entities.find((record) => record.key === key);
  const outgoing = current.relationships.find((link) => link.source === root.id);
  assert.equal(outgoing.type, "realized_by");
  assert.equal(await page.locator("#matrix-scope option:checked").textContent(), `${key} only`);
  const out1 = current.entities.find((record) => record.key === "OUT-01");
  const candidate = current.entities.find(
    (record) =>
      record.type === "verification_protocol" &&
      !current.relationships.some(
        (link) =>
          link.type === "verified_by" && link.source === out1.id && link.target === record.id,
      ),
  );
  await page.locator('[data-grid-col="2"] [data-cell-add]').click();
  await page.locator('#matrix-cell-form [name="query"]').fill(candidate.key);
  await page.locator(`[data-picker-key="${candidate.key}"]`).click();
  await page
    .locator('#matrix-cell-form [name="scope"]')
    .fill("Additional recorded protocol connection.");
  await saveCell();
  current = await snapshot();
  assert.ok(
    current.relationships.some(
      (link) =>
        link.source === out1.id && link.target === candidate.id && link.type === "verified_by",
    ),
  );
  assert.ok(
    !current.relationships.some((link) => link.source === root.id && link.target === candidate.id),
  );
  // Replace the exact incoming link; do not clone rows or move the old output's other links.
  await page.locator(`[data-matrix-edge="${outgoing.id}"]`).dblclick();
  await page.locator('#matrix-cell-form [name="query"]').fill("OUT-02");
  await page.locator('[data-picker-key="OUT-02"]').click();
  await saveCell();
  current = await snapshot();
  const out2 = current.entities.find((record) => record.key === "OUT-02");
  assert.equal(current.relationships.find((link) => link.id === outgoing.id).target, out2.id);
  assert.equal(current.relationships.find((link) => link.id === outgoing.id).version, 2);
  assert.ok(
    current.relationships.some((link) => link.source === out1.id && link.target === candidate.id),
  );
  await page.locator('[data-view="history"]').click();
  assert.ok(
    (await page.locator(".field-diff .before").allTextContents()).join(" ").includes("OUT-01"),
  );
  assert.ok(
    (await page.locator(".field-diff .after").allTextContents()).join(" ").includes("OUT-02"),
  );
  await page.locator('[data-view="matrix"]').click();
  // Create an artifact and its typed relationship atomically, inside the verification cell.
  const beforeCreate = current.projectRevision;
  await page.locator('[data-grid-col="2"] [data-cell-add]').click();
  await page.locator("[data-cell-create]").click();
  await page.locator("[data-cell-details]").click();
  await page.locator('#matrix-cell-form [name="key"]').fill(verification);
  await page
    .locator('#matrix-cell-form [name="title"]')
    .fill("Operating-envelope verification protocol");
  await page
    .locator('#matrix-cell-form [name="statement"]')
    .fill("Define checks throughout the declared envelope.");
  await page
    .locator('#matrix-cell-form [name="scope"]')
    .fill("Verification scope recorded from the selected design output.");
  await capture("matrix-cell-picker");
  await saveCell();
  current = await snapshot();
  assert.equal(current.projectRevision, beforeCreate + 1);
  const protocol = current.entities.find((record) => record.key === verification);
  const link = current.relationships.find(
    (link) => link.source === out2.id && link.target === protocol.id,
  );
  assert.equal(link.type, "verified_by");
  await page.locator(`[data-matrix-edge="${link.id}"]`).click();
  await page.locator("[data-grid-show-path]").click();
  const graphIds = await page
    .locator(".edgehit")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.edge).sort());
  const expected = [
    outgoing.id,
    ...current.relationships
      .filter(
        (link) =>
          link.source === out2.id &&
          link.type === "verified_by" &&
          current.entities.find((record) => record.id === link.target)?.type ===
            "verification_protocol",
      )
      .map((link) => link.id),
  ].sort();
  assert.deepEqual(graphIds, expected);
  assert.equal(await page.locator("#revision-range").inputValue(), String(current.projectRevision));
  await capture("matrix-exact-path-graph");
  await page.locator('.matrix-path-context [data-view="matrix"]').click();
  assert.equal(await page.locator("#matrix-scope option:checked").textContent(), `${key} only`);
  assert.equal(await page.locator('[data-grid-artifact="' + verification + '"]').count(), 1);
  await page.locator('[data-view="history"]').click();
  assert.ok(
    (await page.locator(".field-diff .after").allTextContents())
      .join(" ")
      .includes("Verification scope recorded"),
  );
  await page.locator('[data-view="matrix"]').click();
  // A stale in-cell edit must retain the proposed scope without overwriting the external edit.
  await page.locator(`[data-matrix-edge="${outgoing.id}"]`).dblclick();
  await page.locator('#matrix-cell-form [name="scope"]').fill("Unsaved matrix proposal");
  const token = (await (await page.request.get(origin + "/api/session")).json()).token;
  const stored = current.relationships.find((link) => link.id === outgoing.id);
  const response = await page.request.post(origin + "/api/changesets", {
    headers: { "X-Tracer-Token": token, Origin: origin },
    data: {
      expectedSchemaVersion: current.schema.version,
      operations: [
        {
          op: "relationship.update",
          id: stored.id,
          expectedVersion: stored.version,
          input: {
            type: stored.type,
            source: stored.source,
            target: stored.target,
            fields: { ...stored.fields, scope: "External saved scope" },
          },
        },
      ],
    },
  });
  assert.equal(response.status(), 200);
  await page.locator('#matrix-cell-form [type="submit"]').click();
  await page
    .locator("#matrix-cell-form .form-error")
    .filter({ hasText: /version|conflict|changed/i })
    .waitFor();
  assert.equal(
    await page.locator('#matrix-cell-form [name="scope"]').inputValue(),
    "Unsaved matrix proposal",
  );
  assert.equal(
    (await snapshot()).relationships.find((link) => link.id === stored.id).fields.scope,
    "External saved scope",
  );
  // Draft survives other lenses and requires confirmation before a database switch.
  await page.locator('[data-view="history"]').click();
  await page.locator('[data-view="matrix"]').click();
  assert.equal(
    await page.locator('#matrix-cell-form [name="scope"]').inputValue(),
    "Unsaved matrix proposal",
  );
  await page.locator("#database-picker").selectOption("gatherline");
  await page.locator("#cancel-database-switch").click();
  assert.equal(
    await page.locator('#matrix-cell-form [name="scope"]').inputValue(),
    "Unsaved matrix proposal",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#matrix-cell-form").count(), 0);
  const active = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  assert.equal(active, "gridcell");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  // A lost response must retain the in-cell proposal across lenses and never replay the write.
  await page.reload();
  await page.locator('[role="grid"]').waitFor();
  await page.keyboard.press("/");
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await configure();
  await page.locator(`[data-matrix-edge="${outgoing.id}"]`).dblclick();
  await page.locator('#matrix-cell-form [name="scope"]').fill("Matrix save with a lost response");
  let sent = 0;
  await page.route("**/api/changesets", async (route) => {
    sent++;
    await route.fetch();
    await route.abort("failed");
  });
  const beforeLost = (await snapshot()).projectRevision;
  await page.locator('#matrix-cell-form [type="submit"]').click();
  await page.locator("[data-inspect-outcome]").waitFor();
  assert.equal((await snapshot()).projectRevision, beforeLost + 1);
  await page.locator('[data-view="history"]').click();
  await page.locator('[data-action="inspect-pending-save"]').click();
  await page.locator("#acknowledge-pending-save").waitFor();
  assert.ok(
    (await page.locator("dialog").textContent()).includes("Matrix save with a lost response"),
  );
  await page.locator("#acknowledge-pending-save").click();
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  await page.locator('[data-view="matrix"]').click();
  assert.equal(
    await page.locator('#matrix-cell-form [name="scope"]').inputValue(),
    "Matrix save with a lost response",
  );
  assert.equal(sent, 1);
  await page.unroute("**/api/changesets");
  await page.locator("[data-cell-cancel]").click();
  const copied = await page.locator(".grid-cell-selected").evaluate((cell) => {
    const data = new DataTransfer();
    cell.dispatchEvent(
      new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }),
    );
    return data.getData("text/plain");
  });
  assert.ok(copied.includes("OUT-02"));
  await page.setViewportSize({ width: 680, height: 900 });
  await page.waitForFunction(() => document.body.dataset.panel === "sheet");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await capture("matrix-editor-680");
  assert.deepEqual(errors, []);
  console.log(
    "Matrix editor passed: 200→50 grouped rows, exact shared/parallel semantics, grouped/flat/compact, inline artifact save, direct typed add/replace, atomic create-and-link, exact graph/History context, stale-write rejection, retained drafts, lost-response recovery without replay, keyboard/copy and 680px containment.",
  );
} finally {
  await browser.close();
}
