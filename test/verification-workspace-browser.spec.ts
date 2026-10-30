import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { openProjectDestination } from "./project-navigation.ts";
import {
  verificationFixture,
  verificationTargetInput,
  verificationActor as actor,
} from "./verification-fixture.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

async function unloadWouldWarn(page: Page) {
  return page.evaluate(
    () => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  );
}

async function selectRecord(page: Page, id: string) {
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill(id);
  await page.locator(`[data-result="${id}"]`).click();
}
async function startFromRequirement(page: Page, id: string) {
  await selectRecord(page, id);
  const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole("button", { name: /Verify this requirement/ }).click();
  return page.getByRole("region", { name: "Verification workspace page", exact: true });
}

for (const [domain, width] of [
  ["engineering", 1440],
  ["research", 680],
  ["engineering", 390],
] as const)
  test(`${domain}: full-page verification keeps exact subject, drafts, focus and return context at ${width}px`, async ({
    page,
  }) => {
    const f = await verificationFixture(domain);
    const server = await startLocalServer(f.tracer, resolve("dist"), 0);
    const output = resolve("output/verification-workspace");
    mkdirSync(output, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const before = await f.tracer.exportProject();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      await selectRecord(page, f.requirement.id);
      if (width === 680) {
        await page.getByRole("button", { name: "Matrix", exact: true }).click();
        await page.locator('[data-action="details"]').click();
      }
      const originalContext = await page.locator(".context p").textContent();
      const camera = width === 1440 ? await page.locator(".scene").getAttribute("style") : null;
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.getByRole("button", { name: /Verify this requirement/ }).click();
      const workspace = page.getByRole("region", {
        name: "Verification workspace page",
        exact: true,
      });
      await expect(workspace).toBeVisible();
      await expect(page.locator("dialog:modal")).toHaveCount(0);
      await expect(page.locator(".sidebar-shell")).toHaveAttribute("data-page", "verification");
      await expect(page.locator(".workspace-perspectives")).toBeHidden();
      const context = workspace.getByRole("region", { name: "Verification context", exact: true });
      await expect(context).toContainText(f.requirement.id);
      await expect(context).toContainText("v1");
      await expect(context).toContainText("Proposed basis");
      await workspace.getByLabel("Verification model", { exact: true }).selectOption({ index: 1 });
      await expect(workspace.getByLabel("Requirement", { exact: true })).toHaveValue(
        f.requirement.id,
      );
      const title = workspace.getByLabel("Verification title", { exact: true });
      await title.fill("Retained full-page verification draft");
      await workspace
        .getByLabel("Verification purpose", { exact: true })
        .fill("Check exact declared inputs without losing the investigation.");
      await workspace
        .getByRole("button", { name: "Prepare verification basis", exact: true })
        .click();
      await expect(context).toContainText("Prepared basis");
      await expect(context).toContainText(`Native basis r${before.projectRevision}`);
      await title.focus();
      await title.evaluate((input) => (input as HTMLInputElement).setSelectionRange(4, 10));
      const beforeResize = await page.locator(".sidebar-shell").elementHandle();
      await page.setViewportSize({ width: width - 20, height: 900 });
      await expect.poll(() => beforeResize!.evaluate((element) => element.isConnected)).toBe(false);
      await expect(title).toBeFocused();
      await expect
        .poll(() =>
          title.evaluate((input) => [
            (input as HTMLInputElement).selectionStart,
            (input as HTMLInputElement).selectionEnd,
          ]),
        )
        .toEqual([4, 10]);
      const beforeRestore = await page.locator(".sidebar-shell").elementHandle();
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => beforeRestore!.evaluate((element) => element.isConnected))
        .toBe(false);
      await expect(title).toHaveValue("Retained full-page verification draft");
      await workspace.evaluate((element) => {
        element.scrollTop = element.scrollHeight / 2;
      });
      await page.screenshot({ path: resolve(output, `proposed-${domain}-${width}.png`) });
      await expect
        .poll(() => workspace.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      const contextBox = await context.boundingBox();
      const headerBox = await workspace.locator(".verification-page-header").boundingBox();
      expect(contextBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      expect(contextBox!.y).toBeLessThanOrEqual(headerBox!.y + headerBox!.height + 1);
      await expect(context).toBeInViewport();
      const readingPosition = await workspace.evaluate((element) => element.scrollTop);
      await page.screenshot({ path: resolve(output, `proposed-${domain}-${width}.png`) });
      await workspace.getByRole("button", { name: "← Back to investigation", exact: true }).click();
      await expect(page.locator(".context p")).toHaveText(originalContext!);
      if (camera) await expect(page.locator(".scene")).toHaveAttribute("style", camera);
      await openProjectDestination(page, "Verification");
      await expect(title).toHaveValue("Retained full-page verification draft");
      await expect
        .poll(() => workspace.evaluate((element) => element.scrollTop))
        .toBe(readingPosition);
      await openProjectDestination(page, "Project settings");
      await expect(
        page.getByRole("region", { name: "Project settings", exact: true }),
      ).toBeVisible();
      await openProjectDestination(page, "Verification");
      await expect(title).toHaveValue("Retained full-page verification draft");
      await expect(context).toContainText(f.requirement.id);
      await selectRecord(page, f.method.id);
      await expect(workspace).not.toBeVisible();
      await expect(page.locator(".context p")).toContainText(f.method.id);
      const expandMethod = page.getByRole("button", {
        name: "Expand artifact details",
        exact: true,
      });
      if (await expandMethod.isVisible()) await expandMethod.click();
      await expect(page.getByRole("button", { name: /Verify this requirement/ })).toHaveCount(0);
      await openProjectDestination(page, "Verification");
      await expect(context).toContainText(f.requirement.id);
      await expect(title).toHaveValue("Retained full-page verification draft");
      await openProjectDestination(page, "Workspace");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      expect(await f.tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      f.close();
    }
  });

test("a contextual request cannot replace a retained verification draft without confirmation", async ({
  page,
}) => {
  const f = await verificationFixture("engineering");
  const second = await f.tracer.createEntity(
    {
      type: f.requirement.type,
      fields: {
        ...f.requirement.fields,
        [f.definition.requirement.fields.title]: "Second criterion-bearing record",
      },
    },
    1,
    actor,
  );
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    const before = await f.tracer.exportProject();
    await page.goto(server.origin);
    const workspace = await startFromRequirement(page, f.requirement.id);
    const title = workspace.getByLabel("Verification title", { exact: true });
    await title.fill("Do not silently replace this draft");
    await workspace.getByRole("button", { name: "← Back to investigation", exact: true }).click();
    await startFromRequirement(page, second.id);
    const incoming = workspace.getByRole("region", {
      name: "Incoming requirement verification",
      exact: true,
    });
    const context = workspace.getByRole("region", { name: "Verification context", exact: true });
    await expect(incoming).toContainText(second.id);
    await expect(context).toContainText(f.requirement.id);
    await expect(title).toHaveValue("Do not silently replace this draft");
    page.once("dialog", (dialog) => dialog.dismiss());
    await incoming
      .getByRole("button", { name: "Start verification for selected requirement", exact: true })
      .click();
    await expect(context).toContainText(f.requirement.id);
    page.once("dialog", (dialog) => dialog.accept());
    await incoming
      .getByRole("button", { name: "Start verification for selected requirement", exact: true })
      .click();
    await expect(context).toContainText(second.id);
    await expect(title).toHaveValue("");
    expect(await f.tracer.exportProject()).toEqual(before);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("contextual verification never silently adopts a newer requirement revision", async ({
  page,
}) => {
  const f = await verificationFixture("engineering");
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const workspace = await startFromRequirement(page, f.requirement.id);
    await workspace.getByLabel("Verification model", { exact: true }).selectOption({ index: 1 });
    await workspace
      .getByLabel("Verification title", { exact: true })
      .fill("Preserve original proposal");
    await workspace
      .getByRole("button", { name: "Prepare verification basis", exact: true })
      .click();
    const context = workspace.getByRole("region", { name: "Verification context", exact: true });
    await expect(context).toContainText("v1");
    await f.tracer.updateEntity(
      f.requirement.id,
      f.requirement.version,
      {
        fields: {
          ...f.requirement.fields,
          statement: "A deliberate competing requirement revision",
        },
      },
      1,
      actor,
    );
    const afterChange = await f.tracer.exportProject();
    await workspace.getByRole("button", { name: "Refresh verification", exact: true }).click();
    await expect(
      workspace.getByText(/The selected requirement changed or is unavailable/),
    ).toBeVisible();
    await expect(context).toContainText("v1");
    await expect(
      workspace.getByRole("button", { name: "Reprepare current basis", exact: true }),
    ).toBeDisabled();
    await workspace
      .getByRole("button", { name: "Adopt displayed requirement version", exact: true })
      .click();
    await expect(context).toContainText("v2");
    await expect(context).toContainText("Proposed basis");
    await expect(workspace.getByLabel("Verification title", { exact: true })).toHaveValue(
      "Preserve original proposal",
    );
    await workspace
      .getByRole("button", { name: "Prepare verification basis", exact: true })
      .click();
    await expect(context).toContainText("Prepared basis");
    await expect(context).toContainText("v2");
    expect(await f.tracer.exportProject()).toEqual(afterChange);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

for (const [scope, label] of [
  ["model", "Verification model"],
  ["requirement", "Requirement"],
  ["target", "Verification target configuration"],
] as const)
  test(`${scope} scope changes retain cancelled drafts and clear only confirmed preparation`, async ({
    page,
  }) => {
    const f = await verificationFixture("engineering");
    const target = await f.tracer.configurations.captureExact(
      await verificationTargetInput(f),
      actor,
    );
    const before = await f.tracer.exportProject();
    const server = await startLocalServer(f.tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(server.origin);
      await openProjectDestination(page, "Documentation");
      await page.getByLabel("Documentation topic", { exact: true }).selectOption({ index: 1 });
      expect(await unloadWouldWarn(page)).toBe(false);
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      const panel = await startFromRequirement(page, f.requirement.id);
      const model = panel.getByLabel("Verification model", { exact: true });
      const requirement = panel.getByLabel("Requirement", { exact: true });
      const prepare = panel.getByRole("button", {
        name: "Prepare verification basis",
        exact: true,
      });
      const title = panel.getByLabel("Verification title", { exact: true });
      await title.fill("Keep the explicit proposal");
      await panel
        .getByLabel("Verification purpose", { exact: true })
        .fill("Keep its declared purpose");
      await model.selectOption({ index: 1 });
      await prepare.click();
      const add = panel.getByRole("button", { name: "Use entire acceptance field", exact: true });
      await add.click();
      const assignment = panel.getByLabel("Assign criterion-1 to Declared method", { exact: true });
      await assignment.check();
      const choice = panel.getByLabel(label, { exact: true });
      const previous = await choice.inputValue();
      const next = { model: "", requirement: "", target: target.id }[scope];
      page.once("dialog", (dialog) => dialog.dismiss());
      await choice.selectOption(next);
      await expect(choice).toHaveValue(previous);
      await expect(assignment).toBeChecked();
      await expect(panel.getByLabel("Criterion 1 identity", { exact: true })).toHaveValue(
        "criterion-1",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await choice.selectOption(next);
      await expect(choice).toHaveValue(next);
      await expect(panel.getByLabel("Verification context", { exact: true })).toContainText(
        "Proposed basis",
      );
      await expect(title).toHaveValue("Keep the explicit proposal");
      await expect(panel.getByLabel("Verification purpose", { exact: true })).toHaveValue(
        "Keep its declared purpose",
      );
      await expect(panel.getByLabel("Criterion 1 identity", { exact: true })).toHaveCount(0);
      await model.selectOption({ index: 1 });
      await requirement.selectOption(f.requirement.id);
      await prepare.click();
      await expect(panel.getByLabel("Criterion 1 identity", { exact: true })).toHaveCount(0);
      await add.click();
      await expect(assignment).not.toBeChecked();
      await expect.poll(() => unloadWouldWarn(page)).toBe(true);
      expect(await f.tracer.exportProject()).toEqual(before);
    } finally {
      await closeTestPage(page);
      await server.close();
      f.close();
    }
  });
