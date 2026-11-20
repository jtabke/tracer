import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { seedScaleProject } from "../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

/** Payload budget for these synthetic fixtures, not a device/timing SLA. */
function measureOpening(page: Page) {
  const reads: { path: string; bytes: Promise<number> }[] = [];
  const collect = (response: import("@playwright/test").Response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/"))
      reads.push({ path, bytes: response.body().then((b) => b.length) });
  };
  page.on("response", collect);
  return async () => {
    page.off("response", collect);
    const paths = reads.map((r) => r.path);
    expect(paths).toContain("/api/workspace-window");
    expect(paths).not.toContain("/api/project-snapshot");
    expect(
      paths.filter((path) =>
        ["/api/history", "/api/workspace-page", "/api/workspace-event"].includes(path),
      ),
    ).toEqual([]);
    const bytes = (await Promise.all(reads.map((r) => r.bytes))).reduce((a, b) => a + b, 0);
    expect(bytes).toBeLessThan(256 * 1024);
    expect(reads.length).toBeLessThanOrEqual(8);
    const initialJsBytes = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).pathname.endsWith(".js"))
        .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0),
    );
    return { calls: reads.length, bytes, initialJsBytes };
  };
}

for (const size of ["working", "large"] as const)
  test(`main workspace searches and resumes the synthetic ${size} project with keyboard controls at 680px`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const directory = mkdtempSync(join(tmpdir(), "tracer-main-scale-"));
    const seed = await seedScaleProject(join(directory, "project"), size);
    const repository = new SQLiteRepository(seed.database);
    const tracer = new Tracer(repository);
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width: 680, height: 900 });
      const opening = measureOpening(page);
      const started = performance.now();
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible({ timeout: 60000 });
      const openMs = performance.now() - started;
      const bootstrap = await opening();
      await page.keyboard.press("/");
      const searched = performance.now();
      const search = page.getByRole("combobox", { name: "Search artifacts and commands" });
      await search.fill("Sensor cutoff changed");
      const match = page.locator("[data-result]").first();
      await expect(match).toContainText("Sensor cutoff changed to 80 degrees");
      const key = await match.getAttribute("data-result");
      await expect(search).toBeFocused();
      await expect(search).toHaveAttribute(
        "aria-activedescendant",
        (await match.getAttribute("id"))!,
      );
      await expect(match).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Enter");
      await expect(page.locator(`.node[data-key="${key}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const searchMs = performance.now() - searched;
      expect(await page.locator(".node").count()).toBeLessThanOrEqual(50);
      const matrix = page.getByRole("button", { name: "Matrix", exact: true });
      await matrix.focus();
      await expect(matrix).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("grid", { name: "Editable traceability matrix", exact: true }),
      ).toBeVisible();
      const cell = page.getByRole("gridcell").first();
      await cell.focus();
      await page.keyboard.press("F2");
      await expect(
        page.getByRole("dialog", { name: "Matrix cell editor", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.reload();
      await expect(
        page.getByRole("grid", { name: "Editable traceability matrix", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await expect(page.locator(".context")).toContainText(key!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      const metrics = {
        synthetic: true,
        bootstrap,
        size,
        artifacts: size === "large" ? 10000 : 1000,
        relationships: size === "large" ? 100000 : 5000,
        openMs: Math.round(openMs),
        searchMs: Math.round(searchMs),
      };
      console.log(JSON.stringify(metrics));
      await info.attach("synthetic-task-timings", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("a small live graph opens and saves without transferring its long edit history", async ({
  page,
}) => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
  try {
    const origin = { actor: "scale-probe" };
    await tracer.setSchema(
      { entityTypes: { item: { fields: { title: { type: "string" } } } }, relationshipTypes: {} },
      0,
      origin,
    );
    const row = await tracer.createEntity({ type: "item", key: "SINGLE", fields: {} }, 1, origin);
    for (let batch = 0; batch < 3; batch++)
      await tracer.applyChangeset(
        {
          expectedSchemaVersion: 1,
          operations: Array.from({ length: 500 }, (_, index) => ({
            op: "entity.update" as const,
            id: row.id,
            expectedVersion: 1 + batch * 500 + index,
            input: { fields: { title: `Edit ${batch}:${index}` } },
          })),
        },
        origin,
      );
    server = await startLocalServer(tracer, resolve("dist"), 0);
    const opening = measureOpening(page);
    await page.goto(server.origin);
    await expect(page.locator('.node[data-key="SINGLE"]')).toBeVisible();
    await opening();
    await page.locator('[data-action="details"]').click();
    await page.locator('[data-action="edit"]').click();
    await page.locator("#draft-title").fill("One confirmed edit");
    const reload = measureOpening(page);
    await page.locator('[data-action="apply-edit"]').click();
    await expect(page.locator('.node[data-key="SINGLE"]')).toContainText("One confirmed edit");
    await reload();
    expect((await tracer.getEntity(row.id)).version).toBe(1502);
  } finally {
    await closeTestPage(page);
    await server?.close();
    repository.close();
  }
});
