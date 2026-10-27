import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

for (const width of [1440, 680, 390]) {
  test(`graph cards contain long keys, titles and type labels at ${width}px`, async ({
    page,
  }, info) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-graph-cards-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    const provenance = { actor: "graph-card-check" };
    const type = "engineering_reference_with_a_long_type_name";
    const fields = { title: { type: "string" as const, required: true } };
    await tracer.setSchema({
      schema: {
        entityTypes: { requirement: { fields }, [type]: { fields } },
        relationshipTypes: {
          references: { source: ["requirement"], target: [type], fields: {} },
        },
      },
      expectedVersion: 0,
      provenance,
    });
    const root = await tracer.createEntity({
      type: "requirement",
      key: "TR-CARD-ROOT",
      fields: { title: "Inspect graph card typography" },
      expectedSchemaVersion: 1,
      provenance,
    });
    const records = [
      { key: "ART-REGISTER-BOOTSTRAP", title: "Captured initial project model and records" },
      { key: "REFERENCE".repeat(6), title: "UnbrokenTitle".repeat(12) },
    ];
    for (const record of records) {
      const target = await tracer.createEntity({
        type,
        key: record.key,
        fields: { title: record.title },
        expectedSchemaVersion: 1,
        provenance,
      });
      await tracer.createRelationship({
        type: "references",
        source: root.id,
        target: target.id,
        fields: {},
        expectedSchemaVersion: 1,
        provenance,
      });
    }
    const revision = (await tracer.getProjectSnapshot()).projectRevision;
    const server = await startLocalServer(tracer, resolve("dist"), 0);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill(root.key!);
      await page.keyboard.press("Enter");
      await expect(page.locator(".node")).toHaveCount(3);
      await page.getByRole("button", { name: "Close inspector", exact: true }).click();
      for (const density of ["compact", "expanded", "overview"]) {
        await page.getByLabel("Node detail", { exact: true }).selectOption(density);
        for (const action of ["Fit", "Zoom in", ...Array<string>(8).fill("Zoom out")]) {
          await page.getByRole("button", { name: action, exact: true }).click();
          for (const record of records) {
            const node = page.locator(`.node[data-key="${record.key}"]`);
            await expect(node).toHaveAccessibleName(`${record.key}: ${record.title}`);
            await expect(node).toHaveAttribute("title", `${record.key}: ${record.title}`);
            const geometry = await node.evaluate((element) => {
              const card = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              const scale = card.width / (element as HTMLElement).offsetWidth;
              const bottom = card.bottom - (parseFloat(style.paddingBottom) + 1) * scale;
              const children = Array.from(
                element.querySelectorAll(".node-meta, strong, .node-type"),
              )
                .filter((child) => getComputedStyle(child).display !== "none")
                .map((child) => {
                  const bounds = child.getBoundingClientRect();
                  return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    left: bounds.left,
                    right: bounds.right,
                  };
                });
              const key = element.querySelector(".mono")!;
              const keyBounds = key.getBoundingClientRect();
              return {
                contained: children.every(
                  (child) =>
                    child.top >= card.top &&
                    child.bottom <= bottom + 1 &&
                    child.left >= card.left &&
                    child.right <= card.right,
                ),
                containedKey: keyBounds.left >= card.left && keyBounds.right <= card.right,
                singleLineKey:
                  key.getBoundingClientRect().height <=
                  parseFloat(getComputedStyle(key).lineHeight) * scale + 1,
                ordered: children.every(
                  (child, index) => index === 0 || child.top >= children[index - 1].bottom,
                ),
              };
            });
            expect(geometry, `${density} / ${action} / ${record.key}`).toEqual({
              contained: true,
              containedKey: true,
              singleLineKey: true,
              ordered: true,
            });
          }
        }
        await page.getByRole("button", { name: "Fit", exact: true }).click();
        await page.screenshot({ path: info.outputPath(`${density}.png`) });
      }
      expect((await tracer.getProjectSnapshot()).projectRevision).toBe(revision);
    } finally {
      await closeTestPage(page);
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
