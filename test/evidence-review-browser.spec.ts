import { test as base, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Entity, Schema } from "../src/core/model.ts";
import type { Receipt } from "../src/core/evidence.ts";
import { openNativeTask as openView, refreshNativeTask } from "./project-navigation.ts";

const origin = { actor: "focused-evidence-test" };
const schema: Schema = {
  entityTypes: {
    requirement: {
      fields: {
        title: { type: "string" },
        statement: { type: "string" },
        nested: { type: "json" },
      },
    },
    result: { fields: { title: { type: "string" } } },
  },
  relationshipTypes: {},
};
const test = base.extend<{
  fixture: { tracer: Tracer; origin: string; inputs: Entity[]; receipt: Receipt; other: Receipt };
}>({
  fixture: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-evidence-stage-"));
    const repo = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repo);
    await tracer.setSchema(schema, 0, origin);
    const inputs: Entity[] = [];
    for (const key of ["CHANGED", "MATCHING", "UNKNOWN"])
      inputs.push(
        await tracer.createEntity(
          {
            type: "requirement",
            key,
            fields: {
              title: `${key} input`,
              statement: `${key} captured criterion`,
              nested: { preserved: key },
            },
          },
          1,
          origin,
        ),
      );
    const output = await tracer.createEntity(
      { type: "result", key: "RESULT", fields: { title: "Recorded result" } },
      1,
      origin,
    );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Recorded fail — remains independent of freshness",
        inputs: inputs.map((input) => ({ entityId: input.id })),
      },
      origin,
    );
    const other = await tracer.evidence.recordReceipt(
      {
        outputId: output.id,
        outcome: "Another exact receipt",
        inputs: [{ entityId: inputs[1].id }],
      },
      origin,
    );
    await tracer.updateEntity(
      inputs[0].id,
      1,
      { fields: { ...inputs[0].fields, statement: "CHANGED current criterion" } },
      1,
      origin,
    );
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    try {
      await use({ tracer, origin: server.origin, inputs, receipt, other });
    } finally {
      await server.close();
      repo.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function openReceipt(page: import("@playwright/test").Page, receiptId: string) {
  await openView(page, "Evidence");
  await page.getByLabel("Evaluation receipt", { exact: true }).selectOption(receiptId);
  const stage = page.getByLabel("Captured result review", { exact: true });
  await expect(stage.getByRole("button", { name: "Review receipt", exact: true })).toBeEnabled();
  return stage;
}

test("complete focused evidence, narrow order, retained draft and native comparison drift", async ({
  page,
  fixture,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(fixture.origin);
  const stage = await openReceipt(page, fixture.receipt.id);
  await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
    fixture.receipt.outcome,
  );
  await expect(
    stage.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
  ).toHaveCount(3);
  const selected = stage.getByLabel("Selected input comparison", { exact: true });
  await expect(selected).toContainText("CHANGED captured criterion");
  await expect(selected).toContainText("CHANGED current criterion");
  await page.screenshot({
    path: join(tmpdir(), "tracer-native-evidence-1024.png"),
    fullPage: true,
  });
  await stage.getByRole("button", { name: "Compare input MATCHING", exact: true }).click();
  await expect(selected.getByLabel("Selected input MATCHING", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const list = stage.getByLabel("Complete declared inputs", { exact: true });
  await expect(list.getByRole("button")).toHaveCount(3);
  const diffBox = (await selected.boundingBox())!,
    listBox = (await list.boundingBox())!,
    actionBox = (await stage
      .getByRole("button", { name: "Review receipt", exact: true })
      .boundingBox())!;
  expect(diffBox.y + diffBox.height).toBeLessThanOrEqual(listBox.y);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(actionBox.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: join(tmpdir(), "tracer-native-evidence-390.png"), fullPage: true });
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Keep this receipt's original outcome; assess the exact declared input change.");
  await expect(list.getByRole("button")).toHaveCount(3);
  await stage.getByRole("button", { name: /Return to recorded evaluations/ }).click();
  await expect(stage).toBeHidden();
  await page.getByRole("button", { name: "Return to review draft", exact: true }).click();
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
    "Keep this receipt's original outcome; assess the exact declared input change.",
  );
  const latest = (await fixture.tracer.queryEntities({ search: "CHANGED" })).items[0];
  await fixture.tracer.updateEntity(
    latest.id,
    latest.version,
    { fields: { ...latest.fields, statement: "Changed again after review capture" } },
    1,
    origin,
  );
  await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
    "Keep this receipt's original outcome; assess the exact declared input change.",
  );
  expect((await fixture.tracer.evidence.list("review")).items).toHaveLength(0);
  await refreshNativeTask(page, "Evidence");
  await expect(stage.getByText(/Review inputs changed\. Draft retained/)).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeDisabled();
  await stage.getByRole("button", { name: "Adopt refreshed review inputs", exact: true }).click();
  await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(
    stage.getByRole("heading", { name: "Freshness: changed · Review: acknowledged", exact: true }),
  ).toBeVisible();
  expect(await fixture.tracer.evidence.getReceipt(fixture.receipt.id)).toEqual(fixture.receipt);
});

