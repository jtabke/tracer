import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { CoverageExpectations } from "../src/core/coverage.ts";

test("native coverage policy survives Model Visual/Text editing, guarded schema save and reload", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-coverage-model-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository),
    actor = { actor: "coverage-model-browser" };
  await tracer.setSchema(
    {
      entityTypes: {
        requirement: { fields: { title: { type: "string" } } },
        test: { fields: { title: { type: "string" } } },
      },
      relationshipTypes: { tested_by: { fields: {}, source: ["requirement"], target: ["test"] } },
    },
    0,
    actor,
  );
  const requirement = await tracer.createEntity(
      {
        type: "requirement",
        key: "REQ-POLICY",
        fields: { title: "Native policy retention requirement" },
      },
      1,
      actor,
    ),
    protocol = await tracer.createEntity(
      { type: "test", key: "TEST-POLICY", fields: { title: "One recorded test identity" } },
      1,
      actor,
    );
  await tracer.createRelationship(
    { type: "tested_by", source: requirement.id, target: protocol.id, fields: {} },
    1,
    actor,
  );
  const expectations: CoverageExpectations = {
    test_identity: {
      name: "One explicit test identity per requirement",
      subject: { type: "requirement" },
      relationshipType: "tested_by",
      direction: "outgoing",
      related: { type: "test" },
      minimumDistinctTargets: 1,
    },
  };
  await tracer.coverage.set({ expectations, expectedSchemaVersion: 1 }, actor);
  const beforeHead = (await tracer.timeline()).head;
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${server.origin}/#model`);
    const editor = page.getByLabel("Configure project model", { exact: true });
    await editor.getByRole("button", { name: "Select type · requirement", exact: true }).click();
    await editor.getByLabel("New field name", { exact: true }).fill("policy_note");
    await editor.getByRole("button", { name: "Add field", exact: true }).click();
    await editor.getByRole("button", { name: "Text", exact: true }).click();
    await editor.getByLabel("Advanced JSON", { exact: true }).check();
    const json = editor.getByLabel("Project schema JSON", { exact: true });
    const draft = JSON.parse(await json.inputValue());
    expect(draft.coverageExpectations).toEqual(expectations);
    expect(draft.entityTypes.requirement.fields.policy_note).toEqual({ type: "string" });
    await page.setViewportSize({ width: 390, height: 844 });
    await editor.getByRole("button", { name: "Visual", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Save model", exact: true })).toBeEnabled();
    await editor.getByRole("button", { name: "Save model", exact: true }).click();
    await expect(editor).toContainText("Model saved as v3");
    const saved = await tracer.getSchema();
    expect(saved?.version).toBe(3);
    expect(saved?.coverageExpectations).toEqual(expectations);
    expect(saved?.entityTypes.requirement.fields.policy_note).toEqual({ type: "string" });
    expect((await tracer.timeline()).head).toBe(beforeHead + 1);
    await page.reload();
    await editor.getByRole("button", { name: "Text", exact: true }).click();
    await editor.getByLabel("Advanced JSON", { exact: true }).check();
    expect(JSON.parse(await json.inputValue()).coverageExpectations).toEqual(expectations);
    expect(
      (await tracer.coverage.evaluate({ expectationId: "test_identity" })).rows.items[0].state,
    ).toBe("covered");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect((await tracer.evidence.list("receipt")).items).toHaveLength(0);
  } finally {
    await closeTestPage(page, true);
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
