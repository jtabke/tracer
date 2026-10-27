import { mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { evidenceCycleFixture, cycleActor } from "./evidence-cycle-fixture.ts";
for (const width of [1440, 390])
  test(`engineering evidence cycle preserves results, unknowns and historical write locks at ${width}px`, async ({
    page,
  }) => {
    const f = await evidenceCycleFixture(),
      t = f.tracer;
    await t.updateEntity(
      f.requirement.id,
      1,
      { fields: { ...f.requirement.fields, limit_W: 18 } },
      1,
      cycleActor,
    );
    await t.updateEntity(
      f.article.id,
      1,
      { fields: { ...f.article.fields, revision: "B" } },
      1,
      cycleActor,
    );
    const server = await startLocalServer(t, resolve("dist"), 0),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await page.locator(".node").first().waitFor();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("REQ-POWER");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Assess evidence", exact: true }).click();
      await expect(page.getByText(f.receipt.outcome, { exact: true }).first()).toBeVisible();
      const stage = page.getByLabel("Captured result review", { exact: true });
      await expect(
        stage.getByRole("heading", {
          name: "Freshness: changed · Review: unreviewed",
          exact: true,
        }),
      ).toBeVisible();
      await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
      await stage.getByLabel("Review decision", { exact: true }).selectOption("accepted");
      await stage
        .getByLabel("Review rationale", { exact: true })
        .fill(
          "SIMULATED acceptance of the explained historical scope; current inputs remain changed.",
        );
      await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect(
        stage.getByRole("heading", { name: "Freshness: changed · Review: accepted", exact: true }),
      ).toBeVisible();
      expect(await t.evidence.getReceipt(f.receipt.id)).toEqual(f.receipt);
      unlinkSync(f.definitionFile);
      await t.evidence.observe(
        { entityId: f.definition.id, locator: { system: "file", path: f.definitionFile } },
        cycleActor,
      );
      await page.getByRole("button", { name: "Refresh evidence", exact: true }).click();
      await expect(
        stage.getByRole("heading", {
          name: "Freshness: unknown · Review: unreviewed",
          exact: true,
        }),
      ).toBeVisible();
      await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
      await stage.getByLabel("Review decision", { exact: true }).selectOption("accepted");
      await stage
        .getByLabel("Review rationale", { exact: true })
        .fill("Unknown source state cannot be accepted.");
      await expect(
        stage.getByRole("button", { name: "Record review decision", exact: true }),
      ).toBeDisabled();
      await expect(stage.getByText(/An unknown input cannot be accepted/)).toBeVisible();
      await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
      await stage
        .getByLabel("Review rationale", { exact: true })
        .fill(
          "SIMULATED: changed article/criterion and unavailable definition require reassessment.",
        );
      await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect(
        stage.getByRole("heading", {
          name: "Freshness: unknown · Review: needs_reevaluation",
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
      await expect(page.getByText(f.receipt.outcome, { exact: true }).first()).toBeVisible();
      await expect(
        stage.getByRole("heading", {
          name: "Freshness: unknown · Review: needs_reevaluation",
          exact: true,
        }),
      ).toBeVisible();
      expect(await t.evidence.getReceipt(f.receipt.id)).toEqual(f.receipt);
      expect((await t.getEntity(f.requirement.id)).fields.verificationStatus).toBe("not_verified");
      mkdirSync(resolve("output/evidence-cycle"), { recursive: true });
      await page.screenshot({ path: resolve(`output/evidence-cycle/review-${width}.png`) });
      await page
        .getByRole("button", { name: /^Back to (graph|matrix|history|investigation)/ })
        .first()
        .click();
      const beforeHistory = await t.exportProject(),
        head = (await t.timeline()).head;
      for (let revision = head; revision > f.baseline.projectRevision; revision--) {
        await page.getByRole("slider", { name: "Project revision", exact: true }).focus();
        await page.keyboard.press("ArrowLeft");
        await expect(
          page.getByText(`Viewing revision ${revision - 1} · Read only`, { exact: true }),
        ).toBeVisible();
      }
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await expect(page.getByRole("button", { name: "Edit artifact", exact: true })).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Add relationship", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Model", exact: true }).click();
      const model = page.locator(".model-page");
      await expect(model.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
      expect(await t.exportProject()).toEqual(beforeHistory);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      f.close();
    }
  });