test("unknown inputs and failed comparison retain capture while pausing acceptance and all writes", async ({
  page,
  fixture,
}) => {
  await fixture.tracer.removeEntity(fixture.inputs[2].id, 1, 1, origin);
  await page.goto(fixture.origin);
  const stage = await openReceipt(page, fixture.receipt.id);
  await expect(
    stage.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
  ).toHaveCount(3);
  await stage.getByRole("button", { name: "Compare input UNKNOWN", exact: true }).click();
  await expect(stage.getByLabel("Selected input comparison", { exact: true })).toContainText(
    "UNKNOWN captured criterion",
  );
  await expect(stage.getByLabel("Selected input comparison", { exact: true })).toContainText(
    "Current input could not be read",
  );
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Retain rationale and do not accept unknown input content.");
  await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue("");
  await stage.getByLabel("Review decision", { exact: true }).selectOption("accepted");
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeDisabled();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/comparison?*", (route) => route.abort());
  await refreshNativeTask(page, "Evidence");
  await expect(stage.getByText(/Receipt comparison could not be established/)).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeDisabled();
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
    "Retain rationale and do not accept unknown input content.",
  );
  await expect(
    stage.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
  ).toHaveCount(3);
  await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
    fixture.receipt.outcome,
  );
  await page.unroute("**/api/comparison?*");
  await refreshNativeTask(page, "Evidence");
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeEnabled();
  await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(
    stage.getByRole("heading", {
      name: "Freshness: unknown · Review: needs_reevaluation",
      exact: true,
    }),
  ).toBeVisible();
  expect(await fixture.tracer.evidence.getReceipt(fixture.receipt.id)).toEqual(fixture.receipt);
});

test("receipt switching requires deliberate discard and uncertain review writes never replay", async ({
  page,
  fixture,
}) => {
  await page.goto(fixture.origin);
  const stage = await openReceipt(page, fixture.receipt.id);
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Receipt-specific rationale must not transfer.");
  await stage.getByRole("button", { name: /Return to recorded evaluations/ }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Evaluation receipt", { exact: true }).selectOption(fixture.other.id);
  await expect(stage).toBeHidden();
  await page.getByRole("button", { name: "Return to review draft", exact: true }).click();
  await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
    fixture.receipt.outcome,
  );
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
    "Receipt-specific rationale must not transfer.",
  );
  await stage.getByRole("button", { name: /Return to recorded evaluations/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Evaluation receipt", { exact: true }).selectOption(fixture.other.id);
  await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
    fixture.other.outcome,
  );
  await expect(
    stage.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
  ).toHaveCount(1);
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveCount(0);
  await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
  await stage
    .getByLabel("Review rationale", { exact: true })
    .fill("Retain the attempted review after an uncertain transport outcome.");
  await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue("");
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeDisabled();
  await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
  let attempts = 0;
  await page.route("**/api/reviews", async (route) => {
    attempts++;
    await route.abort();
  });
  await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Save not confirmed" })).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Record review decision", exact: true }),
  ).toBeDisabled();
  await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
    "Retain the attempted review after an uncertain transport outcome.",
  );
  await stage.getByRole("button", { name: /Return to recorded evaluations/ }).click();
  await page.getByRole("button", { name: "Return to review draft", exact: true }).click();
  expect(attempts).toBe(1);
  expect((await fixture.tracer.evidence.list("review")).items).toHaveLength(0);
  expect(await fixture.tracer.evidence.getReceipt(fixture.other.id)).toEqual(fixture.other);
});

