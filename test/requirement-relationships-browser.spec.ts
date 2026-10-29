import { openProjectDestination } from "./project-navigation.ts";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
for (const width of [1440, 390])
  test(`REQ-002: author endpoint rules, connect permitted records and retain rejected constraints at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-req002-ui-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite")),
      t = new Tracer(repository);
    const origin = { actor: "req002-browser" };
    await t.setSchema(
      {
        entityTypes: Object.fromEntries(
          ["need", "component", "other"].map((type) => [
            type,
            { fields: { title: { type: "string" } } },
          ]),
        ),
        relationshipTypes: {},
      },
      0,
      origin,
    );
    const source = await t.createEntity(
      { type: "need", key: "NEED-1", fields: { title: "Power supply compatibility" } },
      1,
      origin,
    );
    const target = await t.createEntity(
      { type: "component", key: "COMP-1", fields: { title: "Power supply" } },
      1,
      origin,
    );
    await t.createEntity(
      { type: "other", key: "OTHER-1", fields: { title: "Unrelated record" } },
      1,
      origin,
    );
    const server = await startLocalServer(t, resolve("dist"), 0),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin + "/#model");
      const model = page.locator(".model-page");
      await model.getByRole("button", { name: "Text", exact: true }).click();
      await model.getByLabel("Definition kind", { exact: true }).selectOption("relationshipTypes");
      for (const name of ["allocated_to", "unrestricted", "no_sources", "no_targets"]) {
        await model.getByLabel("New definition name", { exact: true }).fill(name);
        await model.getByRole("button", { name: "Add definition", exact: true }).click();
        const sources = model.getByRole("group", { name: "Sources", exact: true }),
          targets = model.getByRole("group", { name: "Targets", exact: true });
        if (name === "allocated_to") {
          await sources.getByLabel("Selected types", { exact: true }).check();
          await sources.getByLabel("need", { exact: true }).check();
          await targets.getByLabel("Selected types", { exact: true }).check();
          await targets.getByLabel("component", { exact: true }).check();
        } else if (name === "no_sources") {
          await sources.getByLabel("Selected types", { exact: true }).check();
          await sources.getByLabel("need", { exact: true }).check();
          await sources.getByLabel("need", { exact: true }).uncheck();
          await expect(sources).toContainText("Zero selected allows no source types");
        } else if (name === "no_targets") {
          await targets.getByLabel("No types", { exact: true }).check();
        } else {
          await expect(sources.getByLabel("Any type", { exact: true })).toBeChecked();
          await expect(targets.getByLabel("Any type", { exact: true })).toBeChecked();
        }
        await model
          .getByRole("button", { name: "← Return to draft definitions", exact: true })
          .click();
      }
      await model.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(model.getByRole("status")).toContainText("Model saved as v2");
      const schema = await t.getSchema();
      expect(schema?.relationshipTypes).toEqual({
        allocated_to: { source: ["need"], target: ["component"], fields: {} },
        unrestricted: { fields: {} },
        no_sources: { source: [], fields: {} },
        no_targets: { target: [], fields: {} },
      });
      await page.reload();
      await model.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await page.locator(".node").first().waitFor();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("NEED-1");
      await page.keyboard.press("Enter");
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.getByRole("button", { name: "Add relationship", exact: true }).click();
      const form = page.locator("#connection-form"),
        type = form.locator("#connection-type");
      await form.locator("#connection-target").fill("OTHER-1");
      await expect(type).toHaveValue("unrestricted");
      await expect(type.locator("option")).toHaveCount(1);
      await form.locator("#connection-source").fill("COMP-1");
      await form.locator("#connection-target").fill("NEED-1");
      await expect(type).toHaveValue("unrestricted");
      await expect(type.locator("option")).toHaveCount(1);
      await form.locator("#connection-source").fill("NEED-1");
      await form.locator("#connection-target").fill("COMP-1");
      await type.selectOption("allocated_to");
      mkdirSync(resolve("output/req002-audit"), { recursive: true });
      await page.screenshot({ path: resolve(`output/req002-audit/connection-${width}.png`) });
      await form.locator('button[type="submit"]').click();
      await expect
        .poll(async () => (await t.queryRelationships({ type: "allocated_to" })).items.length)
        .toBe(1);
      const link = (await t.queryRelationships({ type: "allocated_to" })).items[0];
      expect(link.source).toBe(source.id);
      expect(link.target).toBe(target.id);
      await expect(form).toBeHidden();
      await page.reload();
      expect(await t.getRelationship(link.id)).toEqual(link);
      await openProjectDestination(page, "Model");
      await model.getByRole("button", { name: "Text", exact: true }).click();
      await model.getByLabel("Advanced JSON", { exact: true }).check();
      const input = model.getByLabel("Project schema JSON", { exact: true });
      const invalid = JSON.parse(await input.inputValue());
      invalid.relationshipTypes.allocated_to.target = [];
      const proposal = JSON.stringify(invalid, null, 2),
        before = await t.exportProject();
      await input.fill(proposal);
      await model.getByRole("button", { name: "Save model", exact: true }).click();
      await expect(model.getByRole("alert").first()).toContainText("Invalid target type");
      await expect(input).toHaveValue(proposal);
      expect(await t.exportProject()).toEqual(before);
      expect(await t.getRelationship(link.id)).toEqual(link);
      await page.screenshot({ path: resolve(`output/req002-audit/rejected-model-${width}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
