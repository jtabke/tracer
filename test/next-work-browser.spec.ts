import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Page, Locator } from "@playwright/test";

const origin = { actor: "next-work browser engineer" };
async function openNextWork(page: Page) {
  await openProjectDestination(page, "Next work");
  const panel = page.getByRole("region", { name: "Next work", exact: true });
  await expect(panel.getByRole("navigation", { name: "Work queues" })).toBeVisible();
  return panel;
}
function queueChoice(panel: Locator, title: string, count: number | string) {
  return panel.getByRole("button", { name: `${title} ${count}`, exact: true });
}
async function connect(panel: Locator, type: string, key: string) {
  if (!(await panel.getByLabel("Connection meaning", { exact: true }).isVisible()))
    await panel.locator("summary").filter({ hasText: "Connect an existing item" }).click();
  await panel.getByLabel("Connection meaning", { exact: true }).selectOption("mapped_to");
  await panel.getByLabel("Target type", { exact: true }).fill(type);
  await panel.getByLabel("Find target", { exact: true }).fill(key);
  await panel.getByRole("button", { name: `Choose target ${key}`, exact: true }).click();
  await panel.getByRole("button", { name: "Connect selected target", exact: true }).click();
}
for (const width of [1440, 680]) {
  test(`separate next-work queues open editing and review actions with persistent results at ${width}px`, async ({
    page,
  }) => {
    const repository = new SQLiteRepository(":memory:");
    const tracer = new Tracer(repository);
    await tracer.setSchema(projectTemplates.engineering.schema, 0, origin);
    const gap = await tracer.createEntity(
      { type: "requirement", key: "REQ-GAP", fields: { title: "Threshold requirement" } },
      1,
      origin,
    );
    const input = await tracer.createEntity(
      {
        type: "requirement",
        key: "REQ-INPUT",
        fields: { title: "Sampling requirement", statement: "Sample every second" },
      },
      1,
      origin,
    );
    const design = await tracer.createEntity(
      { type: "design", key: "DES-1", fields: { title: "Sensor design" } },
      1,
      origin,
    );
    const plan = await tracer.createEntity(
      { type: "test", key: "TEST-1", fields: { title: "SIMULATED monitor test" } },
      1,
      origin,
    );
    for (const target of [design, plan])
      await tracer.createRelationship(
        { type: "mapped_to", source: input.id, target: target.id, fields: {} },
        1,
        origin,
      );
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: plan.id,
        outcome: "SIMULATED pass",
        inputs: [{ entityId: input.id, fields: ["statement"] }],
      },
      origin,
    );
    await tracer.evidence.review(
      {
        receiptId: receipt.id,
        decision: "accepted",
        rationale: "Original review",
        expectedComparison: (await tracer.evidence.compareReceipt(receipt.id)).token,
      },
      origin,
    );
    await tracer.updateEntity(
      input.id,
      1,
      { fields: { title: "Sampling requirement", statement: "Sample twice per second" } },
      1,
      origin,
    );
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      const before = await tracer.exportProject();
      let panel = await openNextWork(page);
      for (const title of [
        "Requirements missing statements",
        "Unallocated requirements",
        "Missing verification plans",
        "Changed evidence inputs",
        "Unresolved reviews",
      ])
        await expect(queueChoice(panel, title, 1)).toBeVisible();
      expect(await tracer.exportProject()).toEqual(before);
      const dialog = page.getByRole("dialog", { name: "Project task", exact: true });
      expect(
        await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/next-work-${width}.png`, fullPage: true });
      await panel.getByRole("button", { name: "Edit item and connections", exact: true }).click();
      await panel.getByRole("button", { name: "Edit statement", exact: true }).click();
      await panel
        .getByLabel("Item statement", { exact: true })
        .fill("Alert above the configured CO₂ threshold");
      await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
      await expect(
        panel.getByRole("button", { name: "Resume item draft", exact: true }),
      ).toBeVisible();
      await panel.getByRole("button", { name: "Resume item draft", exact: true }).click();
      await expect(panel.getByLabel("Item statement", { exact: true })).toHaveValue(
        "Alert above the configured CO₂ threshold",
      );
      await panel.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(async () => (await tracer.getNextWork()).queues.statements.items.length)
        .toBe(0);
      await connect(panel, "design", "DES-1");
      await expect
        .poll(async () => (await tracer.getNextWork()).queues.allocation.items.length)
        .toBe(0);
      await connect(panel, "test", "TEST-1");
      await expect
        .poll(async () => (await tracer.getNextWork()).queues.verification.items.length)
        .toBe(0);
      await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
      await expect(queueChoice(panel, "Requirements missing statements", 0)).toBeVisible();
      await expect(queueChoice(panel, "Unallocated requirements", 0)).toBeVisible();
      await expect(queueChoice(panel, "Missing verification plans", 0)).toBeVisible();
      await queueChoice(panel, "Changed evidence inputs", 1).click();
      await expect(
        panel.getByRole("region", { name: "Changed evidence inputs", exact: true }),
      ).toContainText("Previous accepted decision no longer applies");
      await panel.getByRole("button", { name: "Compare inputs and review", exact: true }).click();
      await panel.getByRole("button", { name: "Review receipt", exact: true }).click();
      await panel.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
      await panel
        .getByLabel("Review rationale", { exact: true })
        .fill("Repeat the simulated rate test");
      await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
      await panel.getByRole("button", { name: "Resume review draft", exact: true }).click();
      await expect(panel.getByLabel("Review rationale", { exact: true })).toHaveValue(
        "Repeat the simulated rate test",
      );
      await panel.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect
        .poll(async () => (await tracer.getNextWork()).queues.reviews.items[0].reviewState)
        .toBe("needs_reevaluation");
      await panel.getByRole("button", { name: "Review receipt", exact: true }).click();
      await panel.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
      await panel
        .getByLabel("Review rationale", { exact: true })
        .fill("Change reviewed; execution follows separately");
      await panel.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect
        .poll(async () => (await tracer.getNextWork()).queues.reviews.items.length)
        .toBe(0);
      await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
      await expect(queueChoice(panel, "Changed evidence inputs", 1)).toBeVisible();
      await expect(queueChoice(panel, "Unresolved reviews", 0)).toBeVisible();
      await page.reload();
      panel = await openNextWork(page);
      await expect(queueChoice(panel, "Changed evidence inputs", 1)).toBeVisible();
      await expect(queueChoice(panel, "Unresolved reviews", 0)).toBeVisible();
      expect((await tracer.evidence.getReceipt(receipt.id)).inputs[0].entity.version).toBe(1);
      expect((await tracer.getEntity(gap.id)).version).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
    }
  });
}

test("390px queues paginate all work, protect item drafts, and replace failed reads with an error instead of zero", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(projectTemplates.engineering.schema, 0, origin);
  for (let index = 0; index < 21; index++)
    await tracer.createEntity(
      {
        type: "requirement",
        key: `REQ-${String(index).padStart(2, "0")}`,
        fields: { title: "Unfinished requirement" },
      },
      1,
      origin,
    );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(server.origin);
    const panel = await openNextWork(page);
    const queue = panel.getByRole("region", {
      name: "Requirements missing statements",
      exact: true,
    });
    await expect(queueChoice(panel, "Requirements missing statements", 21)).toBeVisible();
    await expect(queue.getByRole("listitem")).toHaveCount(10);
    await queue.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(queue.getByRole("listitem")).toHaveCount(10);
    await queue.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(queue.getByRole("listitem")).toHaveCount(1);
    await expect(queue.getByRole("button", { name: "Next page", exact: true })).toBeDisabled();
    await queue.getByRole("button", { name: "Previous page", exact: true }).click();
    const first = queue.getByRole("listitem").first();
    const firstTitle = await first.locator("strong").textContent();
    await first.getByRole("button", { name: "Edit item and connections", exact: true }).click();
    await panel.getByRole("button", { name: "Edit statement", exact: true }).click();
    await panel.getByLabel("Item statement", { exact: true }).fill("Retain my unsaved statement");
    await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
    await queue
      .getByRole("button", { name: "Edit item and connections", exact: true })
      .nth(1)
      .click();
    await expect(panel.getByRole("alert")).toContainText("Your item draft is retained");
    await expect(panel.getByLabel("Item statement", { exact: true })).toHaveValue(
      "Retain my unsaved statement",
    );
    expect(firstTitle).toContain(
      (await panel
        .getByRole("heading", { level: 2 })
        .filter({ visible: true })
        .last()
        .textContent())!,
    );
    await panel.getByRole("button", { name: "Return to next work", exact: true }).click();
    await page.route("**/api/next-work*", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "busy", message: "Queue snapshot unavailable" }),
      }),
    );
    await panel.getByRole("button", { name: "Refresh queues", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Queue snapshot unavailable");
    await expect(panel.getByRole("navigation", { name: "Work queues" })).toHaveCount(0);
    await page.unroute("**/api/next-work*");
    await panel.getByRole("button", { name: "Refresh queues", exact: true }).click();
    await expect(queueChoice(panel, "Requirements missing statements", 21)).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Project task", exact: true });
    expect(
      await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "output/next-work-390.png", fullPage: true });
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});

test("an empty model shows unconfigured queues and offers model setup rather than claiming no gaps", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openNextWork(page);
    await expect(
      queueChoice(panel, "Requirements missing statements", "Not configured"),
    ).toBeVisible();
    await expect(queueChoice(panel, "Unallocated requirements", "Not configured")).toBeVisible();
    await expect(queueChoice(panel, "Unresolved reviews", 0)).toBeVisible();
    await panel.getByRole("button", { name: "Configure model and policies", exact: true }).click();
    await expect(page.locator(".model-page")).toBeVisible();
    await expect(page.locator(".model-page")).toContainText("Configure model");
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    expect((await tracer.getNextWork()).projectRevision).toBe(0);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});

test("custom queue choices use the current model and recover explicitly after a selected policy is removed", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: {
        need: { fields: { description: { type: "string" } } },
        solution: { fields: {} },
      },
      relationshipTypes: { satisfies: { source: ["solution"], target: ["need"], fields: {} } },
      coverageExpectations: {
        allocation: {
          name: "Incoming allocation",
          subject: { type: "need" },
          related: { type: "solution" },
          relationshipType: "satisfies",
          direction: "incoming",
          minimumDistinctTargets: 1,
        },
      },
    },
    0,
    origin,
  );
  await tracer.createEntity({ type: "need", key: "NEED-1", fields: {} }, 1, origin);
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openNextWork(page);
    await expect(queueChoice(panel, "Unallocated requirements", "Not configured")).toBeVisible();
    await panel.getByText("Queue definitions", { exact: true }).click();
    const before = await tracer.exportProject();
    await panel.getByLabel("Next work requirement type", { exact: true }).selectOption("need");
    await panel
      .getByLabel("Next work statement field", { exact: true })
      .selectOption("description");
    await panel
      .getByLabel("Next work allocation policy", { exact: true })
      .selectOption("allocation");
    await expect(queueChoice(panel, "Requirements missing statements", 1)).toBeVisible();
    await queueChoice(panel, "Unallocated requirements", 1).click();
    await expect(
      panel.getByRole("region", { name: "Unallocated requirements", exact: true }),
    ).toContainText("incoming satisfies");
    await expect(queueChoice(panel, "Missing verification plans", "Not configured")).toBeVisible();
    expect(await tracer.exportProject()).toEqual(before);
    await tracer.coverage.set({ expectations: {}, expectedSchemaVersion: 1 }, origin);
    await panel.getByRole("button", { name: "Refresh queues", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Choose a saved coverage policy");
    await panel.getByRole("button", { name: "Use current model defaults", exact: true }).click();
    await expect(queueChoice(panel, "Unallocated requirements", "Not configured")).toBeVisible();
    await expect(panel.getByRole("status")).toContainText("Model v2");
    expect((await tracer.getNextWork()).projectRevision).toBe(before.projectRevision + 1);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
  }
});
