import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { Connections } from "../src/application/views.ts";

async function connectionFixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-inspector-paging-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  const actor = { actor: "inspector-paging-qa" };
  await tracer.setSchema(
    {
      entityTypes: { note: { fields: { title: { type: "string" } } } },
      relationshipTypes: { refers_to: { fields: {} } },
    },
    0,
    actor,
  );
  const root = await tracer.createEntity(
    { type: "note", key: "ROOT", fields: { title: "Dense context root" } },
    1,
    actor,
  );
  for (let index = 0; index < 23; index++) {
    const item = await tracer.createEntity(
      { type: "note", key: `NOTE-${index}`, fields: { title: `Recorded neighbor ${index}` } },
      1,
      actor,
    );
    await tracer.createRelationship(
      {
        type: "refers_to",
        source: index % 2 ? item.id : root.id,
        target: index % 2 ? root.id : item.id,
        fields: {},
      },
      1,
      actor,
    );
  }
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  return { directory, repository, tracer, root, server };
}

function endpointLabels(data: Connections) {
  return data.items.map(
    ({ source, target }) =>
      `Inspect ${(source.id === data.entity.id ? target : source).key} via refers to`,
  );
}

for (const width of [1440, 390]) {
  test(`${width}px recorded context reaches every page and endpoint navigation resets its cursor without changing scope`, async ({
    page,
  }) => {
    const fixture = await connectionFixture();
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/connections?")) requests.push(request.url());
    });
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${fixture.server.origin}/?view=workspace&item=${fixture.root.id}`);
      if (width === 390)
        await page.getByRole("button", { name: "Show details", exact: true }).click();
      const inspector = page.getByLabel("Workspace inspector", { exact: true });
      const connections = inspector.getByRole("region", {
        name: "Recorded connections",
        exact: true,
      });
      const first = await fixture.tracer.getConnections({ id: fixture.root.id, limit: 10 });
      const second = await fixture.tracer.getConnections({
        id: fixture.root.id,
        limit: 10,
        after: first.nextAfter,
      });
      const third = await fixture.tracer.getConnections({
        id: fixture.root.id,
        limit: 10,
        after: second.nextAfter,
      });
      const seen: string[] = [];
      for (const [index, expected] of [first, second, third].entries()) {
        await expect(connections.locator(".recorded-endpoint")).toHaveCount(expected.items.length);
        const labels = await connections
          .locator(".recorded-endpoint")
          .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
        expect(labels).toEqual(endpointLabels(expected));
        seen.push(...(labels as string[]));
        await expect(inspector.getByRole("heading", { name: "ROOT", exact: true })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
        const previous = connections.getByRole("button", {
          name: "Previous connections",
          exact: true,
        });
        if (index === 0) await expect(previous).toBeDisabled();
        else await expect(previous).toBeEnabled();
        const next = connections.getByRole("button", { name: "Next connections", exact: true });
        if (index < 2) await next.click();
        else await expect(next).toBeDisabled();
      }
      expect(new Set(seen).size).toBe(23);
      await connections.getByRole("button", { name: "Previous connections", exact: true }).click();
      await expect(connections.locator(".recorded-endpoint")).toHaveCount(10);
      expect(
        await connections.locator(".recorded-endpoint").first().getAttribute("aria-label"),
      ).toBe(endpointLabels(second)[0]);
      const beforeRefresh = requests.length;
      await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
      await expect.poll(() => requests.length).toBeGreaterThan(beforeRefresh);
      await expect(connections.locator(".recorded-endpoint")).toHaveCount(10);
      expect(new URL(requests.at(-1)!).searchParams.get("after")).toBe(first.nextAfter);
      const neighbor =
        second.items[0].source.id === fixture.root.id
          ? second.items[0].target
          : second.items[0].source;
      await connections
        .getByRole("button", { name: endpointLabels(second)[0], exact: true })
        .click();
      await expect(
        inspector.getByRole("heading", { name: neighbor.key!, exact: true }),
      ).toBeVisible();
      await expect(connections.locator(".recorded-endpoint")).toHaveCount(1);
      expect(new URL(requests.at(-1)!).searchParams.has("after")).toBe(false);
      expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
      await connections
        .getByRole("button", { name: "Inspect ROOT via refers to", exact: true })
        .click();
      await expect(inspector.getByRole("heading", { name: "ROOT", exact: true })).toBeVisible();
      await expect(connections.locator(".recorded-endpoint")).toHaveCount(10);
      expect(new URL(requests.at(-1)!).searchParams.has("after")).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: `/tmp/tracer-inspector-paged-${width}.png`, fullPage: true });
    } finally {
      await closeTestPage(page, true);
      await fixture.server.close();
      fixture.repository.close();
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
}

test("a failed next connection page retains the item and Previous recovers a usable first page", async ({
  page,
}) => {
  const fixture = await connectionFixture();
  try {
    await page.goto(`${fixture.server.origin}/?view=workspace&item=${fixture.root.id}`);
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    const connections = inspector.getByRole("region", {
      name: "Recorded connections",
      exact: true,
    });
    await expect(connections.locator(".recorded-endpoint")).toHaveCount(10);
    await page.route("**/api/connections?**", (route) =>
      new URL(route.request().url()).searchParams.has("after") ? route.abort() : route.continue(),
    );
    await connections.getByRole("button", { name: "Next connections", exact: true }).click();
    await expect(connections).toContainText("Connections unavailable");
    await expect(inspector.getByRole("heading", { name: "ROOT", exact: true })).toBeVisible();
    await expect(connections.locator(".recorded-endpoint")).toHaveCount(0);
    await expect(
      connections.getByRole("button", { name: "Next connections", exact: true }),
    ).toBeDisabled();
    await connections.getByRole("button", { name: "Previous connections", exact: true }).click();
    await expect(connections.locator(".recorded-endpoint")).toHaveCount(10);
    await expect(connections.locator(".recorded-endpoint").first()).toBeEnabled();
  } finally {
    await closeTestPage(page, true);
    await fixture.server.close();
    fixture.repository.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("narrow connection picker browses immediately, retains the candidate page after preview, and resets pagination for a one-character search", async ({
  page,
}) => {
  const fixture = await connectionFixture();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixture.server.origin}/?view=workspace&item=${fixture.root.id}`);
    await page.getByRole("button", { name: "Show details", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Connect existing item", exact: true });
    await trigger.click();
    const picker = page.getByRole("dialog", { name: "Record connection", exact: true });
    const candidates = picker.locator(".workspace-candidates");
    const search = picker.getByLabel("Find mapping candidate", { exact: true });
    await expect(search).toBeFocused();
    const first = await fixture.tracer.queryEntities({ type: "note", limit: 20 });
    const second = await fixture.tracer.queryEntities({
      type: "note",
      limit: 20,
      after: first.nextAfter,
    });
    await expect(candidates.getByRole("button")).toHaveCount(20);
    expect(await candidates.getByRole("button").allTextContents()).toEqual(
      first.items.map((item) => `Choose ${item.key}`),
    );
    await picker.getByRole("button", { name: "Next candidates", exact: true }).click();
    await expect(candidates.getByRole("button")).toHaveCount(4);
    const secondLabels = second.items.map((item) => `Choose ${item.key}`);
    expect(await candidates.getByRole("button").allTextContents()).toEqual(secondLabels);
    const chosen = second.items.find((item) => item.id !== fixture.root.id)!;
    await candidates.getByRole("button", { name: `Choose ${chosen.key}`, exact: true }).click();
    await expect(
      picker.getByRole("heading", { name: `${chosen.key} · captured v1`, exact: true }),
    ).toBeVisible();
    await expect(picker.getByLabel("Connection direction", { exact: true })).toContainText(
      `${chosen.key} · captured v1`,
    );
    await picker.getByRole("button", { name: "Change target", exact: true }).click();
    await expect(candidates.getByRole("button")).toHaveCount(4);
    expect(await candidates.getByRole("button").allTextContents()).toEqual(secondLabels);
    await search.fill("9");
    const matching = await fixture.tracer.queryEntities({ type: "note", search: "9", limit: 20 });
    await expect(candidates.getByRole("button")).toHaveCount(matching.items.length);
    expect(await candidates.getByRole("button").allTextContents()).toEqual(
      matching.items.map((item) => `Choose ${item.key}`),
    );
    await search.fill("");
    await expect(candidates.getByRole("button")).toHaveCount(20);
    expect(await candidates.getByRole("button").allTextContents()).toEqual(
      first.items.map((item) => `Choose ${item.key}`),
    );
    await expect(
      picker.getByRole("button", { name: "Previous candidates", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: "/tmp/tracer-picker-browse-390.png", fullPage: true });
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally {
    await closeTestPage(page, true);
    await fixture.server.close();
    fixture.repository.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("entering Graph after an off-page recorded endpoint centers the retained selection inside the canvas", async ({
  page,
}) => {
  const fixture = await connectionFixture();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const first = await fixture.tracer.getConnections({ id: fixture.root.id, limit: 10 });
    const second = await fixture.tracer.getConnections({
      id: fixture.root.id,
      limit: 10,
      after: first.nextAfter,
    });
    const connection = second.items[0];
    const outgoing = connection.source.id === fixture.root.id;
    const neighbor = outgoing ? connection.target : connection.source;
    const direction = outgoing ? "outgoing" : "incoming";
    await page.goto(
      `${fixture.server.origin}/?view=workspace&item=${fixture.root.id}&family=refers_to&direction=${direction}`,
    );
    const inspector = page.getByLabel("Workspace inspector", { exact: true });
    const connections = inspector.getByRole("region", {
      name: "Recorded connections",
      exact: true,
    });
    await connections.getByRole("button", { name: "Next connections", exact: true }).click();
    await connections.getByRole("button", { name: endpointLabels(second)[0], exact: true }).click();
    await expect(
      inspector.getByRole("heading", { name: neighbor.key!, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("group", { name: "Workspace representation", exact: true })
      .getByRole("button", { name: "Graph", exact: true })
      .click();
    const node = page.getByTestId(`graph-node-${neighbor.key}`);
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => {
        const canvas = await page.getByLabel("Graph canvas", { exact: true }).boundingBox();
        const selected = await node.boundingBox();
        return (
          !!canvas &&
          !!selected &&
          selected.x >= canvas.x &&
          selected.y >= canvas.y &&
          selected.x + selected.width <= canvas.x + canvas.width &&
          selected.y + selected.height <= canvas.y + canvas.height
        );
      })
      .toBe(true);
    expect(new URL(page.url()).searchParams.get("item")).toBe(fixture.root.id);
    await expect(
      inspector.getByRole("heading", { name: neighbor.key!, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/tracer-retained-graph-selection-1440.png",
      fullPage: true,
    });
  } finally {
    await closeTestPage(page, true);
    await fixture.server.close();
    fixture.repository.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
