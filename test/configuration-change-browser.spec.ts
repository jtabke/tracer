import { openProjectDestination } from "./project-navigation.ts";
import { test, expect, closeTestPage } from "./browser-test.ts";
import type { Page, Locator } from "@playwright/test";
import { resolve } from "node:path";
import { Tracer } from "../src/index.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { pairVerificationFixture } from "./pair-verification-fixture.ts";
import { verificationActor as actor, verificationTargetInput } from "./verification-fixture.ts";
import { receiptInputEditor } from "./evidence-navigation.ts";

async function openConfigurations(page: Page) {
  await openProjectDestination(page, "Configurations");
  return page.getByRole("region", { name: "Project configurations", exact: true });
}
async function captureFields(panel: Locator, subjectId: string, memberId: string, name: string) {
  await panel.getByRole("button", { name: "Capture configuration", exact: true }).click();
  const task = panel.getByRole("region", { name: "Capture configuration task", exact: true });
  await task.getByLabel("Configuration name", { exact: true }).fill(name);
  await task.getByLabel("Configuration subject", { exact: true }).selectOption(subjectId);
  await task.getByLabel("Member entity", { exact: true }).selectOption(memberId);
  await task
    .getByLabel("Capture purpose", { exact: true })
    .fill("Assess exact selected candidate differences");
  await task
    .getByLabel("Scope rationale", { exact: true })
    .fill("Explicit partial engineering inputs; omitted dependencies remain unassessed");
  return task;
}
for (const [domain, width] of [
  ["engineering", 1440],
  ["research", 390],
] as const)
  test(`${domain}: controlled capture, selected topology/content and exact comparison retain context at ${width}px`, async ({
    page,
  }) => {
    const x = await pairVerificationFixture(domain),
      { f } = x;
    let server;
    try {
      const material = await f.tracer.createEntity(
        {
          type: "@resource",
          fields: {},
          resource: {
            label: "Controlled source material",
            source: { system: "file", externalId: "/synthetic/configuration-workspace" },
          },
        },
        2,
        actor,
      );
      let observed = 0;
      const observer = new Tracer(f.repository, undefined, async () => ({
        availability: "available",
        hash: "sha256:" + (++observed === 1 ? "a" : "b").repeat(64),
      }));
      const a = await observer.evidence.observe(
        {
          entityId: material.id,
          locator: { system: "file", path: "/synthetic/configuration-workspace" },
        },
        actor,
      );
      const input = await verificationTargetInput(f);
      input.members.push({ entityId: material.id, version: 1 });
      input.content = [{ entityId: material.id, observationId: a.id }];
      const before = await f.tracer.configurations.captureExact(input, actor);
      const b = await observer.evidence.observe(
        {
          entityId: material.id,
          locator: { system: "file", path: "/synthetic/configuration-workspace" },
        },
        actor,
      );
      const failed = await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: "FAILED original check",
          inputs: [
            { entityId: f.requirement.id, fields: [f.definition.requirement.fields.statement] },
          ],
          relationshipInputs: [],
        },
        actor,
      );
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [f.definition.requirement.fields.statement]: "Changed selected candidate statement",
          },
        },
        2,
        actor,
      );
      const native = await f.tracer.getProjectSnapshot();
      server = await startLocalServer(f.tracer, resolve("dist"), 0);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.origin);
      const panel = await openConfigurations(page),
        name = `${domain} exact after candidate`;
      const task = await captureFields(panel, f.requirement.id, f.requirement.id, name);
      await task.getByRole("button", { name: "Add configuration member", exact: true }).click();
      await task.getByLabel("Member entity", { exact: true }).nth(1).selectOption(f.method.id);
      await task.getByRole("button", { name: "Add configuration member", exact: true }).click();
      const materialRow = task.getByRole("group", { name: "Configuration member 3", exact: true });
      await materialRow.getByLabel("Member entity", { exact: true }).selectOption(material.id);
      await expect(
        task.getByRole("button", { name: "Prepare capture", exact: true }),
      ).toBeDisabled();
      await materialRow
        .getByLabel("Content selection", { exact: true })
        .selectOption("observation");
      await materialRow.getByLabel("Recorded observation", { exact: true }).selectOption(b.id);
      await task
        .getByLabel("Browse relationships of member", { exact: true })
        .selectOption(f.requirement.id);
      await task
        .getByRole("button", {
          name: `Include relationship ${f.relationship.id.slice(0, 8)}`,
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await openConfigurations(page);
      await expect(task.getByLabel("Configuration name", { exact: true })).toHaveValue(name);
      await task.getByRole("button", { name: "Prepare capture", exact: true }).click();
      await expect(task).toContainText(
        "Prepared 3 native members, 1 relationships and 1 content states",
      );
      await task.getByRole("button", { name: "Capture configuration", exact: true }).click();
      await expect(task).toContainText("Configuration captured.");
      const after = (await f.tracer.configurations.list()).items.find((c) => c.name === name)!;
      expect(after.capture!.content[0].observation!.id).toBe(b.id);
      expect(after.relationships![0].relationship.id).toBe(f.relationship.id);
      expect(after.members.find((p) => p.entity.id === f.requirement.id)!.entity.version).toBe(2);
      await task.getByRole("button", { name: "Return to configurations", exact: true }).click();
      await panel.getByRole("button", { name: "Compare configurations", exact: true }).click();
      const compare = panel.getByRole("region", {
        name: "Compare configuration task",
        exact: true,
      });
      await compare.getByLabel("Before configuration", { exact: true }).selectOption(before.id);
      await compare.getByLabel("After configuration", { exact: true }).selectOption(after.id);
      await compare.getByRole("button", { name: "Compare selected pair", exact: true }).click();
      const diff = compare.getByRole("article", {
        name: "Exact configuration comparison",
        exact: true,
      });
      await expect(diff).toContainText("Changed selected candidate statement");
      await expect(diff).toContainText("Observed content: different");
      await compare.getByLabel("Dependency page size", { exact: true }).selectOption("1");
      await compare
        .getByRole("button", { name: "Discover declared dependencies", exact: true })
        .click();
      await expect(compare.getByLabel("Declared configuration dependencies")).toContainText(
        "Engineering impact is not assessed",
      );
      await compare.getByLabel("After configuration", { exact: true }).selectOption(before.id);
      await expect(compare).toContainText(
        "displayed comparison still belongs to its recorded pair",
      );
      await expect(diff.getByRole("heading", { level: 3 })).toContainText(name);
      await page.getByRole("button", { name: "Return to workspace", exact: true }).click();
      await openProjectDestination(page, "Project settings");
      await page.getByRole("button", { name: "Evaluation records", exact: true }).click();
      await page.getByRole("button", { name: "Record native-input receipt", exact: true }).click();
      await page
        .getByLabel("Configuration basis (optional)", { exact: true })
        .selectOption(after.id);
      await page.getByLabel("Output or conclusion", { exact: true }).selectOption(f.method.id);
      await page.getByLabel("Outcome", { exact: true }).fill("Recorded B content support");
      await receiptInputEditor(page)
        .getByLabel("Input entity", { exact: true })
        .selectOption(material.id);
      await receiptInputEditor(page)
        .getByLabel("Configuration input facet", { exact: true })
        .selectOption("content");
      await expect(receiptInputEditor(page)).toContainText(b.id);
      await page.getByRole("button", { name: "Record receipt", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await f.tracer.evidence.list("receipt")).items.filter(
              (r) => r.outcome === "Recorded B content support",
            ).length,
        )
        .toBe(1);
      const recorded = (await f.tracer.evidence.list("receipt")).items.find(
        (r) => r.outcome === "Recorded B content support",
      )!;
      expect(recorded.inputs[0].observation?.id).toBe(b.id);
      expect(recorded.inputs[0].pin?.entity.version).toBe(1);
      expect(await f.tracer.evidence.getReceipt(failed.id)).toEqual(failed);
      expect(await f.tracer.getProjectSnapshot()).toEqual(native);
      expect(observed).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await closeTestPage(page);
      await server?.close();
      f.close();
    }
  });

