import { openProjectDestination } from "./project-navigation.ts";
import { Tracer } from "../src/index.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import type { Page, Locator } from "@playwright/test";
import { resolve } from "node:path";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import {
  verificationFixture,
  verificationOpening,
  verificationActor as actor,
} from "./verification-fixture.ts";
async function task(page: Page) {
  await openProjectDestination(page, "Verification");
  return page.getByRole("region", { name: "Requirement verification", exact: true });
}
async function record(
  panel: Locator,
  title: string,
  outcome: "passed" | "failed",
  materialId?: string,
) {
  await panel.getByRole("button", { name: "Record activity", exact: true }).click();
  const form = panel.getByRole("form", { name: "Record verification activity", exact: true });
  await form.getByLabel("Activity title", { exact: true }).fill(title);
  await form.getByLabel("Verification method", { exact: true }).selectOption({ index: 1 });
  await form
    .getByLabel("Execution conditions", { exact: true })
    .fill(
      "Synthetic domain fixture exercises actual production UI and services; no physical or human validation claim.",
    );
  for (const id of ["AC-1", "AC-2"]) {
    await form.getByLabel(`${id} recorded outcome`, { exact: true }).selectOption(outcome);
    await form
      .getByLabel(`${id} actual observations`, { exact: true })
      .fill(`Observed ${outcome} for the explicit fixture obligation.`);
    await form
      .getByLabel(`${id} result rationale`, { exact: true })
      .fill("Retain actual observations separately from current input applicability.");
  }
  if (materialId) {
    await form.getByText("Supporting inputs · 0", { exact: true }).click();
    await form.getByLabel("Supporting record", { exact: true }).selectOption(materialId);
    await form.getByLabel("Supporting field value", { exact: true }).check();
    await form
      .getByLabel("Supporting input purpose", { exact: true })
      .fill("Exact measured design annotation");
    await form.getByRole("button", { name: "Add supporting input", exact: true }).click();
  }
  await form.getByRole("button", { name: "Record activity", exact: true }).click();
  await expect(form).toHaveCount(0);
}
async function selectResults(panel: Locator, methodId: string, selected: string, all: string[]) {
  await panel.getByRole("button", { name: "Choose results", exact: true }).click();
  const form = panel.getByRole("form", { name: "Select verification results", exact: true });
  for (const id of ["AC-1", "AC-2"])
    await form.getByLabel(`Result for ${id} ${methodId}`, { exact: true }).selectOption(selected);
  for (const id of all) {
    if (id !== selected) {
      await form.getByLabel(`Accounting for ${id}`, { exact: true }).selectOption("superseded");
      await form.getByLabel(`Replacement for ${id}`, { exact: true }).selectOption(selected);
    }
    await form
      .getByLabel(`Rationale for ${id}`, { exact: true })
      .fill(
        id === selected
          ? "Use this actual result for the declared current obligations."
          : "Retain the original outcome; the selected activity replaces this exact scope.",
      );
  }
  await form
    .getByLabel("Selection reason", { exact: true })
    .fill("All registered activities explicitly accounted; no failure is erased.");
  await form.getByRole("button", { name: "Save result selection", exact: true }).click();
  await expect(form).toHaveCount(0);
}
async function conclude(panel: Locator) {
  await panel
    .getByLabel("Verification operation reason", { exact: true })
    .fill(
      "Complete declared scope with explicit applicable passing results and complete accounting.",
    );
  await panel.getByRole("button", { name: "Conclude verification", exact: true }).click();
  await expect(panel.getByLabel("Verification status", { exact: true })).toContainText(
    "Verified for this declared scope",
  );
}
for (const [domain, width] of [
  ["engineering", 1440],
  ["research", 680],
] as const)
  test(`${domain}: verification authors explicit bases, retains activity drafts, accounts for failures and reassesses changed support at ${width}px`, async ({
    page,
  }) => {
    const f = await verificationFixture(domain),
      material = await f.tracer.createEntity(
        { type: "@resource", fields: { value: 1 }, resource: { label: "Design measurement" } },
        1,
        actor,
      ),
      server = await startLocalServer(f.tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      const panel = await task(page);
      await panel.getByRole("button", { name: "New verification", exact: true }).click();
      await panel.getByLabel("Verification model", { exact: true }).selectOption({ index: 1 });
      await panel
        .getByLabel("Verification title", { exact: true })
        .fill("Verify the explicit engineering criteria");
      await panel
        .getByLabel("Verification purpose", { exact: true })
        .fill("Preserve actual failure and passing results through a later input change.");
      await panel.getByLabel("Requirement", { exact: true }).selectOption(f.requirement.id);
      await panel.getByRole("button", { name: "Prepare verification basis", exact: true }).click();
      for (const [i, c] of f.input.criteria.entries()) {
        await panel.getByLabel("Acceptance source", { exact: true }).evaluate(
          (element, range) => {
            const input = element as HTMLTextAreaElement;
            input.focus();
            input.setSelectionRange(range.start, range.end - 1);
            input.dispatchEvent(new Event("select", { bubbles: true }));
          },
          { start: c.start, end: c.end },
        );
        await panel.getByLabel("Acceptance source", { exact: true }).press("Shift+ArrowRight");
        await panel.getByRole("button", { name: "Add highlighted criterion", exact: true }).click();
        await panel.getByLabel(`Criterion ${i + 1} identity`, { exact: true }).fill(c.id);
        await panel.getByLabel(`Assign ${c.id} to Declared method`, { exact: true }).check();
      }
      await panel
        .getByLabel("Basis rationale", { exact: true })
        .fill(
          "Two exact source passages cover the complete acceptance fields and each has an explicit method.",
        );
      await panel.getByRole("button", { name: "Open verification", exact: true }).click();
      await expect(panel.getByLabel("Verification status", { exact: true })).toContainText(
        "Open verification",
      );
      await panel.getByRole("button", { name: "Record activity", exact: true }).click();
      await panel
        .getByLabel("Activity title", { exact: true })
        .fill("Retain this draft across map return");
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await task(page);
      await expect(panel.getByLabel("Activity title", { exact: true })).toHaveValue(
        "Retain this draft across map return",
      );
      page.once("dialog", (d) => d.accept());
      await panel.getByRole("button", { name: "Cancel editor", exact: true }).click();
      await record(panel, "Original failing activity", "failed");
      await expect(
        panel.getByRole("button", { name: "Conclude verification", exact: true }),
      ).toBeDisabled();
      await record(panel, "Corrected passing activity", "passed", material.id);
      const caseEntity = (await f.tracer.queryEntities({ type: f.definition.case.type })).items[0]!,
        view = await f.tracer.verification.locate(caseEntity.id),
        s = { caseId: caseEntity.id, openingCommandId: view.opening.commandId },
        ids = view.executions.map((x) => x.executionId);
      await selectResults(panel, f.method.id, ids[1], ids);
      await conclude(panel);
      const first = await f.tracer.verification.analyze(s);
      expect(first.executions[0].results[0].outcome).toBe("failed");
      await f.tracer.updateEntity(material.id, 1, { fields: { value: 2 } }, 1, actor);
      await panel.getByRole("button", { name: "Refresh verification", exact: true }).click();
      await expect(panel.getByLabel("Verification status", { exact: true })).toContainText(
        "Needs reassessment",
      );
      await expect(panel.getByRole("list", { name: "Verification obligations" })).toContainText(
        domain === "research" ? "Outcome: supported" : "Outcome: passed",
      );
      await panel
        .getByLabel("Verification operation reason", { exact: true })
        .fill("Explicitly reopen after a changed recorded design input.");
      await panel.getByRole("button", { name: "Reopen verification", exact: true }).click();
      await expect(panel.getByLabel("Verification status", { exact: true })).toContainText(
        "Open verification",
      );
      await record(panel, "New current activity", "passed", material.id);
      const current = await f.tracer.verification.analyze(s);
      await selectResults(
        panel,
        f.method.id,
        current.executions[2].id,
        current.executions.map((x) => x.id),
      );
      await conclude(panel);
      await page.reload();
      const reopened = await task(page);
      await reopened.getByLabel("Verification case", { exact: true }).selectOption(caseEntity.id);
      await expect(reopened.getByLabel("Verification status", { exact: true })).toContainText(
        "Verified for this declared scope",
      );
      const final = await f.tracer.verification.analyze(s);
      expect(final.executions).toHaveLength(3);
      expect(final.executions[0].results[0].outcome).toBe("failed");
      expect(final.recordedConclusion?.commandId).not.toBe(first.recordedConclusion?.commandId);
      expect(
        await page.locator("dialog[open]").evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
      ).toBe(true);
    } finally {
      await closeTestPage(page);
      await server.close();
      f.close();
    }
  });

