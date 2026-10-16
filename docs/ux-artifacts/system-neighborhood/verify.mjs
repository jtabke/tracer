import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(new URL("index.html", import.meta.url).href);
  await expect(page.locator("#family .card")).toHaveCount(4);
  await expect(page.locator("#intents .intent")).toHaveCount(2);
  await expect(page.locator("#card-SW-LIMIT")).toContainText("One item · two parents");
  await page.screenshot({ path: "/tmp/tracer-neighborhood-family.png", fullPage: true });
  await page.getByText("Edit SW-LIMIT in this context", { exact: true }).click();
  const statement = page.getByLabel("Statement for SW-LIMIT", { exact: true });
  const manual =
    "When the configured command limit is reached, record an assessment question before choosing a stopping policy.";
  await statement.fill(manual);
  await expect(statement).toBeFocused();
  await expect(page.locator("#evidence-TEST-STOP")).toContainText(
    "SW-LIMIT · v3 — local proposed wording differs",
  );
  await expect(page.locator("#evidence-TEST-VOLUME")).not.toContainText(
    "local proposed wording differs",
  );
  await page
    .getByRole("button", {
      name: "Show Stop motion on a drive fault family for SW-LIMIT",
      exact: true,
    })
    .click();
  await expect(page.locator("#family .card")).toHaveCount(3);
  await expect(statement).toHaveValue(manual);
  await expect(page.locator("#related")).toContainText("Define the drive command contract");
  await page.getByRole("button", { name: "Explore the change", exact: true }).click();
  await expect(page.locator("#card-SW-LIMIT .comparison")).toContainText(
    "stop issuing motion commands immediately",
  );
  await page
    .getByLabel("Assessment question for SW-LIMIT", { exact: true })
    .fill("Does ramp-down change the meaning of the stopping intent?");
  await page
    .getByLabel("Assessment question for TEST-STOP", { exact: true })
    .fill("The original observation did not exercise ramp-down. What would need observing?");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Use the illustrative ramp-down wording", exact: true })
    .click();
  await expect(statement).toHaveValue(manual);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Use the illustrative ramp-down wording", exact: true })
    .click();
  await expect(statement).toHaveValue(
    await page.evaluate(() => globalThis.TRACER_TOY_FIXTURE.proposal),
  );
  await expect(page.locator("#intents")).toContainText("Unchanged system intent");
  await expect(page.locator("#intents")).not.toContainText("ramp down");
  const parentBounds = await page.locator(".intent-section").boundingBox();
  const selectedBounds = await page.locator("#title-SW-LIMIT").boundingBox();
  assert.ok(parentBounds.y >= 0 && parentBounds.y + parentBounds.height <= 1100);
  assert.ok(selectedBounds.y >= parentBounds.y + parentBounds.height);
  await page.screenshot({ path: "/tmp/tracer-neighborhood-proposal-viewport.png" });
  await page.getByLabel("Contribution title", { exact: true }).fill("Define limit-event recovery");
  await page
    .getByLabel("Full statement", { exact: true })
    .fill(
      "The bench workflow shall record the agreed recovery condition after a limit event; the condition remains to be established.",
    );
  await page
    .getByRole("button", { name: "Work with Deliver the commanded volume family", exact: true })
    .click();
  await expect(page.locator("#author-context")).toContainText("SYS-STOP");
  await expect(page.getByLabel("Contribution title", { exact: true })).toHaveValue(
    "Define limit-event recovery",
  );
  await page.getByRole("button", { name: "Add a local contribution", exact: true }).click();
  await expect(page.locator("#scope-label")).toContainText("SYS-STOP");
  await expect(page.locator("#title-LOCAL-1")).toBeFocused();
  await page.getByLabel("Existing information", { exact: true }).selectOption("MECH-BACKLASH");
  await page.getByRole("button", { name: "Propose this connection", exact: true }).click();
  await expect(page.locator("#family .card")).toHaveCount(5);
  await expect(page.locator("#title-MECH-BACKLASH")).toBeFocused();
  await page
    .getByLabel("Contribution title", { exact: true })
    .fill("Unfinished second contribution");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download toy drafts", exact: true }).click();
  const download = await downloadPromise;
  const exportedPath = "/tmp/tracer-neighborhood-toy-drafts.json";
  await download.saveAs(exportedPath);
  const workspace = JSON.parse(readFileSync(exportedPath, "utf8"));
  assert.equal(workspace.addedItems.length, 1);
  assert.equal(workspace.author.title, "Unfinished second contribution");
  assert.equal(
    workspace.questions["TEST-STOP"],
    "The original observation did not exercise ramp-down. What would need observing?",
  );
  await page
    .getByLabel("Assessment question for TEST-STOP", { exact: true })
    .fill("Additional unsaved question after the download.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#import").setInputFiles(exportedPath);
  await expect(page.locator("#status")).toContainText("Resume cancelled");
  await expect(page.getByLabel("Assessment question for TEST-STOP", { exact: true })).toHaveValue(
    "Additional unsaved question after the download.",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset experiment", exact: true }).click();
  await expect(page.locator("#family .card")).toHaveCount(4);
  await page.locator("#import").setInputFiles(exportedPath);
  await expect(page.locator("#family .card")).toHaveCount(5);
  await expect(page.getByLabel("Contribution title", { exact: true })).toHaveValue(
    "Unfinished second contribution",
  );
  await expect(page.getByLabel("Assessment question for TEST-STOP", { exact: true })).toHaveValue(
    workspace.questions["TEST-STOP"],
  );
  await page.locator("#import").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"prototype":"wrong"}'),
  });
  await expect(page.locator("#status")).toContainText("Current drafts retained");
  await expect(page.locator("#family .card")).toHaveCount(5);
  // A loaded text draft is rendered as text, never executable markup.
  await page.getByText("Edit SW-LIMIT in this context", { exact: true }).click();
  await page
    .getByLabel("Statement for SW-LIMIT", { exact: true })
    .fill('<img src="https://example.invalid/x" onerror="alert(1)">');
  await expect(page.locator("#statement-SW-LIMIT img")).toHaveCount(0);
  await expect(page.locator("#statement-SW-LIMIT")).toContainText("<img");
  await page
    .getByRole("button", { name: "Discard local wording edit SW-LIMIT", exact: true })
    .click();
  await expect(page.locator("#evidence-TEST-STOP")).not.toContainText(
    "local proposed wording differs",
  );
  await expect(page.getByLabel("Assessment question for TEST-STOP", { exact: true })).toHaveValue(
    workspace.questions["TEST-STOP"],
  );
  await page.screenshot({ path: "/tmp/tracer-neighborhood-change.png", fullPage: true });
  await page.setViewportSize({ width: 680, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page
    .getByRole("button", { name: "Work with Deliver the commanded volume family", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#family-heading")).toBeFocused();
  await expect(page.locator("#scope-label")).toContainText("SYS-DEL");
  await page.screenshot({ path: "/tmp/tracer-neighborhood-narrow.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.ok(requests.every((url) => url.startsWith("file:") || url.startsWith("blob:")));
  console.log(
    "PASS: local file workflow; in-context editing/focus; shared identity and cross-context; no propagation; captured author parent; linking without duplicates; draft export/reset/resume including unfinished author text; failed import retention; inert markup; assessment retention; narrow keyboard/navigation; no HTTP requests or page errors.",
  );
} finally {
  await browser.close();
}
