import { resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { referenceUseFixture } from "./reference-use-fixture.ts";
import { verificationOpening, verificationActor as actor } from "./verification-fixture.ts";

for (const external of [false, true])
  test(`target authoring retains independent B/C/B ${external ? "content" : "native"} uses and recovers a qualified judgment without replay`, async ({
    page,
  }) => {
    const x = await referenceUseFixture("research", external),
      { f } = x;
    let server;
    try {
      const target = await x.capture();
      const opening = await verificationOpening(f);
      opening.targetConfigurationId = target.id;
      opening.targetPolicy = "target-reference-uses-v2";
      await f.tracer.verification.open(opening, actor);
      const selection = { caseId: opening.caseId, openingCommandId: opening.commandId };
      // A later default does not replace any of the three independently selected uses.
      await x.changeSource();
      server = await startLocalServer(f.tracer, resolve("dist"), 0);
      await page.setViewportSize({ width: external ? 390 : 1440, height: 1000 });
      await page.goto(server.origin);
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page.getByRole("button", { name: "Verification", exact: true }).click();
      const panel = page.getByRole("region", { name: "Requirement verification", exact: true });
      await panel.getByLabel("Verification case", { exact: true }).selectOption(opening.caseId);
      await panel.getByRole("button", { name: "Record activity", exact: true }).click();
      const form = panel.getByRole("form", { name: "Record verification activity", exact: true });
      await form.getByLabel("Activity title", { exact: true }).fill("Independent material uses");
      await form.getByLabel("Verification method", { exact: true }).selectOption(f.method.id);
      await form
        .getByLabel("Execution conditions", { exact: true })
        .fill("Synthetic selected-target fixture; no physical or human validation claim");
      for (const id of ["AC-1", "AC-2"]) {
        await form.getByLabel(`${id} recorded outcome`, { exact: true }).selectOption("passed");
        await form
          .getByLabel(`${id} actual observations`, { exact: true })
          .fill("Observed the explicit fixture obligation");
        await form
          .getByLabel(`${id} result rationale`, { exact: true })
          .fill("Retain selected dependencies separately from original outcome");
      }
      await form.getByText("Supporting inputs · 0", { exact: true }).click();
      for (const index of [0, 1, 2]) {
        await form
          .getByLabel("Supporting input kind", { exact: true })
          .selectOption(external ? "content" : "native");
        await form.getByLabel("Supporting record", { exact: true }).selectOption(x.resource.id);
        await form
          .getByLabel("Supporting contextual reference", { exact: true })
          .selectOption(x.refs[index].id);
        if (!external) {
          await expect(
            form.getByRole("group", {
              name: `Native field scope · v${index === 1 ? 2 : 1}`,
              exact: true,
            }),
          ).toBeVisible();
          await form.getByLabel("Supporting field text", { exact: true }).check();
        }
        await form
          .getByLabel("Supporting input purpose", { exact: true })
          .fill(`Independent use ${index + 1}`);
        await form.getByRole("button", { name: "Add supporting input", exact: true }).click();
      }
      await form.getByRole("button", { name: "Record activity", exact: true }).click();
      await expect(form).toHaveCount(0);
      const view = await f.tracer.verification.get(selection),
        executionId = view.executions[0].executionId;
      const detail = await f.tracer.verification.execution(selection, executionId);
      const receipt = await f.tracer.evidence.getReceipt(detail.receiptId);
      const inputs = receipt.inputs.filter((input) => input.entityId === x.resource.id);
      expect(inputs.map((input) => input.referenceId)).toEqual(
        x.refs.slice(0, 3).map((ref) => ref.id),
      );
      if (external)
        expect(inputs.map((input) => input.observation!.id)).toEqual([x.B!.id, x.C!.id, x.B!.id]);
      else expect(inputs.map((input) => input.entity.version)).toEqual([1, 2, 1]);
      for (const ref of x.refs.slice(0, 3))
        expect(receipt.relationshipInputs!.some((input) => input.relationship.id === ref.id)).toBe(
          true,
        );
      await panel
        .getByRole("list", { name: "Verification activities", exact: true })
        .getByRole("button")
        .click();
      const inspection = panel.getByRole("region", {
        name: "Recorded activity inspection",
        exact: true,
      });
      await expect(
        inspection.getByRole("button", { name: "Compare and review activity inputs", exact: true }),
      ).toHaveCount(0);
      await inspection.getByText(/Target support layer 1/, { exact: false }).click();
      const review = inspection.getByRole("form", {
        name: `Review target support ${detail.receiptId}`,
        exact: true,
      });
      await review
        .getByLabel("Target support rationale", { exact: true })
        .fill("Inspect exact independent selections; preserve passage uncertainty");
      await expect(
        panel.getByRole("button", { name: "Record activity", exact: true }),
      ).toBeDisabled();
      await expect(
        panel
          .getByRole("list", { name: "Verification activities", exact: true })
          .getByRole("button"),
      ).toBeDisabled();
      let posts = 0;
      await page.route("**/api/verifications/review-support", async (route) => {
        posts++;
        await route.fetch();
        await route.abort("connectionfailed");
      });
      await review
        .getByRole("button", { name: "Save target support judgment", exact: true })
        .click();
      const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
      await expect(recovery).toBeVisible();
      await expect(review.getByLabel("Target support rationale", { exact: true })).toHaveValue(
        "Inspect exact independent selections; preserve passage uncertainty",
      );
      await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
      await expect(recovery.getByLabel("Recorded save results")).toContainText(
        "Recorded qualified verification support judgment",
      );
      await recovery
        .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
        .click();
      await expect(review.getByLabel("Target support rationale", { exact: true })).toHaveValue("");
      expect(posts).toBe(1);
      const after = await f.tracer.verification.execution(selection, executionId);
      expect(after.targetSupport!.layers[0].review.decision!.decision).toBe("needs_reevaluation");
      expect(await f.tracer.evidence.getReceipt(detail.receiptId)).toEqual(receipt);
    } finally {
      await closeTestPage(page);
      await server?.close();
      f.close();
    }
  });
