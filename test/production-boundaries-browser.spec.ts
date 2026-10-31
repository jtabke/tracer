import { test, expect, closeTestPage, type Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { refreshNativeTask } from "./project-navigation.ts";

const actor = { actor: "production-boundaries", reason: "Fictional production regression" };
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-production-boundaries-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  await tracer.setSchema(
    {
      entityTypes: {
        source: { fields: { title: { type: "string" }, statement: { type: "json" } } },
        target: { fields: { title: { type: "string" }, statement: { type: "json" } } },
      },
      relationshipTypes: {
        satisfies: {
          source: ["source"],
          target: ["target"],
          fields: { scope: { type: "string", required: true } },
        },
      },
    },
    0,
    actor,
  );
  const root = await tracer.createEntity(
    {
      key: "ROOT",
      type: "target",
      fields: { title: "Root criterion", statement: { response_ms: 10, acknowledged: false } },
    },
    1,
    actor,
  );
  const source = await tracer.createEntity(
    {
      key: "SOURCE",
      type: "source",
      fields: { title: "Incoming design", statement: "Original captured design" },
    },
    1,
    actor,
  );
  for (let i = 0; i < 65; i++) {
    const item = await tracer.createEntity(
      {
        key: `CHILD-${i}`,
        type: "source",
        fields: { title: `Recorded neighbor ${i}`, statement: `Exact neighbor statement ${i}` },
      },
      1,
      actor,
    );
    await tracer.createRelationship(
      {
        type: "satisfies",
        source: item.id,
        target: root.id,
        fields: { scope: "Declared fixture contribution" },
      },
      1,
      actor,
    );
  }
  const server = await startLocalServer(tracer, resolve("dist"), 0);
  return {
    tracer,
    root,
    source,
    origin: server.origin,
    close: async () => {
      await server.close();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
import { startLocalServer } from "../src/interfaces/local-server.ts";
async function select(page: Page, key: string) {
  await page.locator('[data-action="search"]').click();
  await page.locator("#search").fill(key);
  await page.locator(`[data-result="${key}"]`).click();
  await page.locator('[data-action="details"]').click();
  const expand = page.getByRole("button", { name: "Expand artifact details", exact: true });
  if (await expand.isVisible()) await expand.click();
}
async function revision(page: Page, value: number) {
  await page
    .getByRole("slider", { name: "Project revision", exact: true })
    .evaluate((element, value) => {
      (element as HTMLInputElement).value = String(value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}

test("incoming-only connection rules retain required scope and captured endpoint guards without partial writes", async ({
  page,
}) => {
  const f = await fixture();
  try {
    await page.goto(f.origin);
    await select(page, "ROOT");
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    const form = page.locator("#connection-form");
    await form.locator('[name="source"]').fill("SOURCE");
    await form.locator('[name="target"]').fill("ROOT");
    await form.locator('[name="scope"]').fill("Exact incoming contribution");
    await expect(form.locator('[name="type"]')).toHaveValue("satisfies");
    await f.tracer.updateEntity(
      f.source.id,
      1,
      { fields: { ...f.source.fields, statement: "Competing design version" } },
      1,
      actor,
    );
    const before = await f.tracer.exportProject();
    let attempts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/changesets")) attempts++;
    });
    await form.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Expected version 1, current version 2");
    await expect(form.locator('[name="scope"]')).toHaveValue("Exact incoming contribution");
    expect(await f.tracer.exportProject()).toEqual(before);
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator(".context p")).toContainText("ROOT");
    await refreshNativeTask(page, "Workspace");
    await select(page, "ROOT");
    await page.getByRole("button", { name: "Add relationship", exact: true }).click();
    await form.locator('[name="source"]').fill("SOURCE");
    await form.locator('[name="target"]').fill("ROOT");
    await form.locator('[name="scope"]').fill("Deliberately refreshed contribution");
    await form.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.locator("#workspace-dialog")).not.toBeVisible();
    const links = await f.tracer.queryRelationships({ source: f.source.id, target: f.root.id });
    expect(links.items).toHaveLength(1);
    expect(links.items[0].fields.scope).toBe("Deliberately refreshed contribution");
    expect(attempts).toBe(2);
  } finally {
    await closeTestPage(page);
    await f.close();
  }
});

test("dense recorded connections and structured statements remain readable while failed refresh locks writes", async ({
  page,
}) => {
  const f = await fixture();
  try {
    const before = await f.tracer.exportProject();
    await page.goto(f.origin);
    await select(page, "ROOT");
    const inspector = page.getByLabel("Artifact inspector", { exact: true });
    await expect(inspector).toContainText('"response_ms":10');
    await expect(inspector).not.toContainText("[object Object]");
    await expect(inspector.locator(".connection-row")).toHaveCount(65);
    const keys = await inspector
      .locator(".connection-row")
      .evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.related!));
    const drawn = await page
      .locator(".node")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.key));
    const outsideGraph = keys.find((key) => !drawn.includes(key));
    expect(outsideGraph).toBeTruthy();
    await inspector.locator(`[data-related="${outsideGraph}"]`).click();
    await expect(inspector).toContainText(
      `Exact neighbor statement ${outsideGraph!.split("-")[1]}`,
    );
    await page.route("**/api/project-snapshot", (route) => route.abort());
    await refreshNativeTask(page, "Workspace");
    await expect(page.getByText("Project state needs recovery", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create record", exact: true })).toBeDisabled();
    expect(await f.tracer.exportProject()).toEqual(before);
    await page.unroute("**/api/project-snapshot");
    await refreshNativeTask(page, "Workspace");
    await expect(page.getByRole("button", { name: "Create record", exact: true })).toBeEnabled();
    await select(page, "ROOT");
    await expect(inspector.locator(".connection-row")).toHaveCount(65);
    expect(await f.tracer.exportProject()).toEqual(before);
  } finally {
    await closeTestPage(page);
    await f.close();
  }
});

