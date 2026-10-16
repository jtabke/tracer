import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { modelFlow } from "../ui/model-flow.ts";

for (const [domain, type, design, count] of [
  ["medical", "verification_protocol", "design_output", 18],
  ["technology", "test_scenario", "implementation", 17],
  ["integrated", "evaluation", "design", 16],
] as const)
  test(`${domain} authored model selects the exact test input, edits one native draft and saves/reloads without reversing links`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-model-studio-"));
    const fixture = await seedRealisticProject(join(directory, "project"), domain);
    const repository = new SQLiteRepository(fixture.database);
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const before = (await tracer.getSchema())!;
      const routes = modelFlow(before, "workflow").routes;
      const route = routes.find(
        (route) => route.source.name === design && route.target.name === type,
      )!;
      const rule = before.relationshipTypes[route.name];
      const index = rule.workflow!.findIndex(
        (path) => `${route.name}:${path.source}:${path.target}:${path.direction}` === route.key,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${server.origin}/?view=model`);
      await expect(page.locator(".model-wide-overview .model-flow-types>li")).toHaveCount(count);
      await expect(page.locator(".model-wide-overview .model-flow-route")).toHaveCount(
        routes.length,
      );
      const overview = page.locator(".model-wide-overview");
      const viewport = overview.locator(".model-flow-scroll");
      const frame = (await viewport.boundingBox())!;
      expect(frame.height).toBeGreaterThanOrEqual(500);
      expect(frame.height).toBeLessThanOrEqual(652);
      const firstNode = overview.locator(".model-flow-types > li > button").first();
      if (domain === "integrated")
        await page.screenshot({
          path: "/tmp/tracer-model-default-overview-1440.png",
          fullPage: true,
        });
      const fittedNodes = await viewport.evaluate((element) => {
        const frame = element.getBoundingClientRect();
        return [...element.querySelectorAll(".model-flow-types > li > button")].every((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.left >= frame.left &&
            box.right <= frame.right &&
            box.top >= frame.top &&
            box.bottom <= frame.bottom
          );
        });
      });
      expect(fittedNodes).toBe(true);
      expect((await firstNode.boundingBox())!.width).toBeLessThan(190);
      await overview.getByRole("button", { name: "100%", exact: true }).click();
      await expect(overview.getByLabel("Model overview zoom", { exact: true })).toHaveText("100%");
      expect((await firstNode.boundingBox())!.width).toBeCloseTo(190, 0);
      await overview.getByRole("button", { name: "Fit overview", exact: true }).click();
      expect((await firstNode.boundingBox())!.width).toBeLessThan(190);
      await page.getByLabel("Focus type", { exact: true }).selectOption(type);
      await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(overview.locator(".model-flow-types>li")).toHaveCount(count);
      await expect(overview.locator(".model-flow-route")).toHaveCount(routes.length);
      const selectedNode = overview.getByRole("button", {
        name: `Select type · ${type}`,
        exact: true,
      });
      await expect(selectedNode).toHaveAttribute("aria-pressed", "true");
      const selectedBox = (await selectedNode.boundingBox())!;
      expect(selectedBox.width).toBeCloseTo(190, 0);
      expect(selectedBox.x).toBeGreaterThanOrEqual(frame.x);
      expect(selectedBox.x + selectedBox.width).toBeLessThanOrEqual(frame.x + frame.width);
      await expect(overview.getByLabel("Model overview zoom", { exact: true })).toHaveText("100%");
      const pan = await viewport.evaluate((element) => {
        element.scrollLeft = Math.max(0, element.scrollLeft - 80);
        element.scrollTop = 70;
        return { x: element.scrollLeft, y: element.scrollTop };
      });
      const graphPath = overview.getByRole("button", {
        name: `Inspect workflow path · ${design} → ${route.label} → ${type}`,
        exact: true,
      });
      await graphPath.evaluate((element) => (element as SVGElement).focus({ preventScroll: true }));
      await expect(graphPath).toBeFocused();
      await page.keyboard.press("Enter");
      const graphReading = page.getByLabel("Selected model definition", { exact: true });
      await expect(graphReading).toContainText(route.label);
      await expect(graphReading).toContainText(`Native permissions · ${route.name}`);
      await graphReading.getByRole("button", { name: /Return to .*workflow overview/ }).click();
      await expect(graphPath).toBeFocused();
      expect(
        await viewport.evaluate((element) => ({ x: element.scrollLeft, y: element.scrollTop })),
      ).toEqual(pan);
      await expect(selectedNode).toHaveAttribute("aria-pressed", "true");
      expect(await tracer.getSchema()).toEqual(before);
      if (domain === "integrated") {
        expect(count).toBe(16);
        expect(routes).toHaveLength(28);
        await page.screenshot({
          path: "/tmp/tracer-model-readable-overview-1440.png",
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Inputs and outputs", exact: true }).click();
      const focus = page.getByLabel(`${type.replaceAll("_", " ")} inputs and outputs`, {
        exact: true,
      });
      await expect(focus.locator("li button")).toHaveCount(
        routes.filter((route) => route.source.name === type || route.target.name === type).length,
      );
      await focus
        .getByRole("button", {
          name: `Inspect workflow path · ${design} → ${route.label} → ${type}`,
          exact: true,
        })
        .click();
      const reading = page.getByLabel("Selected model definition", { exact: true });
      await expect(reading).toContainText(route.label);
      await expect(reading).toContainText(
        `Stored path: ${rule.workflow![index].source} → ${rule.workflow![index].target}`,
      );
      await reading.getByRole("button", { name: "Configure this definition", exact: true }).click();
      const editor = page.getByLabel("Configure project model", { exact: true });
      await expect(editor.locator(".schema-visual-canvas")).toBeHidden();
      await expect(editor.getByLabel(`Flow label ${index + 1}`, { exact: true })).toHaveValue(
        route.label,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await editor.getByRole("button", { name: "Text", exact: true }).click();
      await expect(editor.getByLabel("Definition kind", { exact: true })).toBeHidden();
      await expect(editor.getByLabel("Select definition", { exact: true })).toBeHidden();
      await expect(
        editor.getByRole("button", { name: "← Return to draft definitions", exact: true }),
      ).toBeVisible();
      await expect(editor.getByLabel(`Flow label ${index + 1}`, { exact: true })).toHaveValue(
        route.label,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      const sourceChoices = editor.getByRole("group", { name: "Sources", exact: true });
      const sourceLabels = sourceChoices.locator(".schema-endpoint-types label");
      expect((await sourceLabels.allTextContents()).map((name) => name.trim())).toEqual(
        Object.keys(before.entityTypes).map((name) => name.replaceAll("_", " ")),
      );
      const firstChoice = (await sourceLabels.nth(0).boundingBox())!;
      const secondChoice = (await sourceLabels.nth(1).boundingBox())!;
      expect(secondChoice.x).toBeGreaterThan(firstChoice.x);
      expect(Math.abs(secondChoice.y - firstChoice.y)).toBeLessThan(2);
      await editor
        .getByLabel(`Flow label ${index + 1}`, { exact: true })
        .fill(`${route.label} · reviewed mapping`);
      await editor.getByRole("button", { name: "Visual", exact: true }).click();
      await expect(editor.getByLabel(`Flow label ${index + 1}`, { exact: true })).toHaveValue(
        `${route.label} · reviewed mapping`,
      );
      await editor.getByRole("button", { name: "Text", exact: true }).click();
      if (domain === "integrated")
        await page.screenshot({ path: "/tmp/tracer-model-focused-text-390.png", fullPage: true });
      await editor.getByLabel("Advanced JSON", { exact: true }).check();
      const json = editor.getByLabel("Project schema JSON", { exact: true });
      const draft = JSON.parse(await json.inputValue());
      expect(draft.relationshipTypes[route.name].workflow[index].label).toBe(
        `${route.label} · reviewed mapping`,
      );
      expect(draft.relationshipTypes[route.name].source).toEqual(rule.source);
      expect(draft.relationshipTypes[route.name].target).toEqual(rule.target);
      await json.fill("{unfinished workflow edit");
      await editor
        .getByRole("button", { name: "← Return to draft definitions", exact: true })
        .click();
      await expect(json).toBeFocused();
      await expect(json).toHaveValue("{unfinished workflow edit");
      await expect(editor.getByRole("button", { name: "Save model", exact: true })).toBeDisabled();
      draft.entityTypes[type].fields.studio_note = { type: "string" };
      await json.fill(JSON.stringify(draft, null, 2));
      await editor.getByRole("button", { name: "Visual", exact: true }).click();
      await editor.getByRole("button", { name: /Return to .* draft flow/ }).click();
      await expect(editor.locator(".schema-visual-canvas")).toBeVisible();
      await editor.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(editor).toHaveCount(0);
      const saved = (await tracer.getSchema())!;
      expect(saved.version).toBe(before.version + 1);
      expect(saved.entityTypes[type].fields.studio_note).toEqual({ type: "string" });
      expect(saved.relationshipTypes[route.name].source).toEqual(rule.source);
      expect(saved.relationshipTypes[route.name].target).toEqual(rule.target);
      await page.reload();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".model-wide-overview")).toBeVisible();
      await page.getByLabel("Focus type", { exact: true }).selectOption(type);
      await expect(page.locator(".model-wide-overview .model-flow-types>li")).toHaveCount(count);
      if (domain === "integrated")
        await page.screenshot({
          path: "/tmp/tracer-model-readable-overview-390.png",
          fullPage: true,
        });
      await page.getByRole("button", { name: "Inputs and outputs", exact: true }).click();
      await focus
        .getByRole("button", {
          name: `Inspect workflow path · ${design} → ${route.label} · reviewed mapping → ${type}`,
          exact: true,
        })
        .click();
      await expect(reading).toBeVisible();
      await expect(reading.getByRole("heading").first()).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await reading.getByRole("button", { name: /Return to .* inputs and outputs/ }).click();
      await expect(focus).toBeVisible();
      await expect(
        focus.getByRole("button", {
          name: `Inspect workflow path · ${design} → ${route.label} · reviewed mapping → ${type}`,
          exact: true,
        }),
      ).toBeFocused();
      await expect(page.getByLabel("Focus type", { exact: true })).toHaveValue(type);
      expect(errors).toEqual([]);
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
