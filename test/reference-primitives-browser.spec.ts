import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
for (const width of [1440, 390])
  test(`native references author, reuse, pin and capture an evaluation at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-reference-ui-")),
      repo = new SQLiteRepository(join(directory, "project.sqlite")),
      t = new Tracer(repo, undefined, observeLocal),
      origin = { actor: "reference-ui" };
    await t.setSchema(
      {
        entityTypes: { need: { fields: { title: { type: "string" } } } },
        relationshipTypes: {
          cites: {
            source: ["need"],
            target: [],
            reference: true,
            resourceTarget: true,
            fields: { rationale_note: { type: "string", required: true } },
          },
        },
      },
      0,
      origin,
    );
    const subject = await t.createEntity(
      { type: "need", key: "NEED-1", fields: { title: "Understand source context" } },
      1,
      origin,
    );
    const file = join(directory, "needs.md");
    writeFileSync(file, "PN-01: source context\nPN-07: evidence context\n");
    const server = await startLocalServer(t, resolve("dist"), 0),
      errors: string[] = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("REFERENCE PAGE ERROR", e.message);
    });
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("NEED-1");
      await page.keyboard.press("Enter");
      const expand = page.getByRole("button", { name: "Expand artifact details" });
      if (await expand.isVisible()) await expand.click();
      await page
        .getByRole("button", { name: "References and supporting material", exact: true })
        .click();
      const view = page.getByRole("region", { name: "Record references" });
      await expect(view).toBeVisible();
      await view.getByLabel("Resource title", { exact: true }).fill("User needs document");
      await view
        .getByLabel("Reference field rationale_note")
        .fill("Required project-specific context");
      await view.getByLabel("Section or passage label").fill("PN-01");
      await view.getByLabel("Why this material matters").fill("Defines the intended outcome.");
      await view.getByRole("button", { name: "Save reference", exact: true }).click();
      await expect(
        view.getByRole("heading", { name: "User needs document", exact: true }),
      ).toBeVisible();
      await view.getByLabel("Local file path").fill(file);
      await view.getByRole("button", { name: "Observe file", exact: true }).click();
      await expect(view.getByText(/Observed 20/)).toBeVisible();
      await view.getByRole("button", { name: "Edit reference", exact: true }).click();
      await expect(
        view.getByRole("heading", { name: "Edit reference", exact: true }),
      ).toBeVisible();
      await view.getByLabel("Source state", { exact: true }).selectOption("pinned");
      await view.getByRole("button", { name: "Save reference", exact: true }).click();
      await expect(view.getByText(/Pinned state · available/)).toBeVisible();
      await view.getByRole("button", { name: "Edit reference", exact: true }).click();
      await view
        .getByLabel("Outcome and conditions")
        .fill(
          "Simulated assessment: source passage supports this need; no product verification claimed.",
        );
      await view.getByRole("button", { name: "Record evaluation", exact: true }).click();
      await expect(view.getByText(/Recorded evaluation/).first()).toBeVisible();
      await view.getByRole("button", { name: "Cancel reference edit", exact: true }).click();
      const snapshot = await t.getProjectSnapshot(),
        resource = snapshot.entities.find((e) => e.resource)!;
      await view.getByLabel("Resource", { exact: true }).selectOption(resource.id);
      await view.getByLabel("Section or passage label").fill("PN-07");
      await view
        .getByLabel("Reference field rationale_note")
        .fill("Separate section interpretation");
      await view.getByRole("button", { name: "Save reference", exact: true }).click();
      await expect(
        view.getByRole("heading", { name: "User needs document", exact: true }),
      ).toHaveCount(2);
      const saved = await t.exportProject();
      expect(saved.current.entities.filter((e) => e.resource)).toHaveLength(1);
      expect(saved.current.relationships).toHaveLength(2);
      expect(saved.evidence.receipts).toHaveLength(1);
      expect(saved.evidence.receipts[0].relationshipInputs).toHaveLength(1);
      expect(saved.evidence.receipts[0].output.id).toBe(subject.id);
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await page.getByRole("button", { name: "Assess evidence", exact: true }).click();
      await expect(
        page.getByText(/Simulated assessment: source passage supports this need/).first(),
      ).toBeVisible();
      await expect(
        page.getByText("Could not read the project. Refresh to retry.", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: /^Back to (graph|matrix|history|investigation)/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page
        .getByRole("button", { name: "References for selected record", exact: true })
        .click();
      await view.getByLabel("Resource", { exact: true }).selectOption(resource.id);
      await view.getByLabel("Section or passage label").fill("Retained conflict proposal");
      await t.updateEntity(
        subject.id,
        subject.version,
        { fields: { title: "Concurrent title change" } },
        1,
        origin,
      );
      await view.getByRole("button", { name: "Save reference", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(view.getByLabel("Section or passage label")).toHaveValue(
        "Retained conflict proposal",
      );
      expect((await t.getProjectSnapshot()).relationships).toHaveLength(2);
      await page.reload();
      await page.getByRole("button", { name: "Project tools", exact: true }).click();
      await page
        .getByRole("button", { name: "References for selected record", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "User needs document", exact: true }),
      ).toHaveCount(2);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repo.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
