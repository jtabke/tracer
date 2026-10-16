import { closeTestPage } from "./browser-test.ts";
import { test, expect, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { ProjectSnapshot } from "../src/core/project-snapshot.ts";
import type { Entity } from "../src/core/model.ts";

for (const domain of ["integrated", "medical"] as const) {
  test(`${domain}: find, trace, edit, connect, review and reopen in the shared UI`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-workflow-"));
    const project = await seedRealisticProject(join(directory, "project"), domain);
    const repository = new SQLiteRepository(project.database);
    const core = new Tracer(repository);
    const server = await startLocalServer(core, resolve("dist"), 0);
    try {
      const receipt = await core.evidence.getReceipt(project.receipts[0].id);
      const snapshot = await core.getProjectSnapshot();
      const subject = snapshot.entities.find((item) => item.id === receipt.inputs[0].entity.id)!;
      const link = missingConnection(snapshot, subject);
      await page.goto(server.origin);
      await findItem(page, subject.key!);
      await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
      const task = page.getByRole("dialog", { name: "Project task" });
      await task.getByRole("button", { name: "Edit item", exact: true }).click();
      await task.getByLabel("Item title", { exact: true }).fill("Workflow reviewed title");
      await task.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await core.getProjectSnapshot()).entities.find((item) => item.id === subject.id)!
              .fields.title,
        )
        .toBe("Workflow reviewed title");
      await task.locator(".work-connect-options > summary").click();
      await task.getByLabel("Connection meaning", { exact: true }).selectOption(link.type);
      await task.getByLabel("Target type", { exact: true }).fill(link.target.type);
      await task.getByLabel("Find target", { exact: true }).fill(link.target.key!);
      await task
        .getByRole("button", { name: `Choose target ${link.target.key}`, exact: true })
        .click();
      await task
        .getByLabel("Connection scope", { exact: true })
        .fill("Workflow check: explicit illustrative connection");
      await task
        .getByLabel("Connection source_version", { exact: true })
        .fill(String(subject.version + 1));
      await task.getByRole("button", { name: "Connect selected target", exact: true }).click();
      await expect
        .poll(async () =>
          (await core.getProjectSnapshot()).relationships.some(
            (item) =>
              item.source === subject.id &&
              item.target === link.target.id &&
              item.type === link.type,
          ),
        )
        .toBe(true);
      await task.getByRole("button", { name: "Return to map", exact: true }).click();
      await page.getByRole("button", { name: "Evaluations", exact: true }).click();
      await task.getByLabel("Evaluation receipt", { exact: true }).selectOption(receipt.id);
      const stage = task.getByLabel("Captured result review", { exact: true });
      await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
      await stage.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
      await stage
        .getByLabel("Review rationale", { exact: true })
        .fill("Reviewed changed native input; original simulated outcome is retained.");
      await stage.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect(
        stage.getByRole("heading", {
          name: "Freshness: changed · Review: acknowledged",
          exact: true,
        }),
      ).toBeVisible();
      expect(await core.evidence.getReceipt(receipt.id)).toEqual(receipt);
      await page.reload();
      await findItem(page, subject.key!);
      await expect(
        page.getByRole("heading", { name: "Workflow reviewed title", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Evaluations", exact: true }).click();
      await task.getByLabel("Evaluation receipt", { exact: true }).selectOption(receipt.id);
      await expect(
        task.getByRole("heading", {
          name: "Freshness: changed · Review: acknowledged",
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

async function findItem(page: Page, key: string) {
  await page.getByRole("searchbox", { name: "Find an item" }).fill(key);
  await page
    .getByRole("button")
    .filter({ hasText: new RegExp(`^${key} ·`) })
    .click();
  await expect(page.getByRole("heading", { name: `Trace · ${key}`, exact: true })).toBeVisible();
}

function missingConnection(snapshot: ProjectSnapshot, source: Entity) {
  for (const [type, definition] of Object.entries(snapshot.schema!.relationshipTypes)) {
    if (definition.source && !definition.source.includes(source.type)) continue;
    const target = snapshot.entities.find(
      (item) =>
        item.id !== source.id &&
        (!definition.target || definition.target.includes(item.type)) &&
        !snapshot.relationships.some(
          (link) => link.type === type && link.source === source.id && link.target === item.id,
        ),
    );
    if (target) return { type, target };
  }
  throw new Error("Example needs an unconnected permitted target for this walkthrough");
}
