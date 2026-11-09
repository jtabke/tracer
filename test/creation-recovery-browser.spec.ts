import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

async function openCreation(page: Page, kind: "connection" | "reference") {
  const title =
    kind === "connection" ? "Edit record and connections" : "References for selected record";
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill(title);
  await page.getByRole("option", { name: new RegExp(title) }).click();
}

for (const kind of ["connection", "reference"] as const) {
  for (const committed of [false, true]) {
    test(`${kind} creation recovers a ${committed ? "committed" : "unsent"} unknown save without replay`, async ({
      page,
    }) => {
      const repository = new SQLiteRepository(":memory:");
      const tracer = new Tracer(repository);
      const actor = { actor: "creation-recovery-test" };
      await tracer.setSchema(
        {
          entityTypes: { need: { fields: { title: { type: "string" } } } },
          relationshipTypes: {
            relates: { source: ["need"], target: ["need"], fields: {} },
            cites: {
              source: ["need"],
              target: [],
              reference: true,
              resourceTarget: true,
              fields: {},
            },
          },
        },
        0,
        actor,
      );
      for (const key of ["NEED-1", "NEED-2"])
        await tracer.createEntity({ type: "need", key, fields: { title: key } }, 1, actor);
      const server = await startLocalServer(tracer, resolve("dist"), 0);
      try {
        await page.goto(server.origin);
        await page.locator('[data-action="search"]').click();
        await page.locator("#search").fill("NEED-1");
        await page.locator('[data-result="NEED-1"]').click();
        await openCreation(page, kind);
        const task = page.locator(".native-task:visible");
        if (kind === "connection") {
          await task.locator(".work-connect-options > summary").click();
          await task.getByLabel("Connection meaning", { exact: true }).selectOption("relates");
          await task.getByLabel("Find target", { exact: true }).fill("NEED-2");
          await task.getByRole("button", { name: "Choose target NEED-2", exact: true }).click();
        } else {
          await task.getByLabel("Resource title", { exact: true }).fill("Retained source proposal");
          await task
            .getByLabel("Why this material matters", { exact: true })
            .fill("Exact retained interpretation");
        }
        const save = task.getByRole("button", {
          name: kind === "connection" ? "Connect selected target" : "Save reference",
          exact: true,
        });
        await expect(save).toBeEnabled();
        const attempts: { operations: { id: string }[] }[] = [];
        await page.route("**/api/changesets", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          attempts.push(route.request().postDataJSON());
          if (committed) await route.fetch();
          await route.abort("connectionfailed");
        });
        await save.click();
        await expect(save).toBeDisabled();
        expect(attempts).toHaveLength(1);
        expect(attempts[0].operations[0].id).toMatch(/^[0-9a-f-]{36}$/);
        await task.getByRole("button", { name: "Return to workspace", exact: true }).click();
        await page.getByRole("button", { name: "Inspect saved result", exact: true }).click();
        const inspection = page.locator("#workspace-dialog");
        await expect(inspection).toContainText("No automatic retry has been sent");
        if (committed) await expect(inspection).toContainText("recorded v1");
        else await expect(inspection).toContainText("This does not prove the save failed");
        await inspection
          .getByRole("button", { name: "I have inspected the result", exact: true })
          .click();
        await expect(inspection).not.toBeVisible();
        await expect(
          page.getByRole("button", { name: "Inspect saved result", exact: true }),
        ).toHaveCount(0);
        await openCreation(page, kind);
        if (kind === "connection")
          await expect(task.getByText("Selected target:")).toContainText("NEED-2");
        else {
          await expect(task.getByLabel("Resource title", { exact: true })).toHaveValue(
            "Retained source proposal",
          );
          await expect(task.getByLabel("Why this material matters")).toHaveValue(
            "Exact retained interpretation",
          );
        }
        expect(attempts).toHaveLength(1);
        const snapshot = await tracer.getProjectSnapshot();
        expect(snapshot.relationships).toHaveLength(committed ? 1 : 0);
        if (committed) expect(snapshot.relationships[0].id).toBe(attempts[0].operations[0].id);
      } finally {
        await closeTestPage(page);
        await server.close();
        repository.close();
      }
    });
  }
}
