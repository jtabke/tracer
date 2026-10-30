import { openProjectDestination } from "./project-navigation.ts";
import { resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { pairVerificationFixture } from "./pair-verification-fixture.ts";
import { verificationActor as actor, verificationTargetInput } from "./verification-fixture.ts";

for (const [domain, width] of [
  ["engineering", 1440],
  ["research", 390],
] as const)
  test(`${domain}: displayed pair opens an assessment and verifies its exact after target despite later head drift at ${width}px`, async ({
    page,
  }) => {
    const x = await pairVerificationFixture(domain),
      { f } = x;
    let server;
    try {
      const statement = f.definition.requirement.fields.statement;
      const original = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: "Original failed check remains failed",
          inputs: [{ entityId: f.requirement.id, fields: [statement] }],
          relationshipInputs: [],
        },
        actor,
      );
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [statement]: "Selected after configuration statement",
          },
        },
        2,
        actor,
      );
      const input = await verificationTargetInput(f);
      input.name = "Selected after candidate";
      input.expectedSubjectVersion = 2;
      input.members.find((m) => m.entityId === f.requirement.id)!.version = 2;
      const after = await f.tracer.configurations.captureExact(input, actor);
      await f.tracer.updateEntity(
        f.requirement.id,
        2,
        {
          fields: {
            ...f.requirement.fields,
            [statement]: "Later live head is not the selected target",
          },
        },
        2,
        actor,
      );
      server = await startLocalServer(f.tracer, resolve("dist"), 0);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await openProjectDestination(page, "Configurations");
      const configs = page.getByRole("region", { name: "Project configurations", exact: true });
      await configs.getByRole("button", { name: "Compare configurations", exact: true }).click();
      const comparison = configs.getByRole("region", {
        name: "Compare configuration task",
        exact: true,
      });
      await comparison
        .getByLabel("Before configuration", { exact: true })
        .selectOption(x.before.id);
      await comparison.getByLabel("After configuration", { exact: true }).selectOption(after.id);
      await comparison.getByRole("button", { name: "Compare selected pair", exact: true }).click();
      await comparison
        .getByLabel("Investigation root", { exact: true })
        .selectOption(f.requirement.id);
      // Unapplied picker changes must not silently change the displayed investigation pair.
      await comparison.getByLabel("After configuration", { exact: true }).selectOption(x.after.id);
      await comparison.getByRole("button", { name: "Assess displayed pair", exact: true }).click();
      const assessments = page.getByRole("region", {
        name: "Scoped change assessments",
        exact: true,
      });
      await expect(
        assessments.getByRole("region", { name: "Incoming configuration investigation" }),
      ).toContainText(after.id);
      await assessments
        .getByRole("button", { name: "Start assessment for displayed pair", exact: true })
        .click();
      await assessments
        .getByLabel("Assessment application model", { exact: true })
        .selectOption({ index: 1 });
      await assessments
        .getByLabel("Assessment title", { exact: true })
        .fill("Investigate selected candidate");
      await assessments
        .getByLabel("Assessment purpose", { exact: true })
        .fill("Retain exact pair identity through controlled follow-through");
      await assessments.getByRole("button", { name: "Prepare assessment", exact: true }).click();
      let openingPosts = 0;
      if (domain === "research")
        await page.route("**/api/change-assessments/open", async (route) => {
          openingPosts++;
          await route.fetch();
          await route.abort("connectionfailed");
        });
      await assessments.getByRole("button", { name: "Open assessment", exact: true }).click();
      if (domain === "research") {
        const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
        await expect(recovery).toBeVisible();
        await expect(assessments.getByLabel("Assessment title", { exact: true })).toHaveValue(
          "Investigate selected candidate",
        );
        await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
        await expect(recovery.getByLabel("Recorded save results")).toContainText("assessment");
        await recovery
          .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
          .click();
        expect(openingPosts).toBe(1);
      }
      const detail = assessments.getByRole("region", { name: "Assessment detail", exact: true });
      await expect(detail).toBeVisible();
      const candidate = detail.getByRole("list", { name: "Candidate obligations", exact: true });
      await expect(candidate.getByRole("button", { name: /^Record ·/ })).toHaveCount(1);
      await expect(
        candidate.getByRole("button", {
          name: new RegExp(
            `^Evaluation · ${original.id.slice(0, 8)} · Original failed check remains failed`,
          ),
        }),
      ).toHaveCount(1);
      await candidate.getByRole("button").last().click();
      await expect(detail).toContainText("Recorded outcome: Original failed check remains failed");
      await expect(detail).toContainText("selected after native v2");
      await detail.getByText("Original captured evaluation", { exact: true }).click();
      await expect(detail).toContainText(original.id);
      await candidate.getByRole("button").first().click();
      const judgment = detail.getByRole("form", { name: "Candidate judgment", exact: true });
      await judgment
        .getByLabel("Judgment rationale", { exact: true })
        .fill("Retain this pending engineering judgment across verification");
      await detail.getByRole("button", { name: "Verify after configuration", exact: true }).click();
      await expect(page.locator(".verification-return-context")).toContainText("opened r");
      const verification = page.getByRole("region", {
        name: "Requirement verification",
        exact: true,
      });
      let releaseTarget!: () => void;
      const targetGate = new Promise<void>((resolve) => {
        releaseTarget = resolve;
      });
      let targetHeld = false;
      await page.route("**/api/configuration?*", async (route) => {
        if (!targetHeld && new URL(route.request().url()).searchParams.get("id") === after.id) {
          targetHeld = true;
          await targetGate;
        }
        await route.continue();
      });
      await verification
        .getByRole("button", { name: "Start verification for after configuration", exact: true })
        .click();
      await expect(verification).toContainText("Reading model and method connections");
      await expect(verification).not.toContainText(
        "No verification model definitions are installed",
      );
      releaseTarget();
      await expect(
        verification.getByLabel("Verification model", { exact: true }).locator("option"),
      ).toHaveCount(2);
      await verification
        .getByLabel("Verification target configuration", { exact: true })
        .selectOption(x.before.id);
      await expect(
        verification.getByLabel("Verification target configuration", { exact: true }),
      ).toHaveValue(x.before.id);
      await verification
        .getByLabel("Verification target configuration", { exact: true })
        .selectOption(after.id);
      await verification
        .getByLabel("Verification model", { exact: true })
        .selectOption({ index: 1 });
      await verification
        .getByLabel("Verification title", { exact: true })
        .fill("Verify selected after configuration");
      await verification
        .getByLabel("Verification purpose", { exact: true })
        .fill("Exercise selected history independently of later head changes");
      await verification.getByLabel("Requirement", { exact: true }).selectOption(f.requirement.id);
      await verification
        .getByRole("button", { name: "Prepare verification basis", exact: true })
        .click();
      await expect(verification).toContainText("Selected after configuration statement");
      await expect(verification).not.toContainText("Later live head is not the selected target");
      await verification
        .getByRole("button", { name: "Use entire acceptance field", exact: true })
        .click();
      await verification
        .getByLabel("Assign criterion-1 to Declared method", { exact: true })
        .check();
      await verification
        .getByLabel("Basis rationale", { exact: true })
        .fill("Complete selected acceptance field and explicit captured method mapping");
      await verification.getByRole("button", { name: "Open verification", exact: true }).click();
      await expect(verification.getByLabel("Verification status", { exact: true })).toContainText(
        "Open verification",
      );
      await verification.getByRole("button", { name: "Record activity", exact: true }).click();
      const activity = verification.getByRole("form", {
        name: "Record verification activity",
        exact: true,
      });
      await activity
        .getByLabel("Activity title", { exact: true })
        .fill("Selected target passing activity");
      await activity.getByLabel("Verification method", { exact: true }).selectOption(f.method.id);
      await activity
        .getByLabel("Execution conditions", { exact: true })
        .fill("Synthetic fixture, exact after target; no physical or participant validation claim");
      await activity
        .getByLabel("criterion-1 recorded outcome", { exact: true })
        .selectOption("passed");
      await activity
        .getByLabel("criterion-1 actual observations", { exact: true })
        .fill("Observed the declared complete fixture acceptance scope");
      await activity
        .getByLabel("criterion-1 result rationale", { exact: true })
        .fill("Explicit observation supports the selected target obligation");
      await activity.getByRole("button", { name: "Record activity", exact: true }).click();
      await expect(activity).toHaveCount(0);
      const caseEntity = (await f.tracer.queryEntities({ type: f.definition.case.type })).items[0]!;
      const view = await f.tracer.verification.locate(caseEntity.id);
      const executionId = view.executions[0].executionId;
      await verification.getByRole("button", { name: "Choose results", exact: true }).click();
      const results = verification.getByRole("form", {
        name: "Select verification results",
        exact: true,
      });
      await results
        .getByLabel(`Result for criterion-1 ${f.method.id}`, { exact: true })
        .selectOption(executionId);
      await results
        .getByLabel(`Rationale for ${executionId}`, { exact: true })
        .fill("Use the activity recorded for this exact target and scope");
      await results
        .getByLabel("Selection reason", { exact: true })
        .fill("Account for all recorded activities without rewriting outcomes");
      await results.getByRole("button", { name: "Save result selection", exact: true }).click();
      await expect(results).toHaveCount(0);
      await verification
        .getByLabel("Verification operation reason", { exact: true })
        .fill("Conclude complete applicable results for the exact after target");
      await verification
        .getByRole("button", { name: "Conclude verification", exact: true })
        .click();
      await expect(verification.getByLabel("Verification status", { exact: true })).toContainText(
        "Verified for this declared scope",
      );
      const analysis = await f.tracer.verification.analyze({
        caseId: caseEntity.id,
        openingCommandId: view.opening.commandId,
      });
      expect(analysis.view.scope.target?.configurationId).toBe(after.id);
      expect(analysis.view.scope.basis.requirement.version).toBe(2);
      expect((await f.tracer.getEntity(f.requirement.id))?.version).toBe(3);
      await verification
        .getByRole("button", { name: "Return to change assessments", exact: true })
        .click();
      await expect(judgment.getByLabel("Judgment rationale", { exact: true })).toHaveValue(
        "Retain this pending engineering judgment across verification",
      );
      await judgment
        .getByRole("button", { name: "Adopt current assessed basis", exact: true })
        .click();
      await judgment.getByLabel("Candidate decision", { exact: true }).selectOption("reverify");
      await judgment.getByRole("button", { name: "Add action", exact: true }).click();
      await judgment.getByLabel("Action 1 kind", { exact: true }).selectOption("reverify");
      await judgment
        .getByLabel("Action 1 title", { exact: true })
        .fill("Verify exact after target");
      await judgment.getByLabel("Action 1 state", { exact: true }).selectOption("done");
      await judgment
        .getByLabel("Action 1 resolution", { exact: true })
        .fill("Complete controlled conclusion for the exact selected after configuration");
      const conclusion = await f.tracer.evaluations.getOutcome(
        analysis.recordedConclusion!.commandId,
      );
      await judgment.getByText("Action 1 support · 0 selections", { exact: true }).click();
      await judgment
        .getByLabel("Action 1 support target conclusion selection", { exact: true })
        .selectOption(conclusion!.receipt.id);
      await judgment
        .getByRole("button", { name: "Add action 1 support target conclusion", exact: true })
        .click();
      await judgment.getByRole("button", { name: "Save candidate judgment", exact: true }).click();
      await expect(judgment).toHaveCount(0);
      await expect(candidate).toContainText("0 open actions");
      expect(await f.tracer.configurations.get(after.id)).toEqual(after);
      expect(await f.tracer.configurations.get(x.before.id)).toEqual(x.before);
    } finally {
      await closeTestPage(page);
      await server?.close();
      f.close();
    }
  });
