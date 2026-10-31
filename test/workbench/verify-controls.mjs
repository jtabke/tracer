import assert from "node:assert/strict";
import { launchVerifiedBrowser } from "./verification-browser.mjs";
const origin = process.env.TRACER_NATIVE_ORIGIN ?? "http://127.0.0.1:8174";
const { browser, page } = await launchVerifiedBrowser({ width: 1440, height: 1000 });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const heads = async () =>
  Promise.all(
    ["default", "gatherline"].map(
      async (project) =>
        (
          await (
            await page.request.get(origin + "/api/project-snapshot", {
              headers: { "X-Tracer-Project": project },
            })
          ).json()
        ).projectRevision,
    ),
  );
try {
  const originalHeads = await heads();
  await page.goto(origin + "/?native=1&presentation=1");
  await page.locator(".node").first().waitFor();
  assert.ok(
    (await page.locator("#database-picker option:checked").textContent()).includes("Aster"),
  );
  assert.equal(await page.locator("#database-picker option").count(), 2);
  await page.locator('[data-edit-field="statement"]').click();
  await page
    .locator("#inline-value")
    .fill("Retain this unsaved proposal when switching is cancelled.");
  await page.locator("#database-picker").selectOption("gatherline");
  await page.locator("#cancel-database-switch").click();
  assert.equal(await page.locator("#database-picker").inputValue(), "default");
  assert.equal(
    await page.locator("#inline-value").inputValue(),
    "Retain this unsaved proposal when switching is cancelled.",
  );
  // Explicit switch disposes that draft only after confirmation and reloads transport identity.
  await page.locator("#database-picker").selectOption("gatherline");
  await page.locator("#confirm-database-switch").click();
  await page.waitForURL("**project=gatherline**");
  await page.locator(".node").first().waitFor();
  assert.equal(await page.locator("#database-picker").inputValue(), "gatherline");
  assert.equal(await page.locator('.node[data-key="PRS-01"]').count(), 0);
  assert.equal(await page.locator("#inline-value").count(), 0);
  assert.equal(await page.locator(".context h1").textContent(), "Connections");
  await page.locator('[data-view="matrix"]').click();
  assert.ok(await page.locator("tbody tr").count());
  const rootType = await page.locator("#trace-root-type").inputValue();
  assert.notEqual(rootType, "product_requirement");
  await page.locator("#database-picker").selectOption("default");
  await page.waitForURL("**project=default**");
  await page.locator(".traceability-matrix").waitFor();
  assert.equal(await page.locator("#trace-root-type").inputValue(), "product_requirement");
  await page.locator('[data-view="graph"]').click();
  await page.locator('[data-key="SYS-04"]').click();
  await page.waitForFunction(
    () => document.querySelector(".node.selected")?.dataset.key === "SYS-04",
  );
  assert.equal(await page.locator(".relationship-entry").count(), 5);
  assert.equal(await page.locator(".inspector details").count(), 0);
  await page.screenshot({ path: "output/product-identity/direct-controls-native.png" });
  const beforeCanvas = await page
    .locator(".scene")
    .evaluate((el) => getComputedStyle(el).transform);
  const box = await page.locator(".inspector").boundingBox();
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.wheel(0, 100);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  assert.equal(
    await page.locator(".scene").evaluate((el) => getComputedStyle(el).transform),
    beforeCanvas,
  );
  await page.setViewportSize({ width: 680, height: 900 });
  await page.waitForFunction(() => document.body.dataset.panel === "sheet");
  await page.screenshot({ path: "output/product-identity/direct-controls-native-680.png" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(await heads(), originalHeads);
  assert.deepEqual(errors, []);
  console.log(
    "Controls passed: all inspector relationships visible, real database switch/reload identity, retained cancelled draft, separate domain matrix schema, unchanged database heads, inspector wheel isolation and 680px containment.",
  );
} finally {
  await browser.close();
}