for (const width of [1440, 390])
  test(`exact off-page configuration reading returns to the same explicit review draft at ${width}px`, async ({
    page,
    fixture,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const input = {
      name: "Repeated configuration name",
      subjectId: fixture.receipt.output.id,
      expectedSubjectVersion: 1,
      members: fixture.inputs.map((entity) => ({ entityId: entity.id, version: 1 })),
    };
    for (let index = 0; index < 26; index++)
      await fixture.tracer.configurations.capture(input, origin);
    const configuration = await fixture.tracer.configurations.capture(input, origin);
    expect(
      (await fixture.tracer.configurations.list({ limit: 25 })).items.some(
        (capture) => capture.id === configuration.id,
      ),
    ).toBe(false);
    const receipt = await fixture.tracer.evidence.recordReceipt(
      {
        outputId: fixture.receipt.output.id,
        outcome: "Pinned outcome remains independent of review",
        configurationId: configuration.id,
        inputs: [{ entityId: fixture.inputs[0].id }],
      },
      origin,
    );
    const history = await fixture.tracer.history();
    await page.goto(fixture.origin);
    const stage = await openReceipt(page, receipt.id);
    await expect(
      stage.getByLabel("Complete declared inputs", { exact: true }).getByRole("button"),
    ).toHaveCount(1);
    await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
    await stage
      .getByLabel("Review rationale", { exact: true })
      .fill("Keep this exact result and selected input while inspecting all pinned members.");
    await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue("");
    await expect(
      stage.getByRole("button", { name: "Record review decision", exact: true }),
    ).toBeDisabled();
    await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
    await expect(
      stage.getByRole("button", { name: "Record review decision", exact: true }),
    ).toBeEnabled();
    const exact = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/configuration" && url.searchParams.get("id") === configuration.id
      );
    });
    await stage
      .getByRole("button", {
        name: `Open recorded configuration: ${configuration.name}`,
        exact: true,
      })
      .click();
    expect(await (await exact).json()).toEqual(configuration);
    const capture = page.getByRole("article", { name: "Pinned configuration", exact: true });
    await expect(
      capture.getByLabel("Complete pinned members", { exact: true }).getByRole("button"),
    ).toHaveCount(3);
    await expect(capture.getByLabel("Selected pinned member", { exact: true })).toContainText(
      "CHANGED · pinned v1",
    );
    await expect(capture.getByLabel("Selected pinned member", { exact: true })).toContainText(
      "CHANGED captured criterion",
    );
    await capture.getByText("Capture identity and provenance", { exact: true }).click();
    await expect(capture).toContainText(configuration.id);
    await page.screenshot({
      path: `/tmp/tracer-result-exact-configuration-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Return to recorded result", exact: true }).click();
    await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
      receipt.outcome,
    );
    await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue(
      "needs_reevaluation",
    );
    await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(
      "Keep this exact result and selected input while inspecting all pinned members.",
    );
    await expect(stage.getByLabel("Selected input comparison", { exact: true })).toContainText(
      "CHANGED",
    );
    await stage
      .getByRole("button", {
        name: `Open recorded configuration: ${configuration.name}`,
        exact: true,
      })
      .click();
    await expect(capture).toBeVisible();
    await capture
      .getByRole("button", { name: "Inspect pinned member UNKNOWN v1", exact: true })
      .click();
    await expect(capture.getByLabel("Selected pinned member", { exact: true })).toContainText(
      "UNKNOWN captured criterion",
    );
    await page.route("**/api/configuration?**", (route) => route.abort());
    await refreshNativeTask(page, "Configurations");
    await expect(
      page.getByText("Previously read capture retained.", { exact: true }),
    ).toBeVisible();
    await expect(capture.getByLabel("Selected pinned member", { exact: true })).toContainText(
      "UNKNOWN captured criterion",
    );
    await page.unroute("**/api/configuration?**");
    await page.getByRole("button", { name: "Return to recorded result", exact: true }).click();
    await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue(
      "needs_reevaluation",
    );
    expect(await fixture.tracer.evidence.getReceipt(receipt.id)).toEqual(receipt);
    expect((await fixture.tracer.evidence.list("review")).items).toHaveLength(0);
    expect(await fixture.tracer.history()).toEqual(history);
  });
