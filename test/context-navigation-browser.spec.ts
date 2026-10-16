import { closeTestPage } from "./browser-test.ts";
import { test, expect } from "./browser-test.ts";
import type { Page } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import type { DemoGuide } from "../src/interfaces/demo-guide.ts";
import { openExampleTask } from "./browser-navigation.ts";

const actor = { actor: "context-navigation-qa" };

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-context-navigation-"));
  const repository = new SQLiteRepository(join(directory, "project.sqlite"));
  const tracer = new Tracer(repository);
  const fields = { title: { type: "string" as const }, statement: { type: "string" as const } };
  const schema = {
    entityTypes: { design: { fields }, requirement: { fields }, evaluation: { fields } },
    relationshipTypes: {
      realized_by: {
        source: ["requirement"],
        target: ["design"],
        fields: { scope: { type: "string" as const, required: true } },
      },
      evaluated_by: { source: ["requirement", "design"], target: ["evaluation"], fields: {} },
    },
  };
  await tracer.setSchema(schema, 0, actor);
  const create = (type: string, key: string) =>
    tracer.createEntity(
      { type, key, fields: { title: key, statement: `${key} complete statement.` } },
      1,
      actor,
    );
  const first = await create("design", "DES-FIRST");
  const second = await create("design", "DES-SECOND");
  const requirement = await create("requirement", "REQ-SHARED");
  const output = await create("evaluation", "EVAL-SHARED");
  for (const design of [first, second]) {
    await tracer.createRelationship(
      {
        type: "realized_by",
        source: requirement.id,
        target: design.id,
        fields: { scope: "Shared contribution" },
      },
      1,
      actor,
    );
    await tracer.createRelationship(
      { type: "evaluated_by", source: design.id, target: output.id, fields: {} },
      1,
      actor,
    );
  }
  await tracer.createRelationship(
    { type: "evaluated_by", source: requirement.id, target: output.id, fields: {} },
    1,
    actor,
  );
  const receipt = await tracer.evidence.recordReceipt(
    {
      outputId: output.id,
      outcome: "Exact shared capture",
      inputs: [{ entityId: first.id }, { entityId: requirement.id }],
    },
    actor,
  );
  const guide: DemoGuide = {
    title: "Shared engineering context",
    description: "Two actual incoming design families share one requirement and immutable result.",
    tasks: [first, second].map((design) => ({
      title: `${design.key} contributions`,
      root: design.key!,
      rootId: design.id,
      relationship: "realized_by",
      direction: "incoming",
      explanation: "Review the actual recorded shared contribution.",
      presentation: {
        layout: "trace",
        columns: [
          { relationshipType: "evaluated_by", targetType: "evaluation", direction: "outgoing" },
        ],
      },
    })),
    chains: [],
  };
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0, guide);
  return { directory, repository, tracer, schema, first, second, requirement, receipt, server };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function startIncomingCreation(page: Page, value: Fixture) {
  await page.goto(value.server.origin);
  await openExampleTask(page, "DES-FIRST contributions");
  await page.getByRole("button", { name: "Create in context", exact: true }).click();
  const creation = page.getByRole("region", { name: "Create item", exact: true });
  await creation.getByLabel("New item type", { exact: true }).selectOption("requirement");
  await creation.getByLabel("New item key", { exact: true }).fill("REQ-NEW");
  await creation.getByLabel("Draft title", { exact: true }).fill("New design contribution");
  await creation
    .getByLabel("Draft statement", { exact: true })
    .fill("A new requirement realized by the existing design.");
  const before = (await value.tracer.timeline()).head;
  await creation.getByRole("button", { name: "Create item", exact: true }).click();
  const continuation = page.getByRole("region", { name: "Created item continuation", exact: true });
  await expect(continuation).toContainText("Saved without connections");
  const created = (await value.tracer.queryEntities({ key: "REQ-NEW" })).items[0];
  expect(created).toBeDefined();
  expect((await value.tracer.timeline()).head).toBe(before + 1);
  expect((await value.tracer.queryRelationships({ source: created.id })).items).toEqual([]);
  await continuation
    .getByRole("button", { name: "Review connection to DES-FIRST", exact: true })
    .click();
  const proposal = page.getByRole("region", { name: "Record connection", exact: true });
  await expect(proposal.getByLabel("Connection direction", { exact: true })).toHaveText(
    "REQ-NEW · captured v1 → realized by → DES-FIRST · captured v1",
  );
  await proposal
    .getByLabel("Draft scope", { exact: true })
    .fill("The new requirement allocates this recorded design contribution.");
  return { proposal, continuation, created };
}

