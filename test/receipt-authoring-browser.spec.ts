import { test as base, expect, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Entity, Relationship, Schema } from "../src/core/model.ts";
import type { Receipt } from "../src/core/evidence.ts";
import { openView, receiptInputEditor } from "./browser-navigation.ts";

const actor = { actor: "receipt-authoring-browser" };
const schema: Schema = {
  entityTypes: {
    item: {
      fields: {
        title: { type: "string" },
        statement: { type: "string" },
        threshold: { type: "string" },
        legacy: { type: "string" },
      },
    },
  },
  relationshipTypes: { depends_on: { fields: { rationale: { type: "string" } } } },
};
type Fixture = {
  tracer: Tracer;
  origin: string;
  output: Entity;
  middle: Entity;
  input: Entity;
  other: Entity;
  links: Relationship[];
};
const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-receipt-authoring-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema(schema, 0, actor);
    const create = (key: string, statement: string, extra = {}) =>
      tracer.createEntity(
        {
          type: "item",
          key,
          fields: { title: `${key} human title`, statement, threshold: "10 ms", ...extra },
        },
        1,
        actor,
      );
    const output = await create(
        "RESULT",
        "Confirm the integrated design meets the response criterion.",
      ),
      middle = await create("DESIGN", "The interrupt-driven design prioritizes the response path."),
      input = await create("REQ", "The response shall arrive within ten milliseconds."),
      originalOther = await create(
        "HISTORY",
        "Original archived criterion with its original schema.",
        { legacy: "Archived legacy acceptance value" },
      );
    const other = await tracer.updateEntity(
      originalOther.id,
      1,
      {
        fields: {
          title: "HISTORY human title",
          statement: "Current criterion; archived schema remains distinct.",
          threshold: "12 ms",
        },
      },
      1,
      actor,
    );
    await tracer.setSchema(
      {
        ...schema,
        entityTypes: {
          item: {
            fields: {
              title: { type: "string" },
              statement: { type: "string" },
              threshold: { type: "string" },
              current_only: { type: "string" },
            },
          },
        },
      },
      1,
      actor,
    );
    const link = (source: Entity, target: Entity) =>
      tracer.createRelationship(
        {
          type: "depends_on",
          source: source.id,
          target: target.id,
          fields: { rationale: "Explicit engineering dependency" },
        },
        2,
        actor,
      );
    const links = [
      await link(output, middle),
      await link(middle, input),
      await link(input, output),
    ];
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ tracer, origin: server.origin, output, middle, input, other, links });
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});