test("verification activity retains failed-read drafts and inspects a lost committed response without replay", async ({
  page,
}) => {
  const f = await verificationFixture(),
    opening = await verificationOpening(f);
  await f.tracer.verification.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await task(page);
    await panel.getByLabel("Verification case", { exact: true }).selectOption(opening.caseId);
    await panel.getByRole("button", { name: "Record activity", exact: true }).click();
    const form = panel.getByRole("form", { name: "Record verification activity", exact: true });
    await form.getByLabel("Activity title", { exact: true }).fill("Retained actual activity");
    await form.getByLabel("Verification method", { exact: true }).selectOption(f.method.id);
    await form
      .getByLabel("Execution conditions", { exact: true })
      .fill("Retain this actual proposal through failed reads and outcome inspection.");
    for (const id of ["AC-1", "AC-2"]) {
      await form.getByLabel(`${id} recorded outcome`, { exact: true }).selectOption("passed");
      await form
        .getByLabel(`${id} actual observations`, { exact: true })
        .fill("Explicit fixture result");
      await form
        .getByLabel(`${id} result rationale`, { exact: true })
        .fill("Typed attestation on synthetic data");
    }
    await page.route("**/api/verification-analysis?*", (r) => r.abort("connectionfailed"));
    await panel.getByRole("button", { name: "Refresh verification", exact: true }).click();
    await expect(panel).toContainText("Current verification could not be checked");
    await expect(form.getByLabel("Activity title", { exact: true })).toHaveValue(
      "Retained actual activity",
    );
    await expect(form.getByRole("button", { name: "Record activity", exact: true })).toBeDisabled();
    await page.unroute("**/api/verification-analysis?*");
    await panel.getByRole("button", { name: "Refresh verification", exact: true }).click();
    await expect(form.getByRole("button", { name: "Record activity", exact: true })).toBeEnabled();
    let posts = 0;
    await page.route("**/api/verifications/execute", async (route) => {
      posts++;
      await route.fetch();
      await route.abort("connectionfailed");
    });
    await form.getByRole("button", { name: "Record activity", exact: true }).click();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await expect(recovery).toBeVisible();
    await expect(form.getByLabel("Activity title", { exact: true })).toHaveValue(
      "Retained actual activity",
    );
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery.getByLabel("Recorded save results")).toContainText(
      "verification execution",
    );
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(posts).toBe(1);
    expect((await f.tracer.verification.locate(opening.caseId)).executions).toHaveLength(1);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("verification UI explicitly revises a changed requirement basis and retains prior execution history", async ({
  page,
}) => {
  const f = await verificationFixture(),
    opening = await verificationOpening(f);
  await f.tracer.verification.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await task(page);
    await panel.getByLabel("Verification case", { exact: true }).selectOption(opening.caseId);
    await record(panel, "Initial exact activity", "passed");
    let view = await f.tracer.verification.locate(opening.caseId);
    await selectResults(
      panel,
      f.method.id,
      view.executions[0].executionId,
      view.executions.map((x) => x.executionId),
    );
    await conclude(panel);
    await panel.getByRole("button", { name: "Initial exact activity", exact: true }).click();
    await expect(panel.getByLabel("Recorded activity inspection", { exact: true })).toContainText(
      "Observed passed",
    );
    await f.tracer.updateEntity(
      f.requirement.id,
      1,
      {
        fields: {
          ...f.requirement.fields,
          [f.definition.requirement.fields.statement]:
            "The revised governing statement requires an explicit new execution.",
        },
      },
      1,
      actor,
    );
    await panel.getByRole("button", { name: "Refresh verification", exact: true }).click();
    await expect(panel.getByLabel("Verification status", { exact: true })).toContainText(
      "Needs reassessment",
    );
    await panel
      .getByLabel("Verification operation reason", { exact: true })
      .fill(
        "Retain the original conclusion and explicitly revise the changed governing statement.",
      );
    await panel.getByRole("button", { name: "Reopen verification", exact: true }).click();
    await panel.getByRole("button", { name: "Revise basis", exact: true }).click();
    const form = panel.getByRole("form", { name: "Revise verification basis", exact: true });
    await form.getByRole("button", { name: "Prepare verification basis", exact: true }).click();
    await expect(form).toContainText(
      "The revised governing statement requires an explicit new execution.",
    );
    await form
      .getByLabel("Basis rationale", { exact: true })
      .fill(
        "Explicitly retain both source criterion identities; changed governing statement requires new execution.",
      );
    await form.getByRole("button", { name: "Save revised basis", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Conclude verification", exact: true }),
    ).toBeDisabled();
    await record(panel, "Revised basis activity", "passed");
    view = await f.tracer.verification.locate(opening.caseId);
    await selectResults(
      panel,
      f.method.id,
      view.executions[1].executionId,
      view.executions.map((x) => x.executionId),
    );
    await conclude(panel);
    expect(
      (
        await f.tracer.verification.analyze({
          caseId: opening.caseId,
          openingCommandId: opening.commandId,
        })
      ).view.scope.revisions,
    ).toHaveLength(1);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("verification records an explicit earlier activity interpretation and observed/native/connection inputs", async ({
  page,
}) => {
  const f = await verificationFixture(),
    material = await f.tracer.createEntity(
      {
        type: "@resource",
        fields: { value: 1 },
        resource: {
          label: "External measured specimen",
          source: { system: "file", externalId: "/synthetic/specimen.txt" },
        },
      },
      1,
      actor,
    );
  const observer = new Tracer(f.repository, undefined, async () => ({
    availability: "available",
    hash: "sha256:" + "a".repeat(64),
  }));
  const observation = await observer.evidence.observe(
    { entityId: material.id, locator: { system: "file", path: "/synthetic/specimen.txt" } },
    actor,
  );
  const original = await f.tracer.evidence.recordReceipt(
    {
      outputId: f.method.id,
      outcome: "Original recorded activity; no parsed passing assertion",
      inputs: [
        {
          entityId: f.requirement.id,
          facet: "native",
          revision: 1,
          fields: [
            f.definition.requirement.fields.statement,
            ...f.definition.requirement.fields.acceptance,
          ],
        },
        {
          entityId: f.method.id,
          facet: "native",
          revision: 1,
          fields: [f.definition.method.fields.procedure, f.definition.method.fields.expected],
        },
      ],
    },
    actor,
  );
  const opening = await verificationOpening(f);
  await f.tracer.verification.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.goto(server.origin);
    const panel = await task(page);
    await panel.getByLabel("Verification case", { exact: true }).selectOption(opening.caseId);
    await panel.getByRole("button", { name: "Record activity", exact: true }).click();
    const form = panel.getByRole("form", { name: "Record verification activity", exact: true });
    await form
      .getByLabel("Activity title", { exact: true })
      .fill("Explicit prior activity interpretation");
    await form.getByLabel("Verification method", { exact: true }).selectOption(f.method.id);
    await form.getByLabel("Activity source", { exact: true }).selectOption("prior");
    await form.getByLabel("Original activity selection", { exact: true }).selectOption(original.id);
    await form
      .getByLabel("Original activity interpretation", { exact: true })
      .fill(
        "Explicitly interpret the original native criterion/method inputs; no new engineering test was executed.",
      );
    await form
      .getByLabel("Execution conditions", { exact: true })
      .fill("Synthetic UI attestation of an explicitly blocked prior activity.");
    for (const id of ["AC-1", "AC-2"]) {
      await form.getByLabel(`${id} recorded outcome`, { exact: true }).selectOption("blocked");
      await form
        .getByLabel(`${id} actual observations`, { exact: true })
        .fill("The activity cannot establish a successful criterion result.");
      await form
        .getByLabel(`${id} result rationale`, { exact: true })
        .fill("Retain uncertainty; this is not a passing assertion parsed from prose.");
    }
    await form.getByText("Supporting inputs · 0", { exact: true }).click();
    await form.getByLabel("Supporting input kind", { exact: true }).selectOption("observation");
    await form
      .getByLabel("Verification support selection", { exact: true })
      .selectOption(observation.id);
    await form
      .getByLabel("Supporting input purpose", { exact: true })
      .fill("Exact previously observed external content");
    await form.getByRole("button", { name: "Add supporting input", exact: true }).click();
    await form.getByLabel("Supporting input kind", { exact: true }).selectOption("relationship");
    await form
      .getByLabel("Verification support selection", { exact: true })
      .selectOption(opening.membershipId);
    await form
      .getByLabel("Supporting input purpose", { exact: true })
      .fill("Explicit requirement-to-case association");
    await form.getByRole("button", { name: "Add supporting input", exact: true }).click();
    await form.getByRole("button", { name: "Record activity", exact: true }).click();
    await expect(form).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Explicit prior activity interpretation", exact: true })
      .click();
    await expect(panel.getByLabel("Recorded activity inspection", { exact: true })).toContainText(
      "Earlier activity, explicitly interpreted",
    );
    const view = await f.tracer.verification.locate(opening.caseId),
      detail = await f.tracer.verification.execution(
        { caseId: opening.caseId, openingCommandId: opening.commandId },
        view.executions[0].executionId,
      ),
      receipt = await f.tracer.evidence.getReceipt(detail.receiptId);
    expect(detail.data.source.kind).toBe("prior_receipt");
    expect(receipt.inputs.some((x) => x.observation?.id === observation.id)).toBe(true);
    expect(
      receipt.relationshipInputs?.some((x) => x.relationship.id === opening.membershipId),
    ).toBe(true);
    expect(
      (
        await f.tracer.verification.analyze({
          caseId: opening.caseId,
          openingCommandId: opening.commandId,
        })
      ).ready,
    ).toBe(false);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});

test("verification reuses exact input review, retains its draft and obeys assessed-design policy", async ({
  page,
}) => {
  const f = await verificationFixture("research"),
    material = await f.tracer.createEntity(
      { type: "@resource", fields: { value: 1 }, resource: { label: "Design measurement" } },
      1,
      actor,
    ),
    opening = await verificationOpening(f);
  await f.tracer.verification.open(opening, actor);
  const server = await startLocalServer(f.tracer, resolve("dist"), 0);
  try {
    await page.setViewportSize({ width: 680, height: 900 });
    await page.goto(server.origin);
    const panel = await task(page);
    await panel.getByLabel("Verification case", { exact: true }).selectOption(opening.caseId);
    await record(panel, "Original design activity", "passed", material.id);
    await f.tracer.updateEntity(material.id, 1, { fields: { value: 2 } }, 1, actor);
    await panel.getByRole("button", { name: "Refresh verification", exact: true }).click();
    await panel.getByRole("button", { name: "Original design activity", exact: true }).click();
    await panel
      .getByRole("button", { name: "Compare and review activity inputs", exact: true })
      .click();
    const review = panel.getByRole("region", { name: "Captured result review", exact: true });
    await expect(review).toContainText("Freshness: changed");
    await review.getByRole("button", { name: "Review receipt", exact: true }).click();
    await review.getByLabel("Review decision", { exact: true }).selectOption("accepted");
    await review
      .getByLabel("Review rationale", { exact: true })
      .fill("Synthetic fixture design change is explicitly assessed against the pinned policy.");
    await review
      .getByRole("button", { name: "Return to verification activity", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Record activity", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
    await task(page);
    await panel
      .getByRole("button", { name: "Return to activity input review", exact: true })
      .click();
    await expect(review.getByLabel("Review rationale", { exact: true })).toHaveValue(
      "Synthetic fixture design change is explicitly assessed against the pinned policy.",
    );
    await review.getByRole("button", { name: "Record review decision", exact: true }).click();
    await expect(review).toContainText("Review recorded");
    await review
      .getByRole("button", { name: "Return to verification activity", exact: true })
      .click();
    const view = await f.tracer.verification.locate(opening.caseId),
      id = view.executions[0].executionId;
    await selectResults(panel, f.method.id, id, [id]);
    await expect(panel.getByRole("list", { name: "Verification obligations" })).toContainText(
      "Applicability: assessed",
    );
    await conclude(panel);
    expect(
      (
        await f.tracer.verification.analyze({
          caseId: opening.caseId,
          openingCommandId: opening.commandId,
        })
      ).executions[0].results.every((x) => x.outcome === "passed"),
    ).toBe(true);
    expect(
      await page.locator("dialog[open]").evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
    ).toBe(true);
  } finally {
    await closeTestPage(page);
    await server.close();
    f.close();
  }
});