test("controlled capture retains preparation through stale/failed reads and inspects a lost committed response without replay", async ({
  page,
}) => {
  const x = await pairVerificationFixture(),
    { f } = x;
  let server;
  try {
    server = await startLocalServer(f.tracer, resolve("dist"), 0);
    await page.goto(server.origin);
    const panel = await openConfigurations(page),
      name = "Recover one exact capture";
    const task = await captureFields(panel, f.requirement.id, f.requirement.id, name);
    await task.getByRole("button", { name: "Prepare capture", exact: true }).click();
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "New evidence after preparation",
        inputs: [{ entityId: f.method.id }],
        relationshipInputs: [],
      },
      actor,
    );
    await task.getByRole("button", { name: "Refresh capture context", exact: true }).click();
    await expect(
      task.getByRole("button", { name: "Capture configuration", exact: true }),
    ).toBeDisabled();
    await expect(task).toContainText("prepare again explicitly");
    await page.route("**/api/configuration-capture-context", (route) => route.abort());
    await task.getByRole("button", { name: "Refresh capture context", exact: true }).click();
    await expect(task).toContainText("Capture context could not be read");
    await expect(
      task.getByRole("button", { name: "Adopt refreshed capture selection", exact: true }),
    ).toBeDisabled();
    await page.unroute("**/api/configuration-capture-context");
    await task.getByRole("button", { name: "Refresh capture context", exact: true }).click();
    await task
      .getByRole("button", { name: "Adopt refreshed capture selection", exact: true })
      .click();
    let writes = 0;
    await page.route("**/api/configuration-captures", async (route) => {
      writes++;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort();
    });
    await task.getByRole("button", { name: "Capture configuration", exact: true }).click();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await expect(recovery).toContainText("outcome is unknown");
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery).toContainText(`Exact configuration ${name}`);
    await recovery
      .getByRole("button", { name: "I inspected saved records; continue editing", exact: true })
      .click();
    await expect(task.getByLabel("Configuration name", { exact: true })).toHaveValue(name);
    expect(
      (await f.tracer.configurations.list()).items.filter((c) => c.name === name),
    ).toHaveLength(1);
    expect(writes).toBe(1);
  } finally {
    await closeTestPage(page);
    await server?.close();
    f.close();
  }
});

