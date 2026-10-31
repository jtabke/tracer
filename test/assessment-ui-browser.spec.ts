import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { applicationModelFixture, assessmentOpenRequest } from "./application-model-fixture.ts";
import { evaluationActor as actor } from "./evaluation-fixture.ts";

async function openTask(page: Page) {
  await openProjectDestination(page, "Change assessments");
  return page.getByRole("region", { name: "Scoped change assessments", exact: true });
}
for (const [domain, width] of [
  ["engineering", 1440],
  ["research", 680],
] as const)
  test(`${domain}: shared assessment UI opens, retains a judgment draft, completes and explicitly reassesses at ${width}px`, async ({
    page,
  }) => {
    const f = await applicationModelFixture(domain),
      server = await startLocalServer(f.tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      await page.locator('[data-action="search"]').click();
      await page.locator("#search").fill(f.criterion.id);
      await page.locator(`[data-result="${f.criterion.id}"]`).click();
      if (width === 680) await page.getByRole("button", { name: "Matrix", exact: true }).click();
      const investigation = await page.locator(".context p").textContent();
      const camera = width === 1440 ? await page.locator(".scene").getAttribute("style") : null;
      const panel = await openTask(page);
      await expect(page.locator("dialog:modal")).toHaveCount(0);
      await expect(page.locator(".sidebar-shell")).toHaveAttribute("data-page", "assessments");
      await panel.getByRole("button", { name: "New assessment", exact: true }).click();
      await panel
        .getByLabel("Assessment application model", { exact: true })
        .selectOption({ index: 1 });
      await panel
        .getByLabel("Assessment title", { exact: true })
        .fill("Assess the changed engineering criterion");
      await panel
        .getByLabel("Assessment purpose", { exact: true })
        .fill("Account for the explicitly selected source and preserve historical conclusions.");
      await panel.getByLabel("Changed record", { exact: true }).selectOption(f.criterion.id);
      await panel.getByLabel("Assessment baseline", { exact: true }).selectOption(f.baseline.id);
      await panel.getByRole("button", { name: "Prepare assessment", exact: true }).click();
      await panel.getByRole("button", { name: "Open assessment", exact: true }).click();
      const detail = panel.getByRole("region", { name: "Assessment detail", exact: true });
      await expect(detail).toContainText("0 of 1 candidates accounted");
      await expect(panel.getByLabel("Completion accounting")).toContainText(
        "Candidates needing a judgment: 1",
      );
      const candidate = () =>
        panel
          .getByRole("list", { name: "Candidate obligations", exact: true })
          .getByRole("button")
          .first();
      await candidate().click();
      await panel
        .getByLabel("Judgment rationale", { exact: true })
        .fill("This specific known candidate requires no revision under the declared scope.");
      await page.getByRole("button", { name: "← Back to investigation", exact: true }).click();
      await expect(page.locator(".context p")).toHaveText(investigation!);
      if (camera) await expect(page.locator(".scene")).toHaveAttribute("style", camera);
      await openTask(page);
      const rationale = panel.getByLabel("Judgment rationale", { exact: true });
      await rationale.focus();
      await page.setViewportSize({ width: width - 20, height: 900 });
      await expect(rationale).toBeFocused();
      await page.setViewportSize({ width, height: 900 });
      await expect(panel.getByLabel("Judgment rationale", { exact: true })).toHaveValue(
        "This specific known candidate requires no revision under the declared scope.",
      );
      await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
      await expect(detail).toContainText("1 of 1 candidates accounted");
      await expect(
        panel.getByRole("form", { name: "Candidate judgment", exact: true }),
      ).toHaveCount(0);
      await panel
        .getByLabel("Assessment operation reason", { exact: true })
        .fill("All selected candidates are explicitly accounted; no release approval is asserted.");
      await panel.getByRole("button", { name: "Complete assessment", exact: true }).click();
      await expect(detail).toContainText("Scope accounted");
      const assessment = (await f.tracer.queryEntities({ type: f.definition.assessment.type }))
        .items[0]!;
      const original = await f.tracer.changeAssessments.locate(assessment.id);
      const closure = await f.tracer.evaluations.getOutcome(original.control.commandId);
      await f.tracer.updateEntity(
        f.criterion.id,
        1,
        { fields: { ...f.criterion.fields, [f.model.threshold]: f.model.value + 1 } },
        2,
        actor,
      );
      await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
      await expect(detail).toContainText("Needs reassessment");
      await panel
        .getByLabel("Assessment operation reason", { exact: true })
        .fill("Reassess the changed criterion while preserving the historical closure.");
      await panel.getByRole("button", { name: "Reopen for reassessment", exact: true }).click();
      await expect(detail).toContainText("Open assessment");
      await candidate().click();
      await panel
        .getByLabel("Judgment rationale", { exact: true })
        .fill(
          "Explicitly reassessed the current criterion; this fixture establishes UI mechanics only.",
        );
      await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
      await expect(detail).toContainText("1 of 1 candidates accounted");
      await panel
        .getByLabel("Assessment operation reason", { exact: true })
        .fill("Complete the reassessed selected scope.");
      await panel.getByRole("button", { name: "Complete assessment", exact: true }).click();
      await expect(detail).toContainText("Scope accounted");
      expect(await f.tracer.evaluations.getOutcome(original.control.commandId)).toEqual(closure);
      expect(
        (
          await f.tracer.changeAssessments.analyze({
            assessmentId: assessment.id,
            openingCommandId: original.opening.commandId,
          })
        ).completion.state,
      ).toBe("completed");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({ path: `output/assessment-ui/${domain}-${width}.png` });
    } finally {
      await closeTestPage(page);
      await server.close();
      f.close();
    }
  });

