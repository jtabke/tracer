import { disposableOrigin } from "./verification-fixtures.mjs";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
const origin = disposableOrigin();
assert.notEqual(new URL(origin).port, "8174", "Use a disposable prepared fixture.");
const { browser, page } = await launchVerifiedBrowser({ width: 680, height: 900 });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const read = async (path) => (await page.request.get(origin + path)).json();
const token = (await read("/api/session")).token;
const post = async (path, data) => {
  const response = await page.request.post(origin + path, {
    headers: { "X-Tracer-Token": token, Origin: origin },
    data,
  });
  assert.ok(response.ok(), await response.text());
  return response.json();
};
const snapshot = () => read("/api/project-snapshot");
const native = async (operations) =>
  post("/api/changesets", { expectedSchemaVersion: (await snapshot()).schema.version, operations });
const change = async (field, value) => {
  const root = (await snapshot()).entities.find((e) => e.key === "PRS-02");
  return native([
    {
      op: "entity.update",
      id: root.id,
      expectedVersion: root.version,
      input: { fields: { ...root.fields, [field]: value } },
    },
  ]);
};
const stage = page.getByLabel("Captured result review", { exact: true }),
  save = stage.getByRole("button", { name: "Record review decision", exact: true });
const refresh = async () => {
  await page.getByRole("button", { name: "Refresh evidence", exact: true }).click();
  const button = page.getByRole("button", { name: "Refresh workspace", exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(
    page.getByText("Loading recorded evaluations. Review is paused.", { exact: true }),
  ).toHaveCount(0);
};
try {
  const initial = await snapshot(),
    root = initial.entities.find((e) => e.key === "PRS-02"),
    output = initial.entities.find((e) => e.key === "RUN-01");
  const prepared = (
    await read("/api/evidence?kind=receipt&subject=" + output.id + "&limit=25")
  ).items.find((r) => r.supersedes);
  assert.ok(prepared, "Prepare an isolated fixture first.");
  await page.goto(origin + "/?native=1&presentation=1&view=matrix");
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill("PRS-02");
  await page.locator('[data-result="PRS-02"]').click();
  await page.locator('[data-action="assess-evidence"]').click();
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("accepted");
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Safety check: retained proposal against the captured comparison.");
  await page.locator("#database-picker").selectOption("gatherline");
  await page.locator("#cancel-database-switch").click();
  assert.equal(
    await stage.getByLabel("Review rationale", { exact: true }).inputValue(),
    "Safety check: retained proposal against the captured comparison.",
  );
  assert.equal(await page.locator("#database-picker").inputValue(), "default");
  const countBefore = (await read("/api/evidence?kind=review&subject=" + prepared.id + "&limit=25"))
    .items.length;
  // Change after the comparison was captured, before the review POST reaches the service.
  await change("statement", root.fields.statement + " Safety-check relevant edit.");
  await save.click();
  await expect(page.getByRole("button", { name: "Refresh workspace", exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  assert.equal(
    (await read("/api/evidence?kind=review&subject=" + prepared.id + "&limit=25")).items.length,
    countBefore,
  );
  await page.getByRole("button", { name: "Refresh workspace", exact: true }).click();
  await expect(
    stage.getByRole("button", { name: "Adopt refreshed review inputs", exact: true }),
  ).toBeVisible();
  assert.equal(
    await stage.getByLabel("Review rationale", { exact: true }).inputValue(),
    "Safety check: retained proposal against the captured comparison.",
  );
  await stage.getByRole("button", { name: "Adopt refreshed review inputs", exact: true }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByLabel("Recorded decision", { exact: true })).toContainText(
    "Evidence still applicable",
  );
  let comparison = await read("/api/comparison?receiptId=" + prepared.id);
  assert.equal(comparison.review.state, "accepted");
  assert.equal(comparison.hasChanged, true);
  // This receipt explicitly captures statement only. An unrelated title edit must not expire it.
  const stableToken = comparison.token;
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Retained through an unrelated title edit.");
  await change("title", root.fields.title + " · safety fixture");
  await refresh();
  comparison = await read("/api/comparison?receiptId=" + prepared.id);
  assert.equal(comparison.token, stableToken);
  assert.equal(comparison.review.state, "accepted");
  await expect(
    stage.getByRole("button", { name: "Adopt refreshed review inputs", exact: true }),
  ).toHaveCount(0);
  await expect(save).toBeEnabled();
  // Different-receipt activation must not retarget a dirty proposal.
  const other = page.locator("[data-receipt]").filter({ hasText: "Superseded" }).first();
  await page.getByRole("button", { name: /^Evaluations/ }).click();
  await other.click();
  await expect(
    page.getByText(
      "Your review draft is retained. Finish it or discard it before choosing another evaluation.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(
    await stage.getByLabel("Review rationale", { exact: true }).inputValue(),
    "Retained through an unrelated title edit.",
  );
  // Failed reads pause every review decision while retaining the field values.
  await page.route("**/api/comparison?*", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh evidence", exact: true }).click();
  await expect(stage.getByText(/Receipt comparison could not be established/)).toBeVisible();
  await expect(save).toBeDisabled();
  assert.equal(
    await stage.getByLabel("Review rationale", { exact: true }).inputValue(),
    "Retained through an unrelated title edit.",
  );
  await page.unroute("**/api/comparison?*");
  await page.getByRole("button", { name: "Refresh evidence", exact: true }).click();
  await expect(save).toBeEnabled();
  await stage.getByRole("button", { name: "Discard review draft", exact: true }).click();
  await change(
    "statement",
    (await snapshot()).entities.find((e) => e.id === root.id).fields.statement +
      " Another relevant edit.",
  );
  comparison = await read("/api/comparison?receiptId=" + prepared.id);
  assert.equal(comparison.review.state, "unreviewed");
  assert.equal(comparison.review.previous.decision, "accepted");
  // Unknown input outside the ordinary graph, alongside a known changed declared input.
  const extra = crypto.randomUUID();
  await native([
    {
      op: "entity.create",
      id: extra,
      input: {
        type: "design_output",
        key: "OUT-SAFETY-ONLY",
        fields: {
          title: "Disposable declared input",
          statement: "An explicit input outside the graph.",
        },
      },
    },
  ]);
  const currentRoot = (await snapshot()).entities.find((e) => e.id === root.id);
  const unknownReceipt = await post("/api/receipts", {
    outputId: output.id,
    expectedOutputVersion: output.version,
    supersedes: prepared.id,
    outcome: "SIMULATED safety-check result; immutable.",
    inputs: [
      { entityId: root.id, expectedVersion: currentRoot.version, fields: ["statement"] },
      { entityId: extra, expectedVersion: 1 },
    ],
  });
  await native([{ op: "entity.remove", id: extra, expectedVersion: 1 }]);
  await change("statement", currentRoot.fields.statement + " New declared drift.");
  await refresh();
  // Narrow view has an explicit evaluation chooser, rather than a permanent second column.
  const picker = page.getByRole("button", { name: /^Evaluations/ });
  if (!(await page.locator(`[data-receipt="${unknownReceipt.id}"]`).isVisible()))
    await picker.click();
  await page.locator(`[data-receipt="${unknownReceipt.id}"]`).click();
  await expect(stage.getByText(/Freshness: unknown/)).toBeVisible();
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("accepted");
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Unknown inputs cannot be accepted.");
  await expect(save).toBeDisabled();
  await expect(stage.getByText(/An unknown input cannot be accepted/)).toBeVisible();
  comparison = await read("/api/comparison?receiptId=" + unknownReceipt.id);
  assert.equal(comparison.hasChanged, true);
  assert.equal(comparison.hasUnknown, true);
  await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
  await save.click();
  await expect(page.getByLabel("Recorded decision", { exact: true })).toContainText(
    "Change acknowledged",
  );
  // A committed-but-lost response is inspected, never replayed automatically.
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Retain the unknown-outcome review proposal.");
  let attempts = 0;
  await page.route("**/api/reviews", async (route) => {
    attempts++;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    await route.abort();
  });
  await save.click();
  await expect(
    page.getByRole("button", { name: "Inspect saved result", exact: true }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  assert.equal(attempts, 1);
  await page.locator("#database-picker").selectOption("gatherline");
  assert.ok(
    (await page.locator(".workspace-notice").textContent()).includes("Resolve the pending save"),
  );
  assert.equal(await page.locator("#database-picker").inputValue(), "default");
  // Failed reconciliation cannot unlock the attempt.
  const reviewRead = (url) => {
    const u = new URL(url);
    return u.pathname === "/api/evidence" && u.searchParams.get("kind") === "review";
  };
  await page.route(reviewRead, (route) => route.abort());
  await page.getByRole("button", { name: "Inspect saved result", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(save).toBeDisabled();
  assert.equal(attempts, 1);
  await page.unroute(reviewRead);
  await page.getByRole("button", { name: "Inspect saved result", exact: true }).click();
  await page.locator("#acknowledge-pending-save").click();
  await expect(stage.getByRole("button", { name: "Review receipt", exact: true })).toBeVisible();
  assert.equal(attempts, 1);
  assert.equal(
    (await read("/api/comparison?receiptId=" + unknownReceipt.id)).review.state,
    "needs_reevaluation",
  );
  // Historical states contain no current freshness summary or writable assessment.
  await page.getByRole("button", { name: /^Back to (investigation|matrix)$/, exact: true }).click();
  await page.locator("#revision-range").fill("398");
  await page.locator("#revision-range").dispatchEvent("change");
  await expect(page.locator(".evidence-summary")).toHaveCount(0);
  await expect(page.locator('[data-action="assess-evidence"]')).toBeDisabled();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(
    "Assessment safety passed: native token race, retained draft, explicit input adoption, irrelevant-field stability, review retirement, blocked receipt switch, failed reads, changed+unknown inputs, unknown acceptance lock, acknowledged uncertainty, lost-response reconciliation without replay, database lock and historical read-only context.",
  );
} catch (error) {
  await page.screenshot({ path: "output/product-identity/assessment-safety-failure.png" });
  throw error;
} finally {
  await browser.close();
}
