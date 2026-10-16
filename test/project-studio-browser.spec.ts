import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { seedWorkspace } from "../examples/seed-workspace.ts";
import { readDemoGuide } from "../src/interfaces/demo-guide.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { editableField, openView } from "./browser-navigation.ts";
import { modelFlow } from "../ui/model-flow.ts";

const screenshots = "/tmp/tracer-project-studio";

test("project home enters a real scope; Table/Graph and project navigation retain selection and a native draft", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-studio-"));
  const fixture = await seedRealisticProject(join(dir, "project"), "integrated");
  const repo = new SQLiteRepository(fixture.database);
  const tracer = new Tracer(repo);
  const guide = await readDemoGuide(join(fixture.directory, "tasks.json"));
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0, guide);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(screenshots, { recursive: true });
  try {
    await page.goto(server.origin);
    await expect(page.getByRole("tab", { name: "Project", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Orbit R1", exact: true })).toBeVisible();
    await expect(page.locator(".home-scope")).toHaveCount(guide.tasks.length);
    await expect(page.locator(".home-context")).toContainText("72 items across 16 types");
    await expect(page.locator(".workspace-browser")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Explore scope · Shared design across engineering constraints",
        exact: true,
      })
      .click();
    const scope = page.locator(".workspace-surface");
    await expect(scope.getByRole("heading", { name: "DES-01 context", exact: true })).toContainText(
      "Blower-control firmware design",
    );
    await expect(scope.locator(".workspace-trace tbody > tr")).toHaveCount(5);
    await scope.getByRole("button", { name: "Inspect DES-01", exact: true }).first().click();
    await expect(scope.locator(".workspace-trace tbody > tr.shares-selection")).toHaveCount(5);
    await expect(scope.locator(".workspace-intent p")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Browse project items", exact: true }),
    ).toHaveCount(0);
    await scope.getByRole("button", { name: "REQ-R03 · v1", exact: true }).click();
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    await expect(inspector.getByRole("heading", { name: "REQ-R03", exact: true })).toBeVisible();
    const draft = await editableField(page, "Workspace statement");
    await draft.fill("A retained engineering draft across the project studio.");
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await scope
      .locator(".workspace-bar")
      .getByRole("button", { name: "Graph", exact: true })
      .click();
    await expect(scope.locator(".graph-canvas-tools span")).toHaveText(/\d+%/);
    const canvas = await scope.getByLabel("Graph canvas", { exact: true }).boundingBox();
    for (const item of ["DES-01"]) {
      const node = await scope.getByTestId(`graph-node-${item}`).boundingBox();
      expect(node!.x).toBeGreaterThanOrEqual(canvas!.x);
      expect(node!.x + node!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
    }
    await expect(scope.getByTestId("graph-node-REQ-R03")).toHaveAttribute("aria-pressed", "true");
    await expect(draft).toHaveValue("A retained engineering draft across the project studio.");
    await openView(page, "Model");
    const schema = (await tracer.getSchema())!;
    await expect(page.locator(".model-wide-overview .model-flow-types > li")).toHaveCount(
      Object.keys(schema.entityTypes).length,
    );
    await page.getByLabel("Focus type", { exact: true }).selectOption("design");
    await page.getByRole("button", { name: "Inputs and outputs", exact: true }).click();
    const modelFocus = page.getByLabel("design inputs and outputs", { exact: true });
    const paths = modelFlow(schema, "workflow").routes.filter(
      (route) => route.source.name === "design" || route.target.name === "design",
    );
    await expect(modelFocus.locator("li button")).toHaveCount(paths.length);
    for (const path of paths)
      await expect(
        modelFocus.getByRole("button", {
          name: `Inspect workflow path · ${path.source.name} → ${path.label} → ${path.target.name}`,
          exact: true,
        }),
      ).toBeVisible();
    for (const name of ["requirement", "evaluation", "build_configuration"])
      await expect(
        modelFocus.locator("li strong").filter({ hasText: name.replaceAll("_", " ") }),
      ).toBeVisible();
    await page.locator("header").getByRole("button", { name: "Find items", exact: true }).click();
    await expect(page.getByLabel("Find workspace items", { exact: true })).toBeFocused();
    await expect(draft).toHaveValue("A retained engineering draft across the project studio.");
    await scope
      .locator(".workspace-bar")
      .getByRole("button", { name: "Table", exact: true })
      .click();
    await expect(scope.locator(".workspace-trace tbody > tr.is-emphasized")).toContainText(
      "REQ-R03",
    );
    await editableField(page, "Workspace statement");
    await inspector.getByRole("button", { name: "Save item", exact: true }).click();
    await expect
      .poll(async () => (await tracer.queryEntities({ key: "REQ-R03" })).items[0].fields.statement)
      .toBe("A retained engineering draft across the project studio.");
    await inspector.getByRole("button", { name: "Return to scope", exact: true }).click();
    await scope
      .locator(".workspace-bar")
      .getByRole("button", { name: "Graph", exact: true })
      .click();
    const library = page.locator(".workspace-view-library");
    await library.getByRole("button", { name: "Save view…", exact: true }).click();
    await library.getByLabel("Saved view name", { exact: true }).fill("Engineering graph scope");
    await library.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await tracer.savedViews.list()).find((view) => view.name === "Engineering graph scope")
            ?.definition,
      )
      .toMatchObject({ kind: "family", layout: "graph", rootId: fixture.entities["DES-01"].id });
    await openView(page, "Project");
    const savedScope = page
      .getByRole("button")
      .filter({ has: page.getByText("Engineering graph scope", { exact: true }) });
    await expect(savedScope).toBeVisible();
    const home = page.getByLabel("Project home", { exact: true });
    const savedHeading = await home
      .getByRole("heading", { name: "Saved views", exact: true })
      .boundingBox();
    const exampleHeading = await home
      .getByRole("heading", { name: "Explore the example", exact: true })
      .boundingBox();
    expect(savedHeading!.y).toBeLessThan(exampleHeading!.y);
    await page.screenshot({
      path: `/tmp/tracer-home-saved-priority-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
    await savedScope.click();
    await expect(scope.getByLabel("Graph canvas", { exact: true })).toBeVisible();
    await openView(page, "Evidence");
    await page
      .getByLabel("Recorded evaluation results")
      .getByRole("button")
      .filter({ hasText: "EVAL-R02" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".evidence-results")).toContainText("predates firmware edit");
    await expect(page.locator(".evidence-create")).not.toHaveAttribute("open", "");
    await openView(page, "Configurations");
    const configurations = page
      .getByRole("region", { name: "Configuration catalogue", exact: true })
      .locator(".configuration-catalog-rows > li");
    await expect(configurations).toHaveCount(3);
    await configurations.first().getByRole("button").click();
    await expect(page.getByRole("article", { name: "Pinned configuration" })).toContainText(
      "pinned native members",
    );
    for (const width of [1440, 2560, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of ["Project", "Model", "Evidence", "Configurations"]) {
        await openView(page, view);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBe(width);
        await page.screenshot({ path: join(screenshots, `${view}-${width}.png`), fullPage: true });
      }
    }
    await openView(page, "Project");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Orbit R1", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ordinary projects get a useful home without invented example workspaces or activity", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "tracer-studio-ordinary-"));
  const fixture = await seedWorkspace(join(dir, "project"), "engineering");
  const repo = new SQLiteRepository(fixture.database);
  const server = await startLocalServer(new Tracer(repo), resolve(".fallow/legacy-ui"), 0);
  try {
    await page.goto(server.origin);
    await expect(page.getByRole("heading", { name: "Your project", exact: true })).toBeVisible();
    await expect(page.locator(".home-context")).toContainText("12 items across 4 types");
    await expect(page.locator(".home-scope, .studio-scopes")).toHaveCount(0);
    await expect(page.locator(".home-saved")).toHaveCount(1);
    await page
      .locator(".home-type-index")
      .getByRole("button")
      .filter({ hasText: "requirement" })
      .click();
    await expect(page.getByLabel("Workspace type", { exact: true })).toHaveValue("requirement");
    await expect(page.locator(".workspace-items tbody tr")).toHaveCount(4);
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repo.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
