import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, closeTestPage } from "./browser-test.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Relationship } from "../src/core/model.ts";
for (const width of [1440, 390])
  test(`evidence explains resource state and scoped pins without modifying the project at ${width}px`, async ({
    page,
  }) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-evidence-presentation-"));
    const repo = new SQLiteRepository(join(directory, "project.sqlite"));
    const t = new Tracer(repo, undefined, observeLocal),
      origin = { actor: "presentation-check" };
    await t.setSchema(
      {
        entityTypes: { need: { fields: { title: { type: "string" } } } },
        relationshipTypes: {
          cites: {
            source: ["need"],
            target: [],
            reference: true,
            resourceTarget: true,
            fields: {},
          },
        },
      },
      0,
      origin,
    );
    const subject = await t.createEntity(
      { type: "need", key: "NEED-1", fields: { title: "Power consumption" } },
      1,
      origin,
    );
    const result = await t.applyChangeset(
      {
        commandId: "create-reference",
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "reference.create",
            input: {
              type: "cites",
              source: subject.id,
              sourceVersion: subject.version,
              resource: {
                label: "Customer power specification",
                source: { system: "file", externalId: "customer-power-specification" },
              },
              fields: {},
              reference: {
                role: "definition",
                explanation: "Defines the maximum operating power.",
                selector: { kind: "section", value: "4.2 · Power threshold" },
                state: { mode: "current" },
              },
            },
          },
        ],
      },
      origin,
    );
    const ref = result.results[0] as Relationship,
      resourceId = ref.target;
    const file = join(directory, "customer-specification-with-a-long-path-name.md");
    writeFileSync(file, "4.2 Maximum power 20 W\n");
    const captured = await t.evidence.observe(
      { entityId: resourceId, locator: { system: "file", path: file } },
      origin,
    );
    const pinned = await t.updateRelationship(
      ref.id,
      ref.version,
      {
        ...ref,
        reference: { ...ref.reference!, state: { mode: "pinned", observationId: captured.id } },
      },
      1,
      origin,
    );
    const other = await t.createRelationship(
      {
        type: "cites",
        source: subject.id,
        target: resourceId,
        fields: {},
        reference: {
          role: "support",
          explanation: "Separate passage, separate use.",
          selector: { kind: "section", value: "5 · Operating conditions" },
          state: { mode: "current" },
        },
      },
      1,
      origin,
    );
    const receipt = await t.evidence.recordReceipt(
      {
        outputId: subject.id,
        outcome: "Simulated PASS for captured 20 W criterion; source changes require assessment.",
        inputs: [{ entityId: resourceId, observationId: captured.id, role: "design input" }],
        relationshipInputs: [
          { id: pinned.id, role: "acceptance basis" },
          { id: other.id, role: "context" },
        ],
      },
      origin,
    );
    writeFileSync(file, "4.2 Maximum power 18 W\n");
    const latest = await t.evidence.observe(
      { entityId: resourceId, locator: { system: "file", path: file } },
      origin,
    );
    const before = await t.exportProject(),
      errors: string[] = [];
    const server = await startLocalServer(t, resolve("dist"), 0);
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await expect(page.locator(".node").first()).toBeVisible();
      await page.keyboard.press("/");
      await page.getByRole("combobox", { name: "Search artifacts and commands" }).fill("NEED-1");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Review changed evidence", exact: true }).click();
      const selected = page.getByRole("region", { name: "Selected input comparison", exact: true });
      await expect(
        selected.getByRole("heading", { name: /Customer power specification/ }),
      ).toBeVisible();
      await expect(
        selected.getByText("Native record · Captured v1 → Current v1", { exact: true }),
      ).toBeVisible();
      const content = selected.getByRole("region", {
        name: "Observed content comparison",
        exact: true,
      });
      await expect(
        content
          .getByRole("region", { name: "Captured for this evaluation", exact: true })
          .getByText(captured.hash!, { exact: true }),
      ).toBeVisible();
      await expect(
        content
          .getByRole("region", { name: "Latest observed", exact: true })
          .getByText(latest.hash!, { exact: true }),
      ).toBeVisible();
      await expect(content.getByText(/passage relevance remains unknown/)).toBeVisible();
      await expect(selected.locator(".evidence-statement-comparison")).toHaveCount(0);
      const refs = page.getByRole("region", { name: "Declared relationship inputs", exact: true });
      await expect(refs.locator(":scope > details")).toHaveCount(2);
      const definition = refs
        .locator(":scope > details")
        .filter({ has: page.locator("summary", { hasText: "4.2 · Power threshold" }) });
      await definition.locator(":scope > summary").click();
      await expect(
        definition.getByText("Defines the maximum operating power.", { exact: true }),
      ).toBeVisible();
      await expect(
        definition.getByText(`Pinned observation · ${captured.id}`, { exact: true }),
      ).toBeVisible();
      await expect(
        definition.locator(".evidence-reference-summary").getByText(new RegExp(captured.hash!)),
      ).toBeVisible();
      await expect(
        definition.locator(".evidence-reference-summary").getByText(new RegExp(latest.hash!)),
      ).toHaveCount(0);
      await expect(refs.getByText(/5 · Operating conditions/).first()).toBeVisible();
      await expect(page.getByText(receipt.outcome, { exact: true }).first()).toBeVisible();
      await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
      mkdirSync(resolve("output/evidence-presentation"), { recursive: true });
      await page.screenshot({
        path: resolve(`output/evidence-presentation/review-${width}.png`),
        fullPage: true,
      });
      await content
        .getByRole("heading", { name: "Observed content", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(`output/evidence-presentation/content-${width}.png`) });
      await definition.getByText("Reference role", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: resolve(`output/evidence-presentation/reference-${width}.png`),
      });
      await page.reload();
      await expect(page.getByText(receipt.outcome, { exact: true }).first()).toBeVisible();
      expect(await t.exportProject()).toEqual(before);
      expect((await t.evidence.compareReceipt(receipt.id)).hasChanged).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await closeTestPage(page);
      await server.close();
      repo.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
