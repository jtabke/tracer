import { closeTestPage } from "./browser-test.ts";
import { evaluationChooser, openView, editableField } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedScaleProject } from "../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const scale of ["working", "large"] as const)
  test(`${scale}: find an off-page gap, connect a test, browse dense links and review changed input without losing drafts`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const directory = mkdtempSync(join(tmpdir(), "tracer-work-browser-"));
    const project = await seedScaleProject(join(directory, "demo"), scale),
      repository = new SQLiteRepository(project.database),
      tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    const errors: string[] = [],
      requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    try {
      const firstResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/work" &&
          new URL(response.url()).searchParams.get("limit") === "30",
      );
      await page.goto(`${server.origin}/?demo=${scale}`);
      await openView(page, "Workspace");
      await expect(page.getByRole("tab", { name: "Work", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await openView(page, "Model");
      await page.getByRole("button", { name: "Configure model", exact: true }).click();
      await openView(page, "Work");
      const first = await (await firstResponse).json();
      expect(first.entities.items.length).toBe(30);
      expect(first.types.length).toBe(project.tasks.types);
      await expect(page.getByRole("tab", { name: "Direct editor", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByLabel("Work workspace", { exact: true })).toContainText(
        `${project.tasks.entities} active items`,
      );
      await expect(page.getByLabel("Graph canvas", { exact: true })).toHaveCount(0);
      expect(requests).not.toContain("/api/graph");
      expect(requests).not.toContain("/api/evidence");
      await page.getByLabel("Find working type", { exact: true }).fill("require");
      await page.getByRole("button", { name: "Work type requirement", exact: true }).click();
      await page.getByLabel("Working field", { exact: true }).selectOption("subsystem");
      await page.getByLabel("Working field value", { exact: true }).fill("Power");
      await page.getByLabel("Coverage relationship", { exact: true }).selectOption("verified_by");
      await page.getByLabel("Only missing connections", { exact: true }).check();
      const gapCount = scale === "working" ? 8 : 72;
      await expect(
        page.getByRole("heading", { name: `${gapCount} matching items`, exact: true }),
      ).toBeVisible();
      const searchStart = performance.now();
      await page.getByLabel("Search working set", { exact: true }).fill(project.tasks.gap!);
      await page.getByRole("button", { name: `Inspect ${project.tasks.gap}`, exact: true }).click();
      const detail = page.getByLabel("Focused item", { exact: true });
      await detail.locator(".work-connect-options > summary").click();
      await expect(
        detail.getByRole("heading", { name: project.tasks.gap, exact: true }),
      ).toBeVisible();
      await editableField(page, "Item title");
      await expect(detail.getByLabel("Item title", { exact: true })).toBeEnabled();
      const searchMs = performance.now() - searchStart;
      const linkStart = performance.now();
      await detail.getByLabel("Find target", { exact: true }).fill(project.tasks.target!);
      await detail
        .getByRole("button", { name: `Choose target ${project.tasks.target}`, exact: true })
        .click();
      await detail.getByRole("button", { name: "Connect selected target", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "0 matching items", exact: true }),
      ).toBeVisible();
      await expect(
        detail.getByRole("heading", { name: project.tasks.gap, exact: true }),
      ).toBeVisible();
      const linkMs = performance.now() - linkStart;
      // Detect existing connections even when the item has other link pages.
      await detail
        .getByRole("button", { name: `Choose target ${project.tasks.target}`, exact: true })
        .click();
      await expect(detail.getByText("This connection already exists.")).toBeVisible();
      await expect(
        detail.getByRole("button", { name: "Connect selected target", exact: true }),
      ).toBeDisabled();
      await detail.getByRole("button", { name: "Discard connection draft", exact: true }).click();
      const browseStart = performance.now();
      await page.setViewportSize({ width: 680, height: 800 });
      await page.getByRole("button", { name: "Find dense requirement", exact: true }).click();
      const denseButton = page.getByRole("button", {
        name: `Inspect ${project.tasks.dense}`,
        exact: true,
      });
      await denseButton.focus();
      await page.keyboard.press("Enter");
      const focusedHeading = detail.getByRole("heading", {
        name: project.tasks.dense,
        exact: true,
      });
      await expect(focusedHeading).toBeFocused();
      const headingBounds = await focusedHeading.boundingBox();
      expect(headingBounds!.y).toBeGreaterThanOrEqual(0);
      expect(headingBounds!.y).toBeLessThan(800);
      await detail.getByRole("button", { name: /^Browse connections/ }).click();
      await expect(
        detail.getByRole("heading", { name: "Relevant connections", exact: true }),
      ).toBeFocused();
      await page.screenshot({ path: `/tmp/tracer-dense-narrow-${scale}.png` });
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(detail).toContainText(/25 shown of \d+ matching connections/);
      await expect(detail.locator(".work-connections li")).toHaveCount(25);
      await detail.getByRole("button", { name: "More connections", exact: true }).click();
      await expect(
        detail.getByRole("button", { name: "First connections", exact: true }),
      ).toBeEnabled();
      await detail.getByLabel("Filter connections", { exact: true }).selectOption("implemented_by");
      await expect(detail).toContainText("1 shown of 1 matching connections");
      const denseBrowseMs = performance.now() - browseStart;
      // Search/filter changes keep the focused draft; changing its item requires consent.
      await (await editableField(page, "Item title")).fill("Retained while finding another item");
      await page
        .getByLabel("Search working set", { exact: true })
        .fill(project.tasks.changedInput!);
      page.once("dialog", (dialog) => dialog.dismiss());
      await page
        .getByRole("button", { name: `Inspect ${project.tasks.changedInput}`, exact: true })
        .click();
      await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
        "Retained while finding another item",
      );
      await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
      await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
        "Retained while finding another item",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: `Inspect ${project.tasks.changedInput}`, exact: true })
        .click();
      await (await editableField(page, "Item title")).fill("Sensor cutoff changed to 85 degrees");
      await detail.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await tracer.queryEntities({ key: project.tasks.changedInput })).items[0].fields.title,
        )
        .toBe("Sensor cutoff changed to 85 degrees");
      await page.screenshot({ path: `/tmp/tracer-work-${scale}.png`, fullPage: true });
      await openView(page, "Evidence");
      if (scale === "large")
        await expect(page.getByText(/Large project: creation pickers are disabled/)).toBeVisible();
      await (await evaluationChooser(page)).selectOption(project.tasks.receipt);
      await expect(
        page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Review receipt", exact: true }).click();
      await page.getByLabel("Review decision", { exact: true }).selectOption("acknowledged");
      await page
        .getByLabel("Review rationale", { exact: true })
        .fill("Scoped cutoff change needs reassessment; the connection alone proves no validity.");
      const input = (await tracer.queryEntities({ key: project.tasks.changedInput })).items[0];
      await tracer.updateEntity(
        input.id,
        input.version,
        { fields: { ...input.fields, title: "Cutoff changed again after rationale" } },
        1,
        { actor: "review-drift-test" },
      );
      await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
      await expect(page.getByText(/Review inputs changed\. Draft retained/)).toBeVisible();
      await expect(page.getByLabel("Review rationale", { exact: true })).toHaveValue(
        "Scoped cutoff change needs reassessment; the connection alone proves no validity.",
      );
      await expect(
        page.getByRole("button", { name: "Record review decision", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Adopt refreshed review inputs", exact: true })
        .click();
      await page.getByRole("button", { name: "Record review decision", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: "Freshness: changed · Review: acknowledged",
          exact: true,
        }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      await expect(page.getByRole("alert")).toHaveCount(0);
      console.log(
        JSON.stringify({
          workload: scale,
          browserSearchAndFocusMs: Math.round(searchMs),
          connectAndResolveGapMs: Math.round(linkMs),
          denseBrowseMs: Math.round(denseBrowseMs),
          initialPayloadBytes: JSON.stringify(first).length,
        }),
      );
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("connection draft can adopt a schema that removes its selected meaning", async ({ page }) => {
  const repository = new SQLiteRepository(":memory:"),
    tracer = new Tracer(repository);
  const fields = { title: { type: "string" as const, required: true } };
  const schema = {
    entityTypes: { requirement: { fields }, test: { fields }, component: { fields } },
    relationshipTypes: {
      old: { source: ["requirement"], target: ["test"], fields: {} },
      replacement: { source: ["requirement"], target: ["component"], fields: {} },
    },
  };
  const actor = { actor: "schema-recovery-test" };
  await tracer.setSchema(schema, 0, actor);
  const source = await tracer.createEntity(
    { type: "requirement", key: "REQ", fields: { title: "Source" } },
    1,
    actor,
  );
  await tracer.createEntity(
    { type: "test", key: "TEST", fields: { title: "Old target" } },
    1,
    actor,
  );
  await tracer.createEntity(
    { type: "component", key: "COMP", fields: { title: "Replacement target" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await openView(page, "Work");
    await page.getByRole("button", { name: "Inspect REQ", exact: true }).click();
    const detail = page.getByLabel("Focused item", { exact: true });
    await detail.locator(".work-connect-options > summary").click();
    await detail.getByLabel("Find target", { exact: true }).fill("TEST");
    await detail.getByRole("button", { name: "Choose target TEST", exact: true }).click();
    await tracer.setSchema(
      { ...schema, relationshipTypes: { replacement: schema.relationshipTypes.replacement } },
      1,
      actor,
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(detail.getByText(/current is v2/)).toBeVisible();
    await detail.getByRole("button", { name: "Discard connection draft", exact: true }).click();
    await expect(detail.getByLabel("Connection meaning", { exact: true })).toHaveValue(
      "replacement",
    );
    await expect(detail.getByLabel("Target type", { exact: true })).toHaveValue("component");
    await detail.getByLabel("Find target", { exact: true }).fill("COMP");
    await detail.getByRole("button", { name: "Choose target COMP", exact: true }).click();
    await detail.getByRole("button", { name: "Connect selected target", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await tracer.queryRelationships({ source: source.id, type: "replacement" })).items
            .length,
      )
      .toBe(1);
    await (await editableField(page, "Item title")).fill("Retained through failed context read");
    await page.route("**/api/connections?*", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "busy", message: "Injected read failure" }),
      }),
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(detail.getByText(/Item details could not be read/)).toBeVisible();
    await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
      "Retained through failed context read",
    );
    await expect(detail.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await page.unroute("**/api/connections?*");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(detail.getByRole("button", { name: "Save item", exact: true })).toBeEnabled();
    await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
      "Retained through failed context read",
    );
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repository.close();
  }
});
