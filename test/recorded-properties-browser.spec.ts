import { closeTestPage, expect, test } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";

test("recorded project properties remain readable and survive schema-field editing", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "tracer-recorded-properties-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  const actor = { actor: "recorded-properties-check" };
  const properties = {
    deliveryStatus: "in_progress",
    verificationStatus: "not_verified",
    validationStatus: "not_validated",
    nextAction: "Complete exact-candidate acceptance audit before concluding.",
    assessed: false,
    outstanding: 0,
    optional: null,
    context: { selected: ["B", "C", "B"] },
    constructor: "An own recorded key",
  };
  await tracer.setSchema(
    {
      entityTypes: {
        work: {
          fields: {
            title: { type: "string" },
            ...Object.fromEntries(
              Object.keys(properties).map((name) => [name, { type: "json" as const }]),
            ),
          },
        },
      },
      relationshipTypes: {},
    },
    0,
    actor,
  );
  const subject = await tracer.createEntity(
    { type: "work", key: "WORK-EXACT", fields: { title: "Finish selected change", ...properties } },
    1,
    actor,
  );
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  try {
    const before = await tracer.exportProject();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(server.origin);
    async function select() {
      await expect(page.locator(".node").first()).toBeVisible();
      await page.keyboard.press("Control+k");
      await page.locator("#search").fill(subject.key!);
      await page.locator('[data-result="WORK-EXACT"]').click();
      await page.locator('[data-action="details"]').click();
      const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
      if (await expand.isVisible()) await expand.click();
    }
    await select();
    const inspector = page.getByRole("complementary", { name: "Artifact inspector", exact: true });
    const reading = inspector.getByRole("region", { name: "Recorded properties" });
    await expect(reading).toBeVisible();
    for (const value of ["in_progress", "not_verified", "not_validated", properties.nextAction])
      await expect(reading.getByText(value, { exact: true })).toBeVisible();
    for (const [name, value] of [
      ["assessed", "false"],
      ["outstanding", "0"],
      ["optional", "null"],
    ])
      await expect(reading.locator("dt").filter({ hasText: name }).locator("+ dd")).toContainText(
        value,
      );
    await expect(reading).toContainText('{"selected":["B","C","B"]}');
    await expect(reading).toContainText(properties.constructor);
    await expect(reading.getByRole("textbox")).toHaveCount(0);
    expect(await tracer.exportProject()).toEqual(before);
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button", { name: "Edit artifact", exact: true }).click();
    await page.locator("#draft-title").fill("Edited selected title");
    await page.locator('[data-action="apply-edit"]').click();
    await expect
      .poll(async () => (await tracer.getEntity(subject.id)).fields.title)
      .toBe("Edited selected title");
    expect((await tracer.getEntity(subject.id)).fields).toEqual({
      title: "Edited selected title",
      ...properties,
    });
    await page.reload();
    await select();
    await expect(reading).toContainText(properties.nextAction);
    await expect(reading).toContainText("not_validated");
  } finally {
    await closeTestPage(page);
    await server.close();
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