test("pair dependency pages reject evidence drift, restart explicitly and retain the displayed pair after a failed exact read", async ({
  page,
}) => {
  const x = await pairVerificationFixture(),
    { f } = x;
  let server;
  try {
    for (let i = 0; i < 4; i++)
      await f.tracer.evidence.recordReceipt(
        {
          outputId: f.method.id,
          outcome: `Original failed scope ${i}`,
          inputs: [{ entityId: f.requirement.id }],
          relationshipInputs: [],
        },
        actor,
      );
    const original = await f.tracer.exportProject();
    server = await startLocalServer(f.tracer, resolve("dist"), 0);
    await page.goto(server.origin);
    const panel = await openConfigurations(page);
    await panel.getByRole("button", { name: "Compare configurations", exact: true }).click();
    const task = panel.getByRole("region", { name: "Compare configuration task", exact: true });
    await task.getByLabel("Before configuration", { exact: true }).selectOption(x.before.id);
    await task.getByLabel("After configuration", { exact: true }).selectOption(x.after.id);
    await task.getByRole("button", { name: "Compare selected pair", exact: true }).click();
    const diff = task.getByRole("article", { name: "Exact configuration comparison", exact: true });
    await expect(diff).toBeVisible();
    await task.getByLabel("Dependency page size", { exact: true }).selectOption("1");
    await task.getByRole("button", { name: "Discover declared dependencies", exact: true }).click();
    const dependencies = task.getByRole("region", {
      name: "Declared configuration dependencies",
      exact: true,
    });
    await expect(
      dependencies.getByRole("button", { name: "Next dependency page", exact: true }),
    ).toBeEnabled();
    await f.tracer.evidence.recordReceipt(
      {
        outputId: f.method.id,
        outcome: "Later discovery only",
        inputs: [{ entityId: f.requirement.id }],
        relationshipInputs: [],
      },
      actor,
    );
    await dependencies.getByRole("button", { name: "Next dependency page", exact: true }).click();
    await expect(dependencies).toContainText("restart discovery explicitly");
    await dependencies
      .getByRole("button", { name: "Retry exact dependency page", exact: true })
      .click();
    await expect(dependencies).toContainText("restart discovery explicitly");
    await dependencies
      .getByRole("button", { name: "Restart dependency discovery", exact: true })
      .click();
    await expect(
      dependencies.getByRole("button", { name: "Next dependency page", exact: true }),
    ).toBeEnabled();
    let pages = 1;
    const seen = [await dependencies.getByRole("heading", { level: 4 }).innerText()];
    const next = dependencies.getByRole("button", { name: "Next dependency page", exact: true });
    while (await next.isEnabled()) {
      expect(pages).toBeLessThan(10);
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/configuration-impact?") &&
            response.url().includes("after="),
        ),
        next.click(),
      ]);
      await expect(
        dependencies.getByText("Reading declared dependency page…", { exact: true }),
      ).toHaveCount(0);
      seen.push(await dependencies.getByRole("heading", { level: 4 }).innerText());
      pages++;
    }
    expect(pages).toBe(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen.join("\n")).toContain("Later discovery only");
    for (let i = 0; i < 4; i++) expect(seen.join("\n")).toContain(`Original failed scope ${i}`);
    await expect(dependencies).toContainText("End of matching declared population");
    await page.route("**/api/configuration-comparison?**", (route) => route.abort());
    await task.getByRole("button", { name: "Retry exact pair", exact: true }).click();
    await expect(task).toContainText("This exact pair could not be read");
    await expect(diff).toBeVisible();
    const after = await f.tracer.exportProject();
    expect(after.current).toEqual(original.current);
    expect(after.configurations).toEqual(original.configurations);
    expect(after.evidence.receipts).toHaveLength(original.evidence.receipts.length + 1);
  } finally {
    await closeTestPage(page);
    await server?.close();
    f.close();
  }
});

