import { openProjectDestination } from "./project-navigation.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

async function projectTask(page: Page, name: string) {
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill(name);
  await page.getByRole("option", { name, exact: true }).click();
  return page.locator(".native-task:visible");
}

for (const width of [1440, 680])
  test(`normal launch completes a fresh workflow and recovers investigation at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-main-workflow-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    try {
      await page.goto(server.origin);
      await expect(page.getByRole("heading", { name: "Define your project model" })).toBeVisible();
      await page.setViewportSize({ width, height: 1000 });
      const task = await projectTask(page, "Model");
      await task.getByRole("button", { name: "Text", exact: true }).click();
      await task.getByLabel("Advanced JSON", { exact: true }).check();
      await task.getByLabel("Project schema JSON", { exact: true }).fill(
        JSON.stringify({
          entityTypes: {
            item: {
              fields: {
                title: { type: "string", required: true },
                statement: { type: "string", required: true },
              },
            },
          },
          relationshipTypes: {
            depends_on: {
              source: ["item"],
              target: ["item"],
              fields: { scope: { type: "string" } },
            },
          },
        }),
      );
      await task.getByRole("button", { name: "Save model", exact: true }).click();
      await expect.poll(async () => (await tracer.getSchema())?.version).toBe(1);
      await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await projectTask(page, "Create record");
      for (const [key, title, statement] of [
        ["REQ", "Response criterion", "Response within 10 ms"],
        ["RUN", "Response evaluation", "Bench evaluation"],
      ]) {
        await task.getByLabel("New record key", { exact: true }).fill(key);
        await task.getByLabel("New record title", { exact: true }).fill(title);
        await task.getByLabel("New record statement", { exact: true }).fill(statement);
        await task.getByRole("button", { name: "Create record", exact: true }).click();
        await expect(task.getByLabel("New record key", { exact: true })).toHaveValue("");
      }
      await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Search", exact: false }).first().click();
      await page.locator("#search").fill("REQ");
      await page.locator('[data-result="REQ"]').click();
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.getByRole("button", { name: "Add relationship", exact: true }).click();
      await page.locator("#connection-target").fill("RUN");
      await page.locator("#connection-type").selectOption("depends_on");
      await page.locator('#connection-form button[type="submit"]').click();
      await expect.poll(async () => (await tracer.queryRelationships({})).items.length).toBe(1);
      const input = (await tracer.queryEntities({ key: "REQ" })).items[0];
      const output = (await tracer.queryEntities({ key: "RUN" })).items[0];
      await projectTask(page, "Evaluation records");
      await task.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
      await task.getByLabel("Output or conclusion", { exact: true }).selectOption(output.id);
      await task
        .getByLabel("Outcome", { exact: true })
        .fill("Simulated response check at 10 ms; not physical evidence.");
      await task.getByLabel("Input entity", { exact: true }).selectOption(input.id);
      await task.getByRole("radio", { name: "Selected fields", exact: true }).check();
      await task.getByRole("checkbox", { name: "Include field statement", exact: true }).check();
      await task.getByRole("button", { name: "Record receipt", exact: true }).click();
      await expect.poll(async () => (await tracer.evidence.list("receipt")).items.length).toBe(1);
      const receipt = (await tracer.evidence.list("receipt")).items[0];
      await task.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.locator('[data-action="search"]').click();
      await page.locator("#search").fill("REQ");
      await page.locator('[data-result="REQ"]').click();
      await page.locator('[data-action="details"]').click();
      await page.locator('[data-action="edit"]').click();
      await page.locator("#draft-statement").fill("Response within 5 ms");
      await page.locator('[data-action="apply-edit"]').click();
      await expect
        .poll(async () => (await tracer.queryEntities({ key: "REQ" })).items[0].version)
        .toBe(2);
      await page.locator('[data-view="history"]').click();
      await page.locator('[data-action="inspect-revision"]').click();
      await expect(page.locator(".shared-investigation-context")).toContainText("1 links");
      await page.getByRole("button", { name: /Review changed evidence/ }).click();
      const stage = page.getByLabel("Captured result review", { exact: true });
      await expect(
        stage.getByText("Freshness: changed · Review: unreviewed", { exact: true }),
      ).toBeVisible();
      await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
      await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
      await stage
        .getByLabel("Review rationale", { exact: true })
        .fill("Repeat the response check at 5 ms before relying on this result.");
      await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect(page.getByLabel("Recorded decision", { exact: true })).toContainText(
        "Needs reevaluation",
      );
      const reviewId = await page
        .getByLabel("Recorded decision", { exact: true })
        .getAttribute("data-review-id");
      const revision = (await tracer.getProjectSnapshot()).projectRevision;
      await page
        .getByRole("button", { name: "Back to investigation", exact: true })
        .first()
        .click();
      await page.locator('[data-view="matrix"]').click();
      await page.getByRole("button", { name: "Save Matrix configuration", exact: true }).click();
      await page.locator("#save-matrix-recipe input").fill("Response trace");
      await page.getByRole("button", { name: "Save configuration", exact: true }).click();
      await expect.poll(async () => (await tracer.savedViews.list()).length).toBe(1);
      await page.locator('[data-view="graph"]').click();
      const positions = await page
        .locator(".node")
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.getAttribute("data-key"),
            (node as HTMLElement).style.left,
            (node as HTMLElement).style.top,
          ]),
        );
      await page.reload();
      await expect(page.locator(".shared-investigation-context")).toContainText("1 links");
      await expect
        .poll(() =>
          page
            .locator(".node")
            .evaluateAll((nodes) =>
              nodes.map((node) => [
                node.getAttribute("data-key"),
                (node as HTMLElement).style.left,
                (node as HTMLElement).style.top,
              ]),
            ),
        )
        .toEqual(positions);
      await page.getByRole("button", { name: /Review changed evidence/ }).click();
      await expect(page.getByLabel("Recorded decision", { exact: true })).toHaveAttribute(
        "data-review-id",
        reviewId!,
      );
      expect((await tracer.getProjectSnapshot()).projectRevision).toBe(revision);
      expect((await tracer.evidence.list("receipt")).items).toEqual([receipt]);
      expect((await tracer.evidence.list("review")).items).toHaveLength(1);
      await page.screenshot({ path: `/tmp/tracer-main-assessment-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 1440) {
        await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
        await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
        await stage
          .getByLabel("Review rationale", { exact: true })
          .fill("Record an acknowledgment while retaining the need for follow-up.");
        let attempts = 0;
        await page.route("**/api/reviews", async (route) => {
          attempts++;
          await route.fetch();
          await route.abort();
        });
        await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Inspect saved result", exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(page.locator(".workspace-notice")).toContainText(
          "A save was unconfirmed before reload",
        );
        await expect(page.getByLabel("Recorded decision", { exact: true })).toContainText(
          "Change acknowledged",
        );
        await expect(
          stage.getByRole("button", { name: "Review receipt", exact: true }),
        ).toBeDisabled();
        expect(attempts).toBe(1);
        expect((await tracer.evidence.list("review")).items).toHaveLength(2);
        await page
          .getByRole("button", { name: "I inspected the saved records and History", exact: true })
          .click();
        await expect(
          stage.getByRole("button", { name: "Review receipt", exact: true }),
        ).toBeEnabled();
        expect(attempts).toBe(1);
        await page.unroute("**/api/reviews");
        await openProjectDestination(page, "Project settings");
        await page
          .getByRole("region", { name: "Project settings", exact: true })
          .getByRole("button", { name: /Development map/ })
          .click();
        await page.getByRole("button", { name: "Graph / Matrix / History", exact: true }).click();
        await expect(page.getByLabel("Recorded decision", { exact: true })).toContainText(
          "Change acknowledged",
        );
        expect((await tracer.evidence.list("review")).items).toHaveLength(2);
        await page.locator('[data-view="graph"]').click();
        await page.keyboard.press("/");
        await page
          .getByLabel("Search artifacts and commands", { exact: true })
          .fill("Add existing record");
        await page.locator("[data-command]").click();
        await page.locator("#create-new").click();
        const creation = page.locator("#create-form");
        await creation.locator('[name="key"]').fill("AUX");
        await creation.locator('[name="title"]').fill("Supporting implementation");
        await creation.locator('[name="statement"]').fill("Record supporting engineering context.");
        await creation.getByRole("button", { name: "Create artifact", exact: true }).click();
        await expect
          .poll(async () => (await tracer.queryEntities({ key: "AUX" })).items.length)
          .toBe(1);
        await page.locator('[data-view="matrix"]').click();
        await page
          .getByLabel("Saved configurations", { exact: true })
          .selectOption((await tracer.savedViews.list())[0].id);
        await expect(page.locator("#matrix-scope")).toHaveValue("project");
        await expect(page.locator("[data-trace-row]")).toHaveCount(3);
      }
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
