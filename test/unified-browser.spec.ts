import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const domain of ["integrated", "medical", "technology"] as const) {
  test(`${domain}: same native map, table, retained editing and persisted data`, async ({
    page,
  }) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-unified-browser-"));
    const project = await seedRealisticProject(join(parent, "project"), domain);
    const repository = new SQLiteRepository(project.database),
      core = new Tracer(repository);
    const server = await startLocalServer(core, resolve("dist"), 0);
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    try {
      const snapshot = await core.getProjectSnapshot();
      const subject = snapshot.entities.find(
        (item) =>
          item.key ===
          (domain === "medical" ? "PRS-01" : domain === "integrated" ? "REQ-R01" : "CAP-01"),
      )!;
      await page.goto(server.origin + "/?workspace=map");
      await expect(page.getByRole("heading", { name: "Data model", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Project navigation" })).toContainText(
        "Development map",
      );
      await page.getByRole("searchbox", { name: "Find an item" }).fill(subject.key!);
      await page
        .getByRole("button")
        .filter({ hasText: new RegExp(`^${subject.key} ·`) })
        .click();
      await expect(
        page.getByRole("heading", { name: `Trace · ${subject.key}`, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Items table", exact: true }).click();
      await expect(page.getByRole("table")).toContainText(subject.key!);
      await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Project task" });
      await expect(dialog).toContainText(subject.key!);
      await dialog.getByRole("button", { name: "Edit item", exact: true }).click();
      await dialog.getByLabel("Item title", { exact: true }).fill(`Saved ${domain} title`);
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
      await expect(dialog.getByLabel("Item title", { exact: true })).toHaveValue(
        `Saved ${domain} title`,
      );
      await dialog.getByRole("button", { name: "Save item", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await core.getProjectSnapshot()).entities.find((item) => item.id === subject.id)!
              .fields.title,
        )
        .toBe(`Saved ${domain} title`);
      await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      await page.reload();
      await page.getByRole("searchbox", { name: "Find an item" }).fill(subject.key!);
      await expect(
        page.getByRole("button").filter({ hasText: new RegExp(`^${subject.key} ·`) }),
      ).toContainText(`Saved ${domain} title`);
      expect(problems).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });
}

test("project picker isolates databases and cancels switching without losing the map", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-unified-projects-"));
  const one = await seedRealisticProject(join(parent, "orbit"), "integrated"),
    two = await seedRealisticProject(join(parent, "aster"), "medical");
  const a = new SQLiteRepository(one.database),
    b = new SQLiteRepository(two.database);
  const core = new Tracer(a),
    other = new Tracer(b);
  const server = await startLocalServer(core, resolve("dist"), 0, undefined, [
    { id: "second", title: "Aster Home BP", tracer: other },
  ]);
  try {
    await page.goto(server.origin + "/?workspace=map");
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue("default");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByLabel("Project", { exact: true }).selectOption("second");
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue("default");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("Project", { exact: true }).selectOption("second");
    await expect(page).toHaveURL(/project=second/);
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue("second");
    await page.getByRole("searchbox", { name: "Find an item" }).fill("PRS-01");
    await expect(page.getByRole("button").filter({ hasText: /^PRS-01 ·/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Find an item" }).fill("REQ-R01");
    await expect(page.getByLabel("Search results")).toContainText("0 matches");
    expect((await core.getProjectSnapshot()).entities.some((item) => item.key === "PRS-01")).toBe(
      false,
    );
  } finally {
    await closeTestPage(page);
    await server.close();
    a.close();
    b.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("failed native reads retain the map and disable writes; empty projects configure in the same shell", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-unified-empty-"));
  const repository = new SQLiteRepository(join(parent, "empty.sqlite"));
  const server = await startLocalServer(new Tracer(repository), resolve("dist"), 0);
  try {
    await page.goto(server.origin + "/?workspace=map");
    await expect(page.getByRole("button", { name: "Configure model", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Configure model", exact: true }).click();
    await expect(page.locator(".model-page")).toContainText("Configure model");
    await page.getByRole("button", { name: /Return to (map|workspace)/ }).click();
    await page.route("**/api/project-snapshot", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh project", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("previous map is retained");
    await page.unroute("**/api/project-snapshot");
    await page.getByRole("button", { name: "Refresh project", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a lost save response retains the proposal and pauses all native editing until inspection", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-unified-uncertain-"));
  const project = await seedRealisticProject(join(parent, "project"), "integrated");
  const repository = new SQLiteRepository(project.database),
    core = new Tracer(repository);
  const server = await startLocalServer(core, resolve("dist"), 0);
  try {
    await page.goto(server.origin + "/?workspace=map");
    await page.getByRole("searchbox", { name: "Find an item" }).fill("REQ-R01");
    await page
      .getByRole("button")
      .filter({ hasText: /^REQ-R01 ·/ })
      .click();
    await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Edit item", exact: true }).click();
    await dialog.getByLabel("Item title", { exact: true }).fill("Unknown-response retained title");
    await page.route("**/api/changesets", async (route) => {
      await route.fetch();
      await route.abort();
    });
    await dialog.getByRole("button", { name: "Save item", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "Save recovery" })).toContainText(
      "outcome is unknown",
    );
    await expect(dialog.getByLabel("Item title", { exact: true })).toHaveValue(
      "Unknown-response retained title",
    );
    await expect(dialog.getByRole("button", { name: "Save item", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(
      dialog.getByRole("button", {
        name: "I inspected saved records; continue editing",
        exact: true,
      }),
    ).toBeEnabled();
    await expect
      .poll(
        async () =>
          (await core.getProjectSnapshot()).entities.find((item) => item.key === "REQ-R01")!.fields
            .title,
      )
      .toBe("Unknown-response retained title");
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

for (const width of [390, 1440])
  test(`shared native map and task return remain usable at ${width}px`, async ({ page }) => {
    const parent = mkdtempSync(join(tmpdir(), "tracer-unified-responsive-"));
    const project = await seedRealisticProject(join(parent, "project"), "medical");
    const repository = new SQLiteRepository(project.database);
    const server = await startLocalServer(new Tracer(repository), resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin + "/?workspace=map");
      await page.getByRole("searchbox", { name: "Find an item" }).fill("PRS-01");
      await page
        .getByRole("button")
        .filter({ hasText: /^PRS-01 ·/ })
        .click();
      if (width === 390)
        await page.getByRole("button", { name: "Item details", exact: true }).click();
      await page.getByRole("button", { name: "Edit item and connections", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("PRS-01");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      if (width === 390) {
        await page.getByText("Project tools", { exact: true }).click();
        await page.getByRole("button", { name: "Configure model", exact: true }).click();
        await expect(page.locator(".model-page")).toContainText("Configure model");
        await page.getByRole("button", { name: /Return to (map|workspace)/ }).click();
      }
      await expect(
        page.getByRole("heading", { name: "Trace · PRS-01", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(parent, { recursive: true, force: true });
    }
  });

test("native creation retains a stale-schema proposal, adopts explicitly, and saves exactly once", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-unified-create-"));
  const repository = new SQLiteRepository(join(parent, "project.sqlite")),
    core = new Tracer(repository);
  const schema = {
    entityTypes: {
      item: {
        fields: {
          title: { type: "string" as const, required: true },
          statement: { type: "string" as const },
        },
      },
    },
    relationshipTypes: {},
  };
  await core.setSchema(schema, 0, { actor: "test" });
  const server = await startLocalServer(core, resolve("dist"), 0);
  try {
    await page.goto(server.origin + "/?workspace=map");
    await page.getByRole("button", { name: "New item", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New record title", { exact: true }).fill("New native item");
    await core.setSchema(
      {
        ...schema,
        entityTypes: {
          item: { fields: { ...schema.entityTypes.item.fields, note: { type: "string" } } },
        },
      },
      1,
      { actor: "test" },
    );
    await dialog.getByRole("button", { name: "Create record", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(/schema|model/i);
    await expect(dialog.getByLabel("New record title", { exact: true })).toHaveValue(
      "New native item",
    );
    expect((await core.getProjectSnapshot()).entities).toHaveLength(0);
    await dialog.getByRole("button", { name: /Return to (map|workspace)/ }).click();
    await page.getByRole("button", { name: "Refresh project", exact: true }).click();
    await page.getByRole("button", { name: "New item", exact: true }).click();
    await dialog.getByRole("button", { name: "Use current model", exact: true }).click();
    await expect(dialog.getByLabel("New record title", { exact: true })).toHaveValue(
      "New native item",
    );
    await dialog.getByRole("button", { name: "Create record", exact: true }).click();
    await expect.poll(async () => (await core.getProjectSnapshot()).entities.length).toBe(1);
    expect((await core.getProjectSnapshot()).entities[0].fields.title).toBe("New native item");
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
