import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { editableField, openView, switchFamilyView } from "./browser-navigation.ts";

const screenshots = "/tmp/tracer-depth-review";

test("multilevel trace retains root/draft, exposes shared design-under-test and pauses failed reads", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-depth-browser-"));
  const fixture = await seedWorkspace(join(dir, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database);
  const tracer = new Tracer(repo);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(screenshots, { recursive: true });
  try {
    await tracer.evidence.recordReceipt(
      {
        outputId: fixture.outputs.at(-1)!.id,
        outcome: "Illustrative recorded test evaluation",
        inputs: [{ entityId: fixture.outputs[0].id }],
      },
      { actor: "depth-browser-fixture" },
    );
    const head = (await tracer.timeline()).head;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(server.origin);
    await openView(page, "Workspace");
    const browser = page.getByLabel("Project browser", { exact: true });
    await browser.getByLabel("Workspace type", { exact: true }).selectOption("requirement");
    await browser.locator(".workspace-items button").filter({ hasText: "REQ-01" }).click();
    const draft = await editableField(page, "Workspace statement");
    await draft.fill("Trace investigation draft retained across depth changes.");
    await switchFamilyView(page, "Graph");
    const scope = page.locator(".workspace-surface");
    const depth = scope.getByLabel("Graph depth", { exact: true });
    await depth.selectOption("2");
    const graph = await tracer.getGraph({ rootId: fixture.requirements[0].id, depth: 2 });
    await expect(scope.locator(".graph-depth-summary")).toContainText(
      `${graph.nodes.length} items · ${graph.links.length} recorded connections · 2 levels`,
    );
    await expect(scope.getByTestId("graph-node-TEST-3")).toHaveCount(1);
    await expect(
      scope.getByRole("button", { name: "Connection: DESIGN-1 → TEST-3 (tested by)", exact: true }),
    ).toHaveCount(1);
    await expect(draft).toHaveValue("Trace investigation draft retained across depth changes.");
    await depth.selectOption("3");
    await expect(scope.getByTestId("graph-node-INT-02")).toHaveCount(1);
    await expect(scope.getByTestId("graph-node-REQ-01")).toHaveAttribute("aria-pressed", "true");
    await expect(draft).toHaveValue("Trace investigation draft retained across depth changes.");
    expect((await tracer.timeline()).head).toBe(head);
    await scope
      .getByRole("button", {
        name: "Dependency: TEST-3 → DESIGN-1 (evaluated using · captured v1)",
        exact: true,
      })
      .press("Enter");
    const review = page.getByLabel("Captured result review", { exact: true });
    await expect(review).toContainText("Illustrative recorded test evaluation");
    await review.getByRole("button", { name: "Return to REQ-01 scope", exact: true }).click();
    await expect(draft).toHaveValue("Trace investigation draft retained across depth changes.");
    page.once("dialog", (dialog) => dialog.accept());
    await scope.getByTestId("graph-node-TEST-3").press("Enter");
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(inspector.getByRole("heading", { name: "TEST-3", exact: true })).toBeVisible();
    await expect(inspector).toContainText("Illustrative recorded test evaluation");
    const testDraft = await editableField(page, "Workspace statement");
    await testDraft.fill("A deeper-node draft with captured native guards.");
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await depth.selectOption("1");
    await editableField(page, "Workspace statement");
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await expect(testDraft).toHaveValue("A deeper-node draft with captured native guards.");
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await depth.selectOption("3");
    await editableField(page, "Workspace statement");
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeEnabled();
    await page.route("**/api/graph?**", async (route) => {
      if (new URL(route.request().url()).searchParams.get("depth") === "4") await route.abort();
      else await route.continue();
    });
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await depth.selectOption("4");
    await expect(scope.getByRole("alert")).toContainText("Could not load this depth");
    await expect(testDraft).toHaveValue("A deeper-node draft with captured native guards.");
    await editableField(page, "Workspace statement");
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await depth.selectOption("3");
    await editableField(page, "Workspace statement");
    await expect(inspector.getByRole("button", { name: "Save item", exact: true })).toBeEnabled();
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: join(screenshots, `trace-${width}.png`) });
    }
    await editableField(page, "Workspace statement");
    await inspector.getByRole("button", { name: "Save item", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await tracer.queryEntities({ key: fixture.outputs.at(-1)!.key })).items[0]?.fields
            .statement,
      )
      .toBe("A deeper-node draft with captured native guards.");
    expect((await tracer.timeline()).head).toBe(head + 1);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
