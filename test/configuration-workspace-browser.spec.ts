import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedRealisticProject } from "../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";
import { openView } from "./browser-navigation.ts";

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "tracer-configuration-studio-"));
  const seeded = await seedRealisticProject(join(directory, "project"), "integrated");
  const repository = new SQLiteRepository(seeded.database);
  const tracer = new Tracer(repository);
  const server = await startLocalServer(tracer, resolve(".fallow/legacy-ui"), 0);
  return { directory, seeded, repository, tracer, server };
}

test("a complete fifteen-member capture has compact selectable pins and one full exact statement at desktop and narrow widths", async ({
  page,
}) => {
  const value = await fixture();
  try {
    const captured = value.seeded.configurations["BUILD-R01"];
    expect(captured.members).toHaveLength(15);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${value.server.origin}/?view=configurations`);
      await page
        .getByRole("button", { name: `Open configuration ${captured.name}`, exact: true })
        .click();
      const detail = page.getByRole("region", {
        name: "Selected configuration capture",
        exact: true,
      });
      const members = detail.getByRole("region", { name: "Complete pinned members", exact: true });
      await expect(members.getByRole("button")).toHaveCount(15);
      const last = captured.members.at(-1)!;
      await members
        .getByRole("button", {
          name: `Inspect pinned member ${last.entity.key ?? last.entity.fields.title} v${last.entity.version}`,
          exact: true,
        })
        .click();
      const reading = detail.getByRole("region", { name: "Selected pinned member", exact: true });
      await expect(reading).toContainText(
        String(last.entity.fields.statement ?? last.entity.fields.title),
      );
      await expect(reading).toContainText(
        `Captured project revision ${last.projectRevision} · schema v${last.schema.version}`,
      );
      await expect(detail.locator(".configuration-pinned-statement")).toHaveCount(1);
      if (width === 390) {
        await detail.getByRole("heading").first().scrollIntoViewIfNeeded();
        const box = await reading.boundingBox();
        expect(box!.y).toBeLessThan(650);
        await expect(
          page.getByRole("region", { name: "Configuration catalogue", exact: true }),
        ).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      }
      await page.screenshot({
        path: `/tmp/tracer-configuration-full-${width}.png`,
        fullPage: true,
      });
    }
    expect(await value.tracer.configurations.get(captured.id)).toEqual(captured);
  } finally {
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("configuration capture is a retained primary task through catalogue reading, area navigation and failed reads", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${value.server.origin}/?view=configurations`);
    await page.getByRole("button", { name: "Capture configuration", exact: true }).click();
    const task = page.getByRole("region", { name: "Capture configuration task", exact: true });
    const name = task.getByLabel("Configuration name", { exact: true });
    await name.fill("Retained native configuration proposal");
    const captured = value.seeded.configurations["BUILD-R01"];
    const member = captured.members[0].entity;
    await task
      .getByLabel("Find configuration subject", { exact: true })
      .fill(captured.subject.key!);
    await task
      .getByLabel("Configuration subject", { exact: true })
      .selectOption(captured.subject.id);
    await task.getByLabel("Find member entity", { exact: true }).fill(member.key!);
    await task.getByLabel("Member entity", { exact: true }).selectOption(member.id);
    await task
      .getByLabel("Capture purpose", { exact: true })
      .fill("Retain this exact capture draft across task navigation");
    await task
      .getByLabel("Scope rationale", { exact: true })
      .fill("Partial native scope; current reads do not silently rebase selected versions");
    const proposalVersion = await task.getByLabel("Input revision", { exact: true }).inputValue();
    await expect(
      page.getByRole("region", { name: "Configuration catalogue", exact: true }),
    ).toBeHidden();
    await task.getByRole("button", { name: "Return to configurations", exact: true }).click();
    await page
      .getByRole("button", { name: `Open configuration ${captured.name}`, exact: true })
      .click();
    await expect(
      page
        .getByRole("article", { name: "Pinned configuration", exact: true })
        .filter({ visible: true }),
    ).toContainText(captured.name);
    await openView(page, "Model");
    await openView(page, "Configurations");
    await page.getByRole("button", { name: "Capture configuration", exact: true }).click();
    await expect(name).toHaveValue("Retained native configuration proposal");
    await expect(task.getByLabel("Member entity", { exact: true })).toHaveValue(member.id);
    await expect(task.getByLabel("Input revision", { exact: true })).toHaveValue(proposalVersion);
    await page.route("**/api/configuration-capture-context", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(task.getByRole("button", { name: "Prepare capture", exact: true })).toBeDisabled();
    await expect(
      task.getByRole("button", { name: "Capture configuration", exact: true }),
    ).toBeDisabled();
    await expect(name).toHaveValue("Retained native configuration proposal");
    await page.unroute("**/api/configuration-capture-context");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(task.getByRole("button", { name: "Prepare capture", exact: true })).toBeEnabled();
    await expect(task.getByLabel("Input revision", { exact: true })).toHaveValue(proposalVersion);
    expect(
      (await value.tracer.configurations.list()).items.some(
        (capture) => capture.name === "Retained native configuration proposal",
      ),
    ).toBe(false);
    await page.screenshot({
      path: "/tmp/tracer-configuration-capture-retained-390.png",
      fullPage: true,
    });
  } finally {
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});

test("returning from an unknown capture keeps its proposal and requires explicit recorded-capture reconciliation", async ({
  page,
}) => {
  const value = await fixture();
  try {
    await page.goto(`${value.server.origin}/?view=configurations`);
    await page.getByRole("button", { name: "Capture configuration", exact: true }).click();
    const task = page.getByRole("region", { name: "Capture configuration task", exact: true });
    const captured = value.seeded.configurations["BUILD-R01"];
    await task
      .getByLabel("Configuration name", { exact: true })
      .fill("Uncertain configuration owner");
    await task
      .getByLabel("Find configuration subject", { exact: true })
      .fill(captured.subject.key!);
    await task
      .getByLabel("Configuration subject", { exact: true })
      .selectOption(captured.subject.id);
    await task
      .getByLabel("Find member entity", { exact: true })
      .fill(captured.members[0].entity.key!);
    await task
      .getByLabel("Member entity", { exact: true })
      .selectOption(captured.members[0].entity.id);
    const revision = await task.getByLabel("Input revision", { exact: true }).inputValue();
    await task
      .getByLabel("Capture purpose", { exact: true })
      .fill("Retain one exact controlled capture after a lost response");
    await task
      .getByLabel("Scope rationale", { exact: true })
      .fill("Selected native member only; no topology or observed-content inference");
    await task.getByRole("button", { name: "Prepare capture", exact: true }).click();
    let originalProposal: unknown;
    await page.route("**/api/configuration-captures", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      originalProposal = route.request().postDataJSON();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      return route.fulfill({ response, body: "unreadable native capture response" });
    });
    await task.getByRole("button", { name: "Capture configuration", exact: true }).click();
    const recovery = page.getByRole("region", { name: "Save recovery", exact: true });
    await expect(recovery).toContainText("save outcome is unknown");
    await task.getByRole("button", { name: "Return to configurations", exact: true }).click();
    await page
      .getByRole("region", { name: "Configuration catalogue", exact: true })
      .getByRole("button", { name: "Refresh configurations", exact: true })
      .click();
    await page.getByRole("button", { name: "Capture configuration", exact: true }).click();
    await expect(task.getByLabel("Configuration name", { exact: true })).toHaveValue(
      "Uncertain configuration owner",
    );
    await expect(task.getByLabel("Input revision", { exact: true })).toHaveValue(revision);
    await expect(
      task.getByRole("button", { name: "Capture configuration", exact: true }),
    ).toBeDisabled();
    const acknowledge = recovery.getByRole("button", {
      name: "I inspected saved records; continue editing",
      exact: true,
    });
    await expect(acknowledge).toBeDisabled();
    await recovery.getByRole("button", { name: "Refresh saved records", exact: true }).click();
    await expect(recovery).toContainText("Exact configuration Uncertain configuration owner");
    await recovery.getByText("Full recorded data", { exact: true }).click();
    await expect(recovery).toContainText(captured.members[0].entity.id);

    await acknowledge.click();
    await expect(
      task.getByRole("button", { name: "Capture configuration", exact: true }),
    ).toBeEnabled();
    // Capture append does not advance the engineering clocks; the original proposal remains exact.
    const recorded = (await value.tracer.configurations.list()).items.find(
      (capture) => capture.name === "Uncertain configuration owner",
    )!;
    expect(recorded.capture!.intent).toEqual(originalProposal);
    expect(
      (await value.tracer.configurations.list()).items.filter(
        (capture) => capture.name === "Uncertain configuration owner",
      ),
    ).toHaveLength(1);
  } finally {
    await value.server.close();
    value.repository.close();
    rmSync(value.directory, { recursive: true, force: true });
  }
});