for (const conflict of ["none", "endpoint", "schema"] as const) {
  test(`incoming-only contextual creation offers the native inverse connection and preserves ${conflict} guards`, async ({
    page,
  }) => {
    const value = await fixture();
    const commands: unknown[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/changesets")
        commands.push(request.postDataJSON());
    });
    try {
      const { proposal, continuation, created } = await startIncomingCreation(page, value);
      if (conflict === "endpoint")
        await value.tracer.updateEntity(
          value.first.id,
          1,
          { fields: { ...value.first.fields, statement: "Changed after proposal capture." } },
          1,
          actor,
        );
      if (conflict === "schema") await value.tracer.setSchema(value.schema, 1, actor);
      const beforeConnect = (await value.tracer.timeline()).head;
      await proposal.getByRole("button", { name: "Record connection", exact: true }).click();
      await expect.poll(() => commands.length).toBe(2);
      expect(commands[1]).toMatchObject({
        expectedSchemaVersion: 1,
        operations: [
          {
            op: "relationship.create",
            input: { type: "realized_by", source: created.id, target: value.first.id },
            expectedEndpoints: { sourceVersion: 1, targetVersion: 1 },
            rejectExisting: true,
          },
        ],
      });
      const links = () =>
        value.tracer.queryRelationships({
          source: created.id,
          target: value.first.id,
          type: "realized_by",
        });
      if (conflict === "none") {
        await expect(continuation).toContainText("Connection recorded.");
        expect((await links()).items).toHaveLength(1);
        expect((await value.tracer.timeline()).head).toBe(beforeConnect + 1);
      } else {
        await expect(proposal.getByRole("alert")).toContainText(
          "Your captured context and draft are retained",
        );
        await expect(proposal.getByLabel("Draft scope", { exact: true })).toHaveValue(
          "The new requirement allocates this recorded design contribution.",
        );
        await expect(proposal.getByLabel("Connection direction", { exact: true })).toContainText(
          "DES-FIRST · captured v1",
        );
        await expect(continuation).toBeHidden();
        expect((await links()).items).toEqual([]);
        expect((await value.tracer.timeline()).head).toBe(beforeConnect);
      }
      expect(await value.tracer.evidence.getReceipt(value.receipt.id)).toEqual(value.receipt);
    } finally {
      await closeTestPage(page, true);
      await value.server.close();
      value.repository.close();
      rmSync(value.directory, { recursive: true, force: true });
    }
  });
}

async function openSharedReceipt(page: Page) {
  const scope = page.locator(".workspace-surface");
  await page
    .getByRole("group", { name: "Workspace representation", exact: true })
    .getByRole("button", { name: "Graph", exact: true })
    .click();
  await scope.getByLabel("Graph depth", { exact: true }).selectOption("1");
  const dependency = scope.getByRole("button", {
    name: "Dependency: EVAL-SHARED → DES-FIRST (evaluated using · captured v1)",
    exact: true,
  });
  await expect(dependency).toHaveCount(1);
  await dependency.press("Enter");
  const stage = page.getByLabel("Captured result review", { exact: true });
  await expect(stage.getByLabel("Recorded result", { exact: true })).toContainText(
    "Exact shared capture",
  );
  return stage;
}

test("same exact receipt opened from two families keeps its dirty comparison owner and returns to the latest origin", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(value.server.origin);
    await openExampleTask(page, "DES-FIRST contributions");
    const initial = await value.tracer.evidence.compareReceipt(value.receipt.id);
    const stage = await openSharedReceipt(page);
    await stage.getByRole("button", { name: "Review receipt", exact: true }).click();
    await stage.getByLabel("Review decision", { exact: true }).selectOption("needs_reevaluation");
    const rationale =
      "A retained draft belongs to this exact capture, independently of where it was opened.";
    await stage.getByLabel("Review rationale", { exact: true }).fill(rationale);
    await stage.getByRole("button", { name: "Return to DES-FIRST scope", exact: true }).click();
    await openExampleTask(page, "DES-SECOND contributions");
    await value.tracer.updateEntity(
      value.requirement.id,
      1,
      {
        fields: {
          ...value.requirement.fields,
          statement: "Changed while the same receipt draft was paused.",
        },
      },
      1,
      actor,
    );
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(page.getByRole("button", { name: "REQ-SHARED · v2", exact: true })).toBeVisible();
    await openSharedReceipt(page);
    await expect(
      stage.getByRole("button", { name: "Return to DES-SECOND scope", exact: true }),
    ).toBeVisible();
    await expect(stage).toContainText("The originating item is not a declared input");
    await expect(stage.getByLabel("Review rationale", { exact: true })).toHaveValue(rationale);
    await expect(stage.getByLabel("Review decision", { exact: true })).toHaveValue(
      "needs_reevaluation",
    );
    await expect(stage).toContainText("Review inputs changed. Draft retained");
    await expect(
      stage.getByRole("button", { name: "Record review decision", exact: true }),
    ).toBeDisabled();
    await expect(
      stage.getByRole("button", { name: "Adopt refreshed review inputs", exact: true }),
    ).toBeVisible();
    expect((await value.tracer.evidence.compareReceipt(value.receipt.id)).token).not.toBe(
      initial.token,
    );
    expect(
      (await value.tracer.evidence.list("review", { subject: value.receipt.id })).items,
    ).toEqual([]);
    await stage.getByRole("button", { name: "Return to DES-SECOND scope", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("item")).toBe(value.second.id);
    await expect(
      page.getByRole("heading", { name: "DES-SECOND context", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Return to review draft", exact: true }),
    ).toBeVisible();
    expect(await value.tracer.evidence.getReceipt(value.receipt.id)).toEqual(value.receipt);
  } finally {
    await closeTestPage(page, true);
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});