async function openAuthor(page: Page, fixture: Fixture) {
  await page.goto(fixture.origin);
  await openView(page, "Evidence");
  await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
  await page.getByLabel("Output or conclusion", { exact: true }).selectOption(fixture.output.id);
  await page
    .getByLabel("Outcome", { exact: true })
    .fill("Measured pass for the exact declared input scope.");
  await receiptInputEditor(page)
    .getByLabel("Input entity", { exact: true })
    .selectOption(fixture.input.id);
}
async function addHop(page: Page, id: string) {
  const editor = receiptInputEditor(page);
  await editor.getByLabel("Next path connection", { exact: true }).selectOption(id);
  await expect(editor.getByLabel("Next path target context", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Add selected path step", exact: true }).click();
}

for (const width of [1440, 390])
  test(`native multi-input path, archived field scope, explicit drift and retained Return at ${width}px`, async ({
    page,
    fixture,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openAuthor(page, fixture);
    const editor = receiptInputEditor(page),
      record = page.getByRole("button", { name: "Record receipt", exact: true });
    await expect(editor.getByLabel("Input captured context", { exact: true })).toContainText(
      fixture.input.fields.statement as string,
    );
    await editor.getByRole("radio", { name: "Selected fields", exact: true }).check();
    await expect(record).toBeDisabled();
    await editor.getByRole("checkbox", { name: "Include field statement", exact: true }).check();
    await editor.getByRole("checkbox", { name: "Include field threshold", exact: true }).check();
    await expect(editor.getByLabel("Native field scope", { exact: true })).toContainText("10 ms");
    await editor.getByRole("radio", { name: "Recorded path", exact: true }).check();
    await expect(record).toBeDisabled();
    await expect(editor.getByLabel("Next path connection").locator("option")).toHaveCount(2);
    await addHop(page, fixture.links[0].id);
    await expect(record).toBeDisabled();
    await addHop(page, fixture.links[1].id);
    await expect(
      editor.getByText("Complete forward path to the selected input.", { exact: true }),
    ).toBeVisible();
    await expect(record).toBeEnabled();
    await page.getByRole("button", { name: "Add declared input", exact: true }).click();
    await editor.getByLabel("Input entity", { exact: true }).selectOption(fixture.other.id);
    await editor.getByRole("button", { name: "Browse recorded versions", exact: true }).click();
    await editor.getByLabel("Input revision", { exact: true }).selectOption("1");
    await expect(editor.getByLabel("Input captured context", { exact: true })).toContainText(
      "Original archived criterion",
    );
    await editor.getByRole("radio", { name: "Selected fields", exact: true }).check();
    await expect(
      editor.getByRole("checkbox", { name: "Include field current_only", exact: true }),
    ).toHaveCount(0);
    await editor.getByRole("checkbox", { name: "Include field legacy", exact: true }).check();
    await expect(editor.getByLabel("Native field scope", { exact: true })).toContainText(
      "Archived legacy acceptance value",
    );
    await expect(editor.getByRole("radio", { name: "Recorded path", exact: true })).toHaveCount(0);
    await expect(record).toBeEnabled();
    const list = page.getByLabel("Complete declared input drafts", { exact: true });
    await expect(list.getByRole("button", { name: /^Edit input / })).toHaveCount(2);
    const editBox = (await editor.boundingBox())!,
      listBox = (await list.boundingBox())!;
    if (width === 390) {
      expect(editBox.y + editBox.height).toBeLessThanOrEqual(listBox.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    } else expect(editBox.x).toBeGreaterThan(listBox.x + listBox.width);
    await page.screenshot({ path: `/tmp/tracer-receipt-authoring-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Return to recorded evaluations", exact: true }).click();
    await openView(page, "Model");
    await openView(page, "Evidence");
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue(
      "Measured pass for the exact declared input scope.",
    );
    await expect(
      editor.getByRole("checkbox", { name: "Include field legacy", exact: true }),
    ).toBeChecked();
    await list.getByRole("button", { name: "Edit input 1: REQ", exact: true }).click();
    await expect(
      editor.getByRole("checkbox", { name: "Include field threshold", exact: true }),
    ).toBeChecked();
    await expect(
      editor.getByText("Complete forward path to the selected input.", { exact: true }),
    ).toBeVisible();
    await fixture.tracer.updateEntity(
      fixture.input.id,
      1,
      {
        fields: {
          ...fixture.input.fields,
          statement: "Current response criterion changed deliberately.",
        },
      },
      2,
      actor,
    );
    await fixture.tracer.updateEntity(
      fixture.output.id,
      1,
      {
        fields: {
          ...fixture.output.fields,
          statement: "Current output conclusion changed deliberately.",
        },
      },
      2,
      actor,
    );
    await fixture.tracer.updateRelationship(
      fixture.links[0].id,
      1,
      {
        type: fixture.links[0].type,
        source: fixture.links[0].source,
        target: fixture.links[0].target,
        fields: { rationale: "Changed selected connection rationale" },
      },
      2,
      actor,
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(record).toBeDisabled();
    await expect(editor.getByLabel("Native field scope", { exact: true })).toContainText(
      fixture.input.fields.statement as string,
    );
    expect((await editor.innerText()).split(fixture.input.fields.statement as string)).toHaveLength(
      2,
    );
    await expect(page.getByLabel("Output captured context", { exact: true })).toContainText(
      fixture.output.fields.statement as string,
    );
    await expect(
      editor.getByRole("button", { name: "Use current path", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use current output", exact: true }).click();
    await expect(editor.getByRole("button", { name: /Remove path step/ })).toHaveCount(2);
    await editor.getByRole("button", { name: "Use current input", exact: true }).click();
    await expect(
      editor.getByRole("checkbox", { name: "Include field statement", exact: true }),
    ).toBeChecked();
    await editor.getByRole("button", { name: "Use current path", exact: true }).click();
    await expect(record).toBeEnabled();
    const request = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/api/receipts" && request.method() === "POST",
    );
    await record.click();
    const declaration = (await request).postDataJSON();
    expect(declaration.expectedOutputVersion).toBe(2);
    expect(declaration.inputs[0]).toEqual({
      entityId: fixture.input.id,
      expectedVersion: 2,
      fields: ["statement", "threshold"],
      path: fixture.links.slice(0, 2).map((link) => link.id),
      expectedPathVersions: [2, 1],
    });
    expect(declaration.inputs[1]).toEqual({
      entityId: fixture.other.id,
      revision: 1,
      fields: ["legacy"],
    });
    await expect
      .poll(async () => (await fixture.tracer.evidence.list("receipt")).items.length)
      .toBe(1);
    const receipt = (await fixture.tracer.evidence.list("receipt")).items[0] as Receipt;
    expect(receipt.inputs[0].links.map((link) => link.version)).toEqual([2, 1]);
    expect(receipt.inputs[1].entity.fields.legacy).toBe("Archived legacy acceptance value");
  });

test("failed authoritative read retains captured content and paused recording until recovery", async ({
  page,
  fixture,
}) => {
  await openAuthor(page, fixture);
  const editor = receiptInputEditor(page),
    record = page.getByRole("button", { name: "Record receipt", exact: true });
  await expect(record).toBeEnabled();
  await page.route("**/api/work?*", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(record).toBeDisabled();
  await expect(editor.getByLabel("Input captured context", { exact: true })).toContainText(
    fixture.input.fields.statement as string,
  );
  await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue(
    "Measured pass for the exact declared input scope.",
  );
  await page.unroute("**/api/work?*");
  await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
  await expect(record).toBeEnabled();
  expect((await fixture.tracer.evidence.list("receipt")).items).toHaveLength(0);
});
