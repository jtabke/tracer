import { evaluationChooser, openView } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedProject } from "../examples/seed-project.ts";
import { Tracer } from "../src/application/service.ts";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { observeLocal } from "../src/interfaces/local-observer.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("seeded project opens immediately with gap, engineering and research evidence scenarios", async ({
  page,
}) => {
  const parent = mkdtempSync(join(tmpdir(), "tracer-seed-browser-"));
  const project = await seedProject(join(parent, "demo"));
  const repository = new SQLiteRepository(project.database);
  const server = await startLocalServer(
    new Tracer(repository, undefined, observeLocal),
    resolve(".fallow/legacy-ui"),
    0,
  );
  try {
    await page.goto(server.origin);
    await expect(page.getByRole("button", { name: "Create schema", exact: true })).toHaveCount(0);
    await openView(page, "Table");
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await expect(page.getByLabel("title for REQ-001", { exact: true })).toBeVisible();
    await openView(page, "Matrix");
    await expect(page.getByText("Missing link", { exact: true })).toBeVisible();
    await openView(page, "Evidence");
    await expect(
      page.getByLabel("Evaluation receipt", { exact: true }).locator("option"),
    ).toHaveCount(8);
    const listRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/entities" || url.pathname === "/api/evidence")
        listRequests.push(request.url());
    });
    for (const [scenario, state, review] of [
      ["current", "current", "unreviewed"],
      ["changed", "changed", "unreviewed"],
      ["accepted", "changed", "accepted"],
      ["unknown", "unknown", "unreviewed"],
      ["research", "changed", "needs_reevaluation"],
    ] as const) {
      await (await evaluationChooser(page)).selectOption(project.scenarios[scenario]);
      await expect(
        page.getByRole("heading", { name: `Freshness: ${state} · Review: ${review}`, exact: true }),
      ).toBeVisible();
    }
    await (await evaluationChooser(page)).selectOption(project.scenarios.superseded);
    await expect(page.getByText(/Superseded by:/)).toContainText(project.scenarios.replacement);
    await (await evaluationChooser(page)).selectOption(project.scenarios.unknown);
    await page.getByRole("button", { name: "Review receipt", exact: true }).click();
    await page
      .getByLabel("Review rationale", { exact: true })
      .fill("Unknown captured input needs a deliberate judgment.");
    await page.getByLabel("Review decision", { exact: true }).selectOption("accepted");
    await expect(
      page.getByRole("button", { name: "Record review decision", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Discard review draft", exact: true }).click();
    expect(listRequests).toEqual([]);
    await (await evaluationChooser(page)).selectOption(project.scenarios.current);
    await expect(
      page.getByRole("heading", { name: "Freshness: current · Review: unreviewed", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review receipt", exact: true }).click();
    await page.getByLabel("Review rationale", { exact: true }).fill("Preserve this rationale");
    await page.route("**/api/comparison?**", (route) => route.abort());
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Freshness: current · Review: unreviewed", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record review decision", exact: true }),
    ).toBeDisabled();
    await page.unroute("**/api/comparison?**");
    await page.getByRole("button", { name: "Refresh current data", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Freshness: current · Review: unreviewed", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Review rationale", { exact: true })).toHaveValue(
      "Preserve this rationale",
    );
  } finally {
    await server.close();
    repository.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
