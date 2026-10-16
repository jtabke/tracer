import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { openView, receiptInputEditor, showProjectBrowser } from "./browser-navigation.ts";

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-mutation-recovery-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  const actor = { actor: "test" };
  await tracer.setSchema(
    {
      entityTypes: {
        item: {
          fields: Object.fromEntries([
            ["title", { type: "string" }],
            ["constructor", { type: "string" }],
            ["toString", { type: "number" }],
            ["__proto__", { type: "json" }],
          ]),
        },
      },
      relationshipTypes: {},
    },
    0,
    actor,
  );
  const source = await tracer.createEntity(
    { type: "item", key: "SOURCE", fields: { title: "Source" } },
    1,
    actor,
  );
  const output = await tracer.createEntity(
    { type: "item", key: "OUTPUT", fields: { title: "Output" } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  return { directory, repository, tracer, server, source, output };
}

test("a committed item with a lost response keeps its identity and requires successful inspection before retry", async ({
  page,
}) => {
  const value = await fixture();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(value.server.origin);
    await showProjectBrowser(page);
    await page.getByRole("button", { name: "New item", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create item", exact: true });
    for (const name of ["constructor", "toString", "__proto__"])
      await expect(dialog.getByLabel(`Draft ${name}`, { exact: true })).toHaveValue("");
    await dialog.getByLabel("Draft title", { exact: true }).fill("Retained unkeyed item");
    let poison = true;
    await page.route("**/api/changesets", async (route) => {
      if (!poison) return route.continue();
      poison = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({ response, body: "unreadable response" });
    });
    const create = dialog.getByRole("button", { name: "Create item", exact: true });
    await create.click();
    await expect(create).toBeDisabled();
    await expect(dialog.getByLabel("Draft title", { exact: true })).toHaveValue(
      "Retained unkeyed item",
    );
    expect(
      (await value.tracer.queryEntities({ search: "Retained unkeyed item" })).items,
    ).toHaveLength(1);
    const recovery = dialog.getByRole("region", { name: "Save recovery", exact: true });
    const resume = recovery.getByRole("button", {
      name: "I inspected saved records; continue editing",
      exact: true,
    });
    await expect(recovery).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press("Tab");
    await expect(
      recovery.getByRole("button", { name: "Refresh saved records", exact: true }),
    ).toBeFocused();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: "/tmp/tracer-hardening-recovery390.png", fullPage: true });
    await expect(resume).toBeDisabled();
    await page.route("**/api/history?*", (route) => route.abort());
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery.getByRole("alert").last()).toContainText("Could not read the project");
    await expect(resume).toBeDisabled();
    await page.unroute("**/api/history?*");
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery).toContainText("Retained unkeyed item");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: "/tmp/tracer-hardening-recovery1440.png", fullPage: true });
    await resume.click();
    await expect(create).toBeEnabled();
    await create.click();
    await expect(dialog).toContainText("conflict");
    expect(
      (await value.tracer.queryEntities({ search: "Retained unkeyed item" })).items,
    ).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await closeTestPage(page, true);
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("receipt uncertainty and failed Evidence reads pause writes while retaining the authored outcome", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(value.server.origin);
    await openView(page, "Evidence");
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await page.getByLabel("Output or conclusion", { exact: true }).selectOption(value.output.id);
    await receiptInputEditor(page)
      .getByLabel("Input entity", { exact: true })
      .selectOption(value.source.id);
    await page.getByLabel("Outcome", { exact: true }).fill("Retained evaluation rationale");
    let poison = true;
    await page.route("**/api/receipts", async (route) => {
      if (!poison) return route.continue();
      poison = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      // Parseable but structurally invalid successful responses are also unknown outcomes.
      await route.fulfill({ response, body: JSON.stringify({ id: "incomplete receipt" }) });
    });
    const record = page.getByRole("button", { name: "Record receipt", exact: true });
    await record.click();
    await expect(record).toBeDisabled();
    expect((await value.tracer.evidence.list("receipt")).items).toHaveLength(1);
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery).toContainText("Retained evaluation rationale");
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await expect(record).toBeEnabled();
    expect((await value.tracer.evidence.list("receipt")).items).toHaveLength(1);
    await page.route("**/api/work?*", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("read_failed");
    await expect(record).toBeDisabled();
    await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue(
      "Retained evaluation rationale",
    );
    await page.unroute("**/api/work?*");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(record).toBeEnabled();
    expect((await value.tracer.evidence.list("receipt")).items).toHaveLength(1);
  } finally {
    await closeTestPage(page, true);
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("Table creation retains its identity after uncertainty and explicit draft discard starts a new creation", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(value.server.origin);
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await page.getByLabel("New title", { exact: true }).fill("Captured Table proposal");
    let poison = true;
    await page.route("**/api/changesets", async (route) => {
      if (!poison) return route.continue();
      poison = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({ response, body: "unreadable response" });
    });
    const add = page.getByRole("button", { name: "Add entity", exact: true });
    await add.click();
    await expect(add).toBeDisabled();
    expect(
      (await value.tracer.queryEntities({ search: "Captured Table proposal" })).items,
    ).toHaveLength(1);
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await add.click();
    await expect(page.getByRole("alert").first()).toContainText("conflict");
    expect(
      (await value.tracer.queryEntities({ search: "Captured Table proposal" })).items,
    ).toHaveLength(1);
    await page.getByRole("button", { name: "Discard new item draft", exact: true }).click();
    await expect(page.getByLabel("New title", { exact: true })).toHaveValue("");
    await page.getByLabel("New title", { exact: true }).fill("A different Table proposal");
    await add.click();
    await expect
      .poll(
        async () =>
          (await value.tracer.queryEntities({ search: "A different Table proposal" })).items.length,
      )
      .toBe(1);
  } finally {
    await closeTestPage(page, true);
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});