test("assessment judgment retains its draft through failed analysis and a lost committed response without automatic replay", async ({
  page,
}) => {
  const f = await applicationModelFixture(),
    opening = await assessmentOpenRequest(f);
  await f.tracer.changeAssessments.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openTask(page);
    await panel
      .getByRole("navigation", { name: "Assessment records" })
      .getByRole("button")
      .first()
      .click();
    const candidate = panel
      .getByRole("list", { name: "Candidate obligations" })
      .getByRole("button")
      .first();
    await candidate.click();
    const rationale = panel.getByLabel("Judgment rationale", { exact: true });
    await rationale.fill(
      "Retained exact proposal across an unavailable read and unknown save response.",
    );
    await page.route("**/api/assessment-analysis?*", (route) => route.abort("connectionfailed"));
    await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
    await expect(panel).toContainText("Current obligations could not be checked");
    await expect(rationale).toHaveValue(
      "Retained exact proposal across an unavailable read and unknown save response.",
    );
    await expect(
      panel.getByRole("button", { name: "Save candidate judgment", exact: true }),
    ).toBeDisabled();
    await page.unroute("**/api/assessment-analysis?*");
    await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Save candidate judgment", exact: true }),
    ).toBeEnabled();
    let posts = 0;
    await page.route("**/api/change-assessments/disposition", async (route) => {
      posts++;
      await route.fetch();
      await route.abort("connectionfailed");
    });
    await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await expect(recovery).toBeVisible();
    await expect(rationale).toHaveValue(
      "Retained exact proposal across an unavailable read and unknown save response.",
    );
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery.getByRole("region", { name: "Recorded save results" })).toHaveCount(0);
    await expect(recovery.getByLabel("Recorded save results")).toContainText(
      "Recorded no_action disposition",
    );
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await expect(panel).toContainText("1 of 1 candidates accounted");
    await expect(panel).toContainText("The assessed basis or project changed");
    page.once("dialog", (dialog) => dialog.accept());
    await panel.getByRole("button", { name: "Discard judgment draft", exact: true }).click();
    expect(posts).toBe(1);
    const records = await f.tracer.queryEntities({ type: f.definition.disposition.type });
    expect(records.items).toHaveLength(1);
    expect(records.items[0]!.version).toBe(1);
    await expect(rationale).toHaveValue(
      "Retained exact proposal across an unavailable read and unknown save response.",
    );
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("reverification UI retains the action, captures related current support and accounts for newly discovered results before completion", async ({
  page,
}) => {
  const f = await applicationModelFixture("research"),
    opening = await assessmentOpenRequest(f);
  await f.tracer.changeAssessments.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openTask(page);
    await panel
      .getByRole("navigation", { name: "Assessment records" })
      .getByRole("button")
      .first()
      .click();
    const candidates = () =>
      panel.getByRole("list", { name: "Candidate obligations" }).getByRole("button");
    await candidates().first().click();
    await panel.getByLabel("Candidate decision", { exact: true }).selectOption("reverify");
    await panel
      .getByLabel("Judgment rationale", { exact: true })
      .fill(
        "Repeat the declared analysis and retain the action until a current result is recorded.",
      );
    await panel.getByRole("button", { name: "Add action", exact: true }).click();
    await panel.getByLabel("Action 1 kind", { exact: true }).selectOption("reverify");
    await panel.getByLabel("Action 1 title", { exact: true }).fill("Repeat the specified analysis");
    await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
    await expect(panel).toContainText("1 open actions");
    await expect(panel.getByLabel("Completion accounting")).toContainText("Open actions: 1");
    await expect(
      panel.getByRole("button", { name: "Complete assessment", exact: true }),
    ).toBeDisabled();
    const result = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "SIMULATED current research check; mechanics only",
        inputs: [{ entityId: f.criterion.id, facet: "native", fields: [f.model.threshold] }],
      },
      actor,
    );
    await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
    await expect(panel).toContainText("Discovery: changed");
    await candidates().first().click();
    await expect(panel.getByLabel("Action 1 kind", { exact: true })).toBeDisabled();
    await panel.getByLabel("Action 1 state", { exact: true }).selectOption("done");
    await panel
      .getByLabel("Action 1 resolution", { exact: true })
      .fill("The repeated declared analysis is recorded with exact current inputs.");
    await panel.locator("summary").filter({ hasText: "Action 1 support · 0 selections" }).click();
    await panel.getByLabel("Action 1 support kind", { exact: true }).selectOption("receipt");
    await panel.getByLabel("Action 1 support selection", { exact: true }).selectOption(result.id);
    await panel.getByLabel("Action 1 support use", { exact: true }).selectOption("current");
    await panel.getByRole("button", { name: "Add action 1 support", exact: true }).click();
    await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
    await expect(panel).toContainText("1 of 1 candidates accounted");
    await panel
      .getByLabel("Assessment operation reason", { exact: true })
      .fill("Include the newly recorded evaluation without dropping earlier obligations.");
    await panel.getByRole("button", { name: "Refresh selected scope", exact: true }).click();
    await expect(candidates()).toHaveCount(2);
    await expect(candidates().last()).toContainText(String(f.method.fields.title));
    await candidates().last().click();
    await expect(
      panel.getByRole("region", { name: "Selected candidate context", exact: true }),
    ).toContainText(result.outcome);
    await panel
      .getByLabel("Judgment rationale", { exact: true })
      .fill(
        "Retain this newly captured result as an explicitly accounted candidate; the source action owns the current verification use.",
      );
    await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
    await expect(panel).toContainText("2 of 2 candidates accounted");
    await panel
      .getByLabel("Assessment operation reason", { exact: true })
      .fill("All declared candidates and analysis actions are accounted.");
    await panel.getByRole("button", { name: "Complete assessment", exact: true }).click();
    await expect(panel).toContainText("Scope accounted");
    const view = await f.tracer.changeAssessments.locate(opening.assessmentId);
    expect(
      (
        await f.tracer.changeAssessments.analyze({
          assessmentId: view.assessment.id,
          openingCommandId: view.opening.commandId,
        })
      ).completion.state,
    ).toBe("completed");
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("judgment support picker preserves explicit native, relationship, observed-content and historical-result selections", async ({
  page,
}) => {
  const f = await applicationModelFixture();
  const receipt = await f.tracer.evidence.recordReceipt(
    {
      outputId: f.method.id,
      outcome: "SIMULATED supporting context only",
      inputs: [{ entityId: f.profile.id, facet: "native" }],
    },
    actor,
  );
  const opening = await assessmentOpenRequest(f);
  await f.tracer.changeAssessments.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openTask(page);
    await panel
      .getByRole("navigation", { name: "Assessment records" })
      .getByRole("button")
      .first()
      .click();
    await panel
      .getByRole("list", { name: "Candidate obligations" })
      .getByRole("button")
      .first()
      .click();
    await panel
      .getByLabel("Judgment rationale", { exact: true })
      .fill(
        "Explicitly retain historical context and a current native annotation selection; no external bytes are inferred from native records.",
      );
    await panel.locator("summary").filter({ hasText: "Judgment support · 0 selections" }).click();
    await panel.getByLabel("Judgment support record", { exact: true }).selectOption(f.profile.id);
    await panel.getByLabel("Judgment support use", { exact: true }).selectOption("current");
    await panel.getByRole("button", { name: "Add judgment support", exact: true }).click();
    await panel.getByLabel("Judgment support kind", { exact: true }).selectOption("relationship");
    await panel
      .getByLabel("Judgment support selection", { exact: true })
      .selectOption(f.base.definition.id);
    await panel.getByLabel("Judgment support use", { exact: true }).selectOption("historical");
    await panel.getByRole("button", { name: "Add judgment support", exact: true }).click();
    await panel.getByLabel("Judgment support kind", { exact: true }).selectOption("observation");
    await panel
      .getByLabel("Judgment support selection", { exact: true })
      .selectOption(f.spec.observation.id);
    await panel.getByRole("button", { name: "Add judgment support", exact: true }).click();
    await panel.getByLabel("Judgment support kind", { exact: true }).selectOption("receipt");
    await panel.getByLabel("Judgment support selection", { exact: true }).selectOption(receipt.id);
    await panel.getByRole("button", { name: "Add judgment support", exact: true }).click();
    await panel.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
    await expect(panel).toContainText("1 of 1 candidates accounted");
    const detail = await f.tracer.changeAssessments.disposition(
      { assessmentId: opening.assessmentId, openingCommandId: opening.commandId },
      { kind: "entity", id: f.criterion.id },
    );
    expect(detail?.data.support.map((item) => item.reference)).toEqual([
      { kind: "entity", id: f.profile.id, version: 1, mode: "current" },
      { kind: "relationship", id: f.base.definition.id, version: 1, mode: "historical" },
      { kind: "observation", id: f.spec.observation.id, mode: "historical" },
      { kind: "receipt", id: receipt.id, mode: "historical" },
    ]);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("assessment opening rejects a competing native head, retains the prepared draft and requires explicit adoption", async ({
  page,
}) => {
  const f = await applicationModelFixture(),
    server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await openTask(page);
    await panel.getByRole("button", { name: "New assessment", exact: true }).click();
    await panel
      .getByLabel("Assessment application model", { exact: true })
      .selectOption({ index: 1 });
    await panel
      .getByLabel("Assessment title", { exact: true })
      .fill("Retained competing preparation");
    await panel
      .getByLabel("Assessment purpose", { exact: true })
      .fill("Verify deliberate adoption after a concurrent project edit.");
    await panel.getByLabel("Changed record", { exact: true }).selectOption(f.criterion.id);
    await panel.getByLabel("Assessment baseline", { exact: true }).selectOption(f.baseline.id);
    await panel.getByRole("button", { name: "Prepare assessment", exact: true }).click();
    await f.tracer.updateEntity(
      f.criterion.id,
      1,
      { fields: { ...f.criterion.fields, [f.model.threshold]: f.model.value + 1 } },
      2,
      actor,
    );
    await panel.getByRole("button", { name: "Open assessment", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Change assessments workspace page", exact: true }),
    ).toContainText("Project changed since preview");
    expect(
      (await f.tracer.queryEntities({ type: f.definition.assessment.type })).items,
    ).toHaveLength(0);
    await expect(panel.getByLabel("Assessment title", { exact: true })).toHaveValue(
      "Retained competing preparation",
    );
    await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
    await expect(panel).toContainText("The preparation context changed");
    await expect(
      panel.getByRole("button", { name: "Open assessment", exact: true }),
    ).toBeDisabled();
    await panel.getByRole("button", { name: "Adopt refreshed scope context", exact: true }).click();
    await panel.getByRole("button", { name: "Open assessment", exact: true }).click();
    await expect(
      panel.getByRole("region", { name: "Assessment detail", exact: true }),
    ).toContainText("Retained competing preparation");
    expect(
      (await f.tracer.queryEntities({ type: f.definition.assessment.type })).items,
    ).toHaveLength(1);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("unavailable display names never replace exact assessment scope or expose IDs as primary labels", async ({
  page,
}) => {
  const f = await applicationModelFixture();
  const opening = await assessmentOpenRequest(f);
  await f.tracer.changeAssessments.open(opening, actor);
  const before = await f.tracer.exportProject();
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.route("**/api/baseline?*", (route) => route.abort());
    await page.goto(server.origin);
    const panel = await openTask(page);
    await panel
      .getByRole("navigation", { name: "Assessment records" })
      .getByRole("button")
      .first()
      .click();
    const context = panel.getByRole("region", { name: "Assessment context", exact: true });
    await expect(context).toContainText("Some display names could not be read");
    expect(await context.innerText()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    await context.getByText("Exact identities", { exact: true }).click();
    await expect(context.getByText(`Baseline: ${f.baseline.id}`, { exact: true })).toBeVisible();
    await context.getByText("Exact identities", { exact: true }).click();
    await page.unroute("**/api/baseline?*");
    await panel.getByRole("button", { name: "Refresh assessments", exact: true }).click();
    await expect(context).toContainText(f.baseline.name);
    await expect(context).not.toContainText("Some display names could not be read");
    expect(await f.tracer.exportProject()).toEqual(before);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});
