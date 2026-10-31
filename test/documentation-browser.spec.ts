import { test as base, expect, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Entity } from "../src/core/model.ts";
import { openView, receiptInputEditor } from "./browser-navigation.ts";

const actor = { actor: "documentation-native-browser" };
const test = base.extend<{ fixture: { tracer: Tracer; origin: string; entity: Entity } }>({
  fixture: async ({}, use) => {
    const directory = mkdtempSync(join(tmpdir(), "tracer-documentation-"));
    const repository = new SQLiteRepository(join(directory, "project.sqlite"));
    const tracer = new Tracer(repository);
    await tracer.setSchema(
      {
        entityTypes: {
          item: { fields: { title: { type: "string" }, statement: { type: "string" } } },
        },
        relationshipTypes: {},
      },
      0,
      actor,
    );
    const entity = await tracer.createEntity(
      {
        type: "item",
        key: "RETAINED",
        fields: {
          title: "Retained native item",
          statement: "The chosen native statement stays captured while documentation is read.",
        },
      },
      1,
      actor,
    );
    const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
    try {
      await use({ tracer, origin: server.origin, entity });
    } finally {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
});
async function chooseTopic(page: Page, id: string, title: string) {
  const select = page.getByLabel("Documentation topic", { exact: true });
  if (await select.isVisible()) await select.selectOption(id);
  else
    await page
      .getByRole("navigation", { name: "Documentation topics", exact: true })
      .getByRole("button", { name: title, exact: true })
      .click();
}

for (const width of [1440, 390])
  test(`sourced documentation navigation, visual workflow and retained native authoring at ${width}px`, async ({
    page,
    fixture,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture.origin);
    await openView(page, "Evidence");
    await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
    await page.getByLabel("Output or conclusion", { exact: true }).selectOption(fixture.entity.id);
    await receiptInputEditor(page)
      .getByLabel("Input entity", { exact: true })
      .selectOption(fixture.entity.id);
    await page
      .getByLabel("Outcome", { exact: true })
      .fill("Retain the engineering judgment while consulting workflow guidance.");
    const before = await fixture.tracer.history();
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET") writes++;
    });
    await page.getByRole("button", { name: "Documentation", exact: true }).click();
    const reader = page.getByRole("region", { name: "Documentation reader", exact: true });
    await expect(
      reader.getByRole("heading", { name: "Getting started with Tracer", exact: true }),
    ).toBeVisible();
    if (width === 390)
      await expect(page.getByLabel("Documentation topic", { exact: true })).toBeVisible();
    else
      await expect(
        page.getByRole("navigation", { name: "Documentation topics", exact: true }),
      ).toBeVisible();
    if (width === 1440) {
      const topics = await page
          .getByRole("navigation", { name: "Documentation topics", exact: true })
          .boundingBox(),
        article = await reader.getByRole("article").boundingBox();
      expect(topics!.x + topics!.width).toBeLessThan(article!.x);
      expect(
        await reader
          .getByRole("heading", { level: 1 })
          .evaluate((element) => element.getBoundingClientRect().left),
      ).toBeGreaterThan(topics!.x + topics!.width);
    }
    await expect(reader.getByRole("article").getByRole("heading", { level: 2 })).toHaveText([
      "Explore an example",
      "Start your own project",
    ]);
    await reader.getByRole("link", { name: "workspace reference", exact: true }).click();
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText("Workspace reference");
    await expect(reader.getByRole("img")).toHaveCount(7);
    await expect
      .poll(() =>
        reader
          .getByRole("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await reader.getByRole("link", { name: "custom model exercise", exact: true }).click();
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText(
      "Define a custom project model",
    );
    await page.getByRole("button", { name: "Return to Workspace reference", exact: true }).click();
    await reader.getByRole("link", { name: "realistic examples", exact: true }).click();
    await expect(reader.getByRole("heading", { level: 1 })).toContainText("Realistic");
    await reader.getByRole("link", { name: "industry workflow guides", exact: true }).click();
    await expect(
      reader.getByRole("heading", { name: "Product development across industries", exact: true }),
    ).toBeVisible();
    await expect(reader.getByRole("table")).toHaveCount(2);
    await expect(reader.getByRole("table").first().getByRole("columnheader")).toHaveCount(3);
    await reader
      .getByRole("link", { name: "Shared development logic and industry differences", exact: true })
      .click();
    await expect(
      reader.getByRole("heading", { name: "Representative comparison", exact: true }),
    ).toBeVisible();
    await expect(reader.getByRole("table")).toHaveCount(3);
    await chooseTopic(page, "companies", "Apple, Tesla and SpaceX");
    await expect(
      reader.getByRole("heading", {
        name: "Public product development practices at Apple Tesla and SpaceX",
        exact: true,
      }),
    ).toBeVisible();
    const citation = reader.getByRole("link", {
      name: "Apple engineering role 200673824",
      exact: true,
    });
    await expect(citation).toHaveAttribute("target", "_blank");
    await expect(citation).toHaveAttribute("rel", "noopener noreferrer");
    await page.context().route("https://jobs.apple.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Isolated citation destination</title>",
      }),
    );
    const popupPromise = page.waitForEvent("popup");
    await citation.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(popup.url()).hostname).toBe("jobs.apple.com");
    await popup.close();
    await expect(reader.getByRole("heading", { level: 1 })).toContainText("Apple Tesla and SpaceX");
    const diagram = reader.getByRole("figure", {
      name: "Illustrative development workflow",
      exact: true,
    });
    await expect(diagram.locator("svg")).toBeVisible({ timeout: 15000 });
    await expect(diagram.locator("svg")).toContainText("Software revisions");
    expect(
      await diagram
        .locator("svg .node rect")
        .first()
        .evaluate((element) => getComputedStyle(element).fill),
    ).not.toBe("rgb(0, 0, 0)");
    expect(
      await diagram
        .locator("svg .flowchart-link")
        .first()
        .evaluate((element) => getComputedStyle(element).stroke),
    ).not.toBe("rgb(0, 0, 0)");
    const viewport = diagram.getByRole("region", {
      name: "Workflow diagram; scroll to follow the full process",
      exact: true,
    });
    expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await diagram.getByRole("button", { name: "Fit diagram", exact: true }).click();
    await expect
      .poll(async () => viewport.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
    await diagram.getByRole("button", { name: "100%", exact: true }).click();
    expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await reader.getByRole("link", { name: "hardware guide", exact: true }).click();
    const destinationHeading = reader.getByRole("heading", {
      name: "Prototype and manufacturing progression",
      exact: true,
    });
    await expect(destinationHeading).toBeFocused();
    await expect(destinationHeading).toBeInViewport();
    await reader
      .getByRole("button", { name: "Return to Apple, Tesla and SpaceX", exact: true })
      .click();
    await expect(reader.getByRole("heading", { level: 1 })).toContainText("Apple Tesla and SpaceX");
    await page.screenshot({ path: `/tmp/tracer-documentation-${width}.png`, fullPage: true });
    if (width === 390)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    await openView(page, "Evidence");
    await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue(
      "Retain the engineering judgment while consulting workflow guidance.",
    );
    await expect(
      receiptInputEditor(page).getByLabel("Input captured context", { exact: true }),
    ).toContainText(fixture.entity.fields.statement as string);
    await page.getByRole("button", { name: "Documentation", exact: true }).click();
    await expect(reader.getByRole("heading", { level: 1 })).toContainText("Apple Tesla and SpaceX");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    expect(writes).toBe(0);
    expect(await fixture.tracer.history()).toEqual(before);
  });

test("direct docs URL and rendered examples diagram preserve source links without dead repository routes", async ({
  page,
  fixture,
}) => {
  await page.goto(`${fixture.origin}?view=docs`);
  const reader = page.getByRole("region", { name: "Documentation reader", exact: true });
  await expect(
    reader.getByRole("heading", { name: "Getting started with Tracer", exact: true }),
  ).toBeVisible();
  await chooseTopic(page, "examples", "Realistic examples");
  await expect(
    reader
      .getByRole("figure", { name: "Illustrative development workflow", exact: true })
      .locator("svg"),
  ).toBeVisible({ timeout: 15000 });
  const source = reader.getByRole("link", { name: /^historical workspace exploration/ });
  const href = (await source.getAttribute("href")) ?? "";
  expect(
    href.startsWith("data:text/markdown;base64,") || /\/assets\/archive-.*\.md/.test(href),
  ).toBe(true);
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(reader.locator('a[href^="../"], a[href^="docs/"]')).toHaveCount(0);
});
