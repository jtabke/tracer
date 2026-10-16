import { test, expect } from "./browser-test.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { modelFlow } from "../ui/model-flow.ts";
import {
  switchFamilyView,
  openView,
  chooseRelatedGroup,
  evaluationChooser,
} from "./browser-navigation.ts";

const checkpoints = {
  medical: { descendant: "PRS-02", failedOutput: "RUN-06", changedOutput: "RUN-01" },
  technology: { descendant: "CAP-02", failedOutput: "RUN-TECH-03", changedOutput: "RUN-TECH-02" },
  integrated: { descendant: "TGT-01", failedOutput: "EVAL-R04", changedOutput: "EVAL-R02" },
};

for (const domain of ["medical", "technology", "integrated"] as const)
  test(`${domain}: realistic families, eight-column trace and changed native evidence`, async ({
    page,
  }) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-realistic-browser-"));
    const project = await seedRealisticProject(join(parent, "project"), domain);
    const repository = new SQLiteRepository(project.database);
    const server = await startLocalServer(new Tracer(repository), resolve(".fallow/legacy-ui"), 0);
    const screenshots = join(tmpdir(), "tracer-realistic-seed-review");
    mkdirSync(screenshots, { recursive: true });
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(server.origin + project.tasks[0].url);
      const surface = page.locator(".workspace-surface");
      await expect(surface).toContainText(project.tasks[0].root);
      await expect(surface).toContainText(project.tasks[0].inspect[0]);
      await switchFamilyView(page, "Reading");
      await expect(page.locator(".workspace-reading")).toContainText(project.tasks[0].inspect[0]);
      await page.screenshot({ path: join(screenshots, `${domain}-reading.png`) });
      await switchFamilyView(page, "Relationships");
      const child = project.tasks[0].inspect[0];
      await surface.getByRole("button", { name: `${child} · v1`, exact: true }).click();
      await page
        .getByRole("button", { name: `Show relationships for ${child}`, exact: true })
        .click();
      await chooseRelatedGroup(
        page,
        new RegExp(`^→ ${project.tasks[0].relationship.replaceAll("_", " ")} ·`),
      );
      await expect(surface.getByRole("heading", { level: 2 })).toContainText(child);
      await expect(surface).toContainText(checkpoints[domain].descendant);
      await page
        .getByRole("button", {
          name: `Return to relationships for ${project.tasks[0].root}`,
          exact: true,
        })
        .click();
      await expect(surface.getByRole("heading", { level: 2 })).toContainText(project.tasks[0].root);
      await page.goto(server.origin + project.tasks[2].url);
      await expect(surface).toContainText(project.tasks[2].root);
      for (const key of project.tasks[2].inspect.slice(0, 3))
        await expect(surface).toContainText(key);
      await page.screenshot({ path: join(screenshots, `${domain}-shared.png`) });
      await openView(page, "Table");
      await expect(page.getByRole("region", { name: "Trace scope controls" })).toBeVisible();
      const query = project.chains[0].query;
      await page.getByLabel("Chain parent type", { exact: true }).selectOption(query.type);
      await page.getByLabel("Find chain parents", { exact: true }).fill(query.search!);
      for (const [index, step] of query.steps.entries()) {
        const column = page.getByLabel(`Chain column ${index + 2}`, { exact: true });
        if (!(await column.count()))
          await page.getByRole("button", { name: "Add relationship column", exact: true }).click();
        await column.selectOption({
          label: `${step.direction === "incoming" ? "←" : "→"} ${step.relationshipType.replaceAll("_", " ")} · ${step.type}`,
        });
      }
      await expect(page.locator(".chain-grid")).toContainText(checkpoints[domain].failedOutput);
      await expect(page.getByRole("region", { name: "Trace scope controls" })).toBeVisible();
      await page.setViewportSize({ width: 2560, height: 1200 });
      await page.screenshot({ path: join(screenshots, `${domain}-chain.png`) });
      await openView(page, "Evidence");
      const output = checkpoints[domain].changedOutput;
      await page
        .getByLabel("Recorded evaluation results")
        .getByRole("button")
        .filter({ hasText: output })
        .click();
      await expect(
        page.getByRole("heading", { name: "Freshness: changed · Review: unreviewed", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Captured result review", { exact: true })).toContainText(
        "SIMULATED",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      const chooser = await (await evaluationChooser(page)).boundingBox();
      expect(chooser!.y).toBeLessThan(600);
      await page.screenshot({ path: join(screenshots, `${domain}-evidence.png`) });
      await openView(page, "Model");
      const schema = (await repository.transaction((tx) => tx.get("schema", "project")))!;
      if (!("entityTypes" in schema)) throw new Error("Expected seeded schema");
      await expect(page.locator(".model-wide-overview .model-flow-types > li")).toHaveCount(
        Object.keys(schema.entityTypes).length,
      );
      await page.screenshot({ path: join(screenshots, `${domain}-workflow-overview.png`) });
      const focusType = {
        medical: "product_requirement",
        technology: "implementation",
        integrated: "design",
      }[domain];
      await page.getByLabel("Focus type", { exact: true }).selectOption(focusType);
      await page.getByRole("button", { name: "Inputs and outputs", exact: true }).click();
      const focus = page.getByLabel(`${focusType.replaceAll("_", " ")} inputs and outputs`, {
        exact: true,
      });
      const paths = modelFlow(schema, "workflow").routes.filter(
        (route) => route.source.name === focusType || route.target.name === focusType,
      );
      await expect(focus.locator("li button")).toHaveCount(paths.length);
      for (const path of paths)
        await expect(
          focus.getByRole("button", {
            name: `Inspect workflow path · ${path.source.name} → ${path.label} → ${path.target.name}`,
            exact: true,
          }),
        ).toBeVisible();
      const focusedType = focus.getByRole("button", {
        name: `Type definition · ${focusType.replaceAll("_", " ")}`,
        exact: true,
      });
      await expect(focusedType).toHaveCount(1);
      await expect(page.getByLabel("Focus type", { exact: true })).toHaveValue(focusType);
      await expect(
        page.getByRole("button", { name: "Inputs and outputs", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: join(screenshots, `${domain}-workflow-focus.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(focus).toBeVisible();
      await focusedType.focus();
      const box = (await focusedType.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ path: join(screenshots, `${domain}-workflow-390.png`) });
      await focusedType.click();
      const definition = page.getByLabel("Selected model definition", { exact: true });
      await expect(definition.getByRole("heading").first()).toBeFocused();
      await definition.getByRole("button", { name: /Return to .* inputs and outputs/ }).click();
      await expect(focusedType).toBeFocused();
    } finally {
      await server.close();
      repository.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });
