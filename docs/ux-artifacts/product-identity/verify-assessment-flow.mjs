import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { reviewFolder, disposableOrigin } from "./verification-fixtures.mjs";
const folder = reviewFolder();
await mkdir(folder, { recursive: true });
const browser = await chromium.launch();
const entries = [],
  runs = [];
const heads = async () =>
  Object.fromEntries(
    await Promise.all(
      ["default", "gatherline"].map(async (project) => [
        project,
        (
          await (
            await fetch(process.env.TRACER_REVIEW_ORIGIN + "/api/project-snapshot", {
              headers: { "X-Tracer-Project": project },
            })
          ).json()
        ).projectRevision,
      ]),
    ),
  );
const originalHeads = process.env.TRACER_REVIEW_ORIGIN ? await heads() : null;
for (const [label, port, width, height] of [
  ["desktop", Number(process.env.TRACER_DESKTOP_PORT ?? 8176), 1440, 1000],
  ["narrow", Number(process.env.TRACER_NARROW_PORT ?? 8177), 680, 900],
]) {
  const origin = disposableOrigin(`http://127.0.0.1:${port}`),
    context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [],
    writes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.method() === "POST")
      writes.push({ endpoint: new URL(r.url()).pathname, body: r.postDataJSON() });
  });
  const snapshot = async () => (await page.request.get(origin + "/api/project-snapshot")).json();
  const start = await snapshot();
  assert.equal(start.projectRevision, 399);
  const subject = start.entities.find((e) => e.key === "PRS-02"),
    output = start.entities.find((e) => e.key === "RUN-01");
  const receipts = await (
    await page.request.get(origin + "/api/evidence?kind=receipt&subject=" + output.id + "&limit=25")
  ).json();
  const receipt = receipts.items.find((item) => item.supersedes);
  assert.ok(receipt, "Run prepare-assessment.mjs against the fresh fixture first.");
  const initialComparison = await (
    await page.request.get(origin + "/api/comparison?receiptId=" + receipt.id)
  ).json();
  assert.equal(initialComparison.state, "current");
  const rationale =
    "The operating-temperature range now extends beyond the recorded 10–40 °C checks. Schedule verification at 5–45 °C before relying on this result for the expanded range.";
  const capture = async (step, name, caption) => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.mouse.move(15, 15);
    const file = `${String(step).padStart(2, "0")}-${label}-${name}.png`;
    await page.screenshot({ path: folder + file });
    entries.push({
      step,
      label,
      file,
      title: name.replaceAll("-", " "),
      caption,
      viewport: { width, height },
      revision: Number(await page.locator("#revision-range").inputValue()),
    });
    console.log(label, step, name);
  };
  const choose = async () => {
    await page.locator('[data-action="search"]').click();
    await page.locator("#search").fill("PRS-02");
    await page.locator('[data-result="PRS-02"]').click();
  };
  try {
    await page.goto(origin + "/?native=1&presentation=1&view=matrix");
    await page.locator('[role="grid"]').waitFor();
    await choose();
    await page.getByRole("button", { name: /^Assess evidence/ }).click();
    await page
      .locator(`[data-receipt="${receipt.id}"][aria-pressed="true"]`)
      .waitFor({ state: "attached" });
    const stage = page.getByLabel("Captured result review", { exact: true });
    await stage.getByText("Freshness: current · Review: unreviewed", { exact: true }).waitFor();
    await capture(
      0,
      "matching-evidence-before-edit",
      "Prepared fictional receipt captures PRS-02 v2 and two other declared inputs. The core comparison is current at r399; this is simulated fixture evidence, not a physical test.",
    );
    await page
      .getByRole("button", { name: /^Back to (investigation|matrix)$/, exact: true })
      .click();
    await page.locator('[data-grid-artifact="PRS-02"]').first().dblclick();
    const revised = subject.fields.statement.replace("10–40", "5–45");
    assert.notEqual(revised, subject.fields.statement);
    await page.locator('#matrix-cell-form [name="statement"]').fill(revised);
    await capture(
      1,
      "modify-operating-range",
      "Modify PRS-02 from 10–40 °C to 5–45 °C in Matrix. The proposal is not yet saved.",
    );
    await page.locator('#matrix-cell-form [type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector("#matrix-cell-form"));
    assert.equal((await snapshot()).projectRevision, 400);
    await page.locator('[data-view="history"]').click();
    await capture(
      2,
      "inspect-saved-change",
      "r400 contains the real saved statement change. Literal changed text is emphasized; the evaluation receipt remains unchanged.",
    );
    await page.locator('[data-action="inspect-revision"]').click();
    await page
      .locator(".evidence-summary")
      .getByText(/1 changed/)
      .waitFor();
    const graphIds = await page
      .locator(".edgehit")
      .evaluateAll((es) => es.map((e) => e.dataset.edge).sort());
    assert.equal(graphIds.length, 20);
    await capture(
      3,
      "investigate-dependencies",
      "The recorded dependency graph retains the r400 investigation. The evaluation summary derives drift from declared receipt inputs, independently of graph proximity.",
    );
    await page.getByRole("button", { name: /^Assess evidence/ }).click();
    await stage.getByText("Freshness: changed · Review: unreviewed", { exact: true }).waitFor();
    const selectedInput = stage.getByLabel("Selected input comparison", { exact: true });
    await selectedInput.getByText("Captured v2 → Current v3", { exact: true }).waitFor();
    assert.ok((await selectedInput.textContent()).includes("10–40"));
    assert.ok((await selectedInput.textContent()).includes("5–45"));
    await selectedInput.scrollIntoViewIfNeeded();
    await capture(
      4,
      "compare-captured-and-current-inputs",
      "Review the immutable captured PRS-02 v2 statement beside current v3. Freshness is changed; the simulated recorded outcome is a separate fact.",
    );
    await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
    await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
    await stage.getByLabel("Review rationale", { exact: true }).fill(rationale);
    await stage.getByLabel("Review rationale", { exact: true }).scrollIntoViewIfNeeded();
    await capture(
      5,
      "assess-and-draft-decision",
      "Choose Needs reevaluation and enter the engineering rationale. The decision is still an unsaved review draft bound to this comparison.",
    );
    await page.locator('[data-view="matrix"]').click();
    assert.equal(await page.locator("#revision-range").inputValue(), "400");
    await page.getByRole("button", { name: /^Resume assessment/ }).click();
    assert.equal(
      await stage.getByLabel("Review rationale", { exact: true }).inputValue(),
      rationale,
    );
    await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
    await page.getByLabel("Recorded decision", { exact: true }).waitFor();
    assert.equal(
      (await snapshot()).projectRevision,
      400,
      "Review appends evidence history, not a native revision.",
    );
    const reviewId = await page
      .getByLabel("Recorded decision", { exact: true })
      .getAttribute("data-review-id");
    await page.getByLabel("Recorded decision", { exact: true }).scrollIntoViewIfNeeded();
    await capture(
      6,
      "recorded-decision",
      "An immutable review records Needs reevaluation, rationale, actor and timestamp. It does not erase input drift or rewrite the original outcome. Native revision stays r400.",
    );
    assert.ok(
      (await stage.textContent()).includes("Freshness: changed · Review: needs_reevaluation"),
    );
    await page
      .getByRole("button", { name: /^Back to (investigation|matrix)$/, exact: true })
      .click();
    await capture(
      7,
      "return-to-investigation",
      "Return to the same r400 investigation. Recorded dependency scope and artifact selection remain; changed evidence remains changed after the decision.",
    );
    assert.deepEqual(
      await page.locator(".edgehit").evaluateAll((es) => es.map((e) => e.dataset.edge).sort()),
      graphIds,
    );
    await page.locator('[data-action="return-change"]').click();
    assert.equal(await page.locator("#revision-range").inputValue(), "400");
    await page.reload();
    await page.locator('[role="grid"]').waitFor();
    await choose();
    await page.getByRole("button", { name: /^Assess evidence/ }).click();
    await page.getByLabel("Recorded decision", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Recorded decision", { exact: true }).getAttribute("data-review-id"),
      reviewId,
    );
    await capture(
      8,
      "persisted-decision-after-reload",
      "Reload and reopen the evaluation: the exact recorded review ID, rationale and freshness remain available from the database.",
    );
    const comparison = await (
      await page.request.get(origin + "/api/comparison?receiptId=" + receipt.id)
    ).json();
    assert.equal(comparison.state, "changed");
    assert.equal(comparison.review.state, "needs_reevaluation");
    assert.equal(comparison.review.decision.rationale, rationale);
    assert.deepEqual(
      await (await page.request.get(origin + "/api/receipt?receiptId=" + receipt.id)).json(),
      receipt,
    );
    assert.equal(writes.filter((w) => w.endpoint === "/api/changesets").length, 1);
    assert.equal(writes.filter((w) => w.endpoint === "/api/reviews").length, 1);
    assert.deepEqual(errors, []);
    runs.push({
      label,
      origin,
      subjectId: subject.id,
      receiptId: receipt.id,
      reviewId,
      initialRevision: 399,
      modifiedRevision: 400,
      capturedVersion: 2,
      currentVersion: 3,
      initialFreshness: "current",
      finalFreshness: comparison.state,
      decision: comparison.review.state,
      rationale,
      receiptUnchanged: true,
      reloadConfirmed: true,
      requests: writes,
      pageErrors: errors,
    });
  } catch (error) {
    await page.screenshot({ path: folder + "failure-" + label + ".png" });
    throw error;
  } finally {
    await context.close();
  }
}
if (originalHeads) assert.deepEqual(await heads(), originalHeads);
await writeFile(
  folder + "manifest.json",
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      scenario: "Modify → investigate → assess → record decision",
      originalReviewHeads: originalHeads,
      originalReviewDatabasesUnchanged: originalHeads ? true : null,
      fixture:
        "Fresh fictional Aster with an explicit simulated superseding receipt captured before the edit. No test result is represented as physical engineering evidence.",
      runs,
      entries,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(
  "Assessment flow passed at desktop and 680px: persisted native edit, declared-input freshness, retained draft, exact decision record, unchanged receipt/outcome and native revision, reload and disposable-fixture isolation.",
);
