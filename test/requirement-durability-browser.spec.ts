import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
for (const width of [1440, 390])
  test(`REQ-003/005: confirmed edits and original project identities survive server/database restart at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-durable-ui-")),
      database = join(directory, "project.sqlite");
    let repository: SQLiteRepository | undefined = new SQLiteRepository(database),
      core = new Tracer(repository);
    let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
    const errors: string[] = [],
      origin = { actor: "foundation-browser" };
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await core.setSchema(
        {
          entityTypes: {
            item: { fields: { title: { type: "string" }, statement: { type: "string" } } },
          },
          relationshipTypes: { implemented_by: { source: ["item"], target: ["item"], fields: {} } },
        },
        0,
        origin,
      );
      const source = await core.createEntity(
        {
          type: "item",
          key: "REQ-1",
          fields: { title: "Reopen criterion", statement: "Initial criterion" },
        },
        1,
        origin,
      );
      const target = await core.createEntity(
        { type: "item", key: "ARTICLE-1", fields: { title: "Candidate article" } },
        1,
        origin,
      );
      const link = await core.createRelationship(
        { type: "implemented_by", source: source.id, target: target.id, fields: {} },
        1,
        origin,
      );
      server = await startLocalServer(core, resolve("dist"), 0);
      const url = server.origin,
        port = Number(new URL(url).port),
        before = await core.exportProject();
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url);
      await page.locator(".node").first().waitFor();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("REQ-1");
      await page.keyboard.press("Enter");
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
      await page.locator('[data-action="edit"]').click();
      await page.locator("#draft-title").fill("Saved durability criterion");
      await page
        .locator("#draft-statement")
        .fill("Confirmed content must survive reopening the same project.");
      await page.locator('[data-action="apply-edit"]').click();
      await expect(
        page.getByRole("heading", { name: "Saved durability criterion", exact: true }),
      ).toBeVisible();
      await expect(page.locator('[data-action="apply-edit"]')).toBeHidden();
      const saved = await core.exportProject();
      expect(saved.projectRevision).toBe(before.projectRevision + 1);
      const revisions = saved.provenance.revisions.filter(
        (r) => r.projectRevision === saved.projectRevision,
      );
      expect(revisions).toHaveLength(1);
      expect(revisions[0].id).toBe(source.id);
      expect(revisions[0].version).toBe(2);
      await server.close();
      server = undefined;
      repository.close();
      repository = undefined;
      repository = new SQLiteRepository(database);
      core = new Tracer(repository);
      server = await startLocalServer(core, resolve("dist"), port);
      expect(server.origin).toBe(url);
      await page.reload();
      await page.locator(".node").first().waitFor();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("REQ-1");
      await page.keyboard.press("Enter");
      await page.locator('[data-action="details"]').click();
      const afterExpand = page.getByRole("button", {
        name: "Expand artifact details",
        exact: true,
      });
      if (await afterExpand.isVisible()) await afterExpand.click();
      await expect(
        page.getByRole("heading", { name: "Saved durability criterion", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit statement", exact: true })).toContainText(
        "Confirmed content must survive reopening the same project.",
      );
      expect(await core.exportProject()).toEqual(saved);
      expect(await core.getRelationship(link.id)).toEqual(link);
      expect((await core.getProjectSnapshot()).entities.map((e) => e.id).sort()).toEqual(
        [source.id, target.id].sort(),
      );
      mkdirSync(resolve("output/foundation"), { recursive: true });
      await page.screenshot({ path: resolve(`output/foundation/reopened-${width}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server?.close();
      repository?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