test("historical selection before creation and after deletion never renders a stale live inspector or relinked endpoint", async ({
  page,
}) => {
  const f = await fixture();
  try {
    const absentRevision = (await f.tracer.timeline()).head;
    const late = await f.tracer.createEntity(
      {
        key: "LATE",
        type: "target",
        fields: { title: "Later identity", statement: "Exact later recorded statement" },
      },
      1,
      actor,
    );
    const link = await f.tracer.createRelationship(
      {
        type: "satisfies",
        source: f.source.id,
        target: late.id,
        fields: { scope: "Original late endpoint" },
      },
      1,
      actor,
    );
    const oldRevision = (await f.tracer.timeline()).head;
    await f.tracer.updateRelationship(
      link.id,
      1,
      {
        type: "satisfies",
        source: f.source.id,
        target: f.root.id,
        fields: { scope: "Relinked root endpoint" },
      },
      1,
      actor,
    );
    const relinkRevision = (await f.tracer.timeline()).head;
    await f.tracer.removeEntity(late.id, 1, 1, actor);
    const before = await f.tracer.exportProject();
    await page.goto(f.origin);
    await revision(page, oldRevision);
    await select(page, "LATE");
    await expect(page.getByLabel("Artifact inspector", { exact: true })).toContainText(
      "Exact later recorded statement",
    );
    await expect(
      page.getByRole("button", { name: "Inspect relationship SOURCE to LATE", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit artifact", exact: true })).toBeDisabled();
    await revision(page, absentRevision);
    await expect(page.locator("#artifact-heading")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create record", exact: true })).toBeDisabled();
    await revision(page, relinkRevision);
    await select(page, "ROOT");
    await expect(
      page.getByRole("button", { name: "Inspect relationship SOURCE to ROOT", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Inspect relationship SOURCE to LATE", exact: true }),
    ).toHaveCount(0);
    await revision(page, oldRevision);
    await select(page, "LATE");
    await page.getByRole("button", { name: "Return to latest", exact: true }).click();
    await expect(page.locator("#artifact-heading")).toHaveCount(0);
    expect(await f.tracer.exportProject()).toEqual(before);
  } finally {
    await closeTestPage(page);
    await f.close();
  }
});