test("the retained native-only receipt capture path preserves legacy scope and creates no engineering result", async ({
  page,
}) => {
  const x = await pairVerificationFixture(),
    { f } = x;
  let server;
  try {
    const before = await f.tracer.exportProject();
    server = await startLocalServer(f.tracer, resolve("dist"), 0);
    await page.goto(server.origin);
    await openProjectDestination(page, "Project settings");
    await page.getByRole("button", { name: "Evaluation records", exact: true }).click();
    const capture = page.locator("details.configuration-capture");
    await capture.getByText("Capture a revision-pinned configuration", { exact: true }).click();
    await capture
      .getByLabel("Configuration name", { exact: true })
      .fill("Legacy native receipt input set");
    await capture
      .getByLabel("Configuration subject", { exact: true })
      .selectOption(f.requirement.id);
    await capture.getByLabel("Member entity", { exact: true }).selectOption(f.requirement.id);
    await capture.getByRole("button", { name: "Capture configuration", exact: true }).click();
    await expect(
      capture.getByRole("article", { name: "Pinned configuration", exact: true }),
    ).toContainText("Legacy native-only capture");
    const saved = (await f.tracer.configurations.list()).items.find(
      (c) => c.name === "Legacy native receipt input set",
    )!;
    expect(saved.capture).toBeUndefined();
    expect(saved.relationships).toBeUndefined();
    expect(saved.members[0].entity).toEqual(f.requirement);
    const after = await f.tracer.exportProject();
    expect(after.current).toEqual(before.current);
    expect(after.evidence).toEqual(before.evidence);
    expect(after.configurations).toHaveLength(before.configurations.length + 1);
  } finally {
    await closeTestPage(page);
    await server?.close();
    f.close();
  }
});
