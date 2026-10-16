import { closeTestPage } from "./browser-test.ts";
import { editableField, graphControl, openView } from "./browser-navigation.ts";
import { test, expect } from "./browser-test.ts";
import { resolve } from "node:path";
import { chainFixture } from "./chain-fixture.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("relationship columns expose branches, siblings, shared children and editable details without changing views", async ({
  page,
}) => {
  const f = await chainFixture();
  const server = await startLocalServer(f.tracer, resolve(".fallow/legacy-ui"), 0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.origin);
    await openView(page, "Table");
    const chain = page.getByLabel("Relationship chain table", { exact: true });
    await expect(chain.getByRole("columnheader")).toHaveCount(3);
    await expect(chain.getByText("No connected child", { exact: true })).toHaveCount(2);
    await expect(chain.getByRole("button", { name: "Inspect chain R1", exact: true })).toHaveCount(
      2,
    );
    const parentCell = chain
      .getByRole("cell")
      .filter({ has: page.getByRole("button", { name: "Inspect chain N1", exact: true }) });
    await expect(parentCell).toHaveAttribute("rowspan", "3");
    await chain.getByRole("button", { name: "Inspect chain R2", exact: true }).click();
    await chain.getByRole("button", { name: "Show siblings (1)", exact: true }).click();
    await chain.getByRole("button", { name: "Inspect chain R1", exact: true }).click();
    const detail = chain.getByLabel("Focused item", { exact: true });
    await editableField(page, "Item title");
    await expect(detail.getByLabel("Item title", { exact: true })).toBeEnabled();
    await detail.getByLabel("Item title", { exact: true }).fill("Edited shared requirement");
    await chain.getByRole("button", { name: "Show siblings (1)", exact: true }).click();
    await expect(chain.getByRole("button", { name: "Inspect chain N2", exact: true })).toHaveCount(
      0,
    );
    await expect(
      chain.getByRole("button", { name: "Inspect chain R2", exact: true }),
    ).toBeVisible();
    await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
      "Edited shared requirement",
    );
    await page.screenshot({ path: "/tmp/tracer-chain-siblings.png", fullPage: true });
    await chain.getByRole("button", { name: "Show all chains", exact: true }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await chain.getByRole("button", { name: "Inspect chain R2", exact: true }).click();
    await expect(detail.getByLabel("Item title", { exact: true })).toHaveValue(
      "Edited shared requirement",
    );
    await detail.getByRole("button", { name: "Save item", exact: true }).click();
    await expect
      .poll(async () => (await f.tracer.queryEntities({ key: "R1" })).items[0].fields.title)
      .toBe("Edited shared requirement");
    await expect(chain.getByText("Edited shared requirement", { exact: true })).toHaveCount(3);
    await chain.getByRole("button", { name: "Inspect chain R2", exact: true }).click();
    await detail.locator(".work-connect-options > summary").click();
    await detail.getByLabel("Find target", { exact: true }).fill("O1");
    await detail.getByRole("button", { name: "Choose target O1", exact: true }).click();
    await detail.getByRole("button", { name: "Connect selected target", exact: true }).click();
    await expect(chain.getByText("No connected child", { exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Editable rows", exact: true }).click();
    await page.getByLabel("Entity type", { exact: true }).selectOption("requirement");
    await expect(page.getByLabel("title for R1", { exact: true })).toHaveValue(
      "Edited shared requirement",
    );
    await page.getByRole("button", { name: "Relationship columns", exact: true }).click();
    await expect(chain.getByRole("region", { name: "Trace scope controls" })).toBeVisible();
    await chain.getByRole("button", { name: "Remove last column", exact: true }).click();
    await expect(chain.getByRole("columnheader")).toHaveCount(2);
    await chain.getByRole("button", { name: "Add relationship column", exact: true }).click();
    await expect(chain.getByRole("columnheader")).toHaveCount(3);
    await page.setViewportSize({ width: 680, height: 800 });
    await chain.getByRole("button", { name: "Inspect chain N3", exact: true }).click();
    await expect(detail.getByRole("heading", { name: "N3", exact: true })).toBeFocused();
    await page.screenshot({ path: "/tmp/tracer-chain-narrow.png", fullPage: true });
    await openView(page, "Graph");
    await (await graphControl(page, "Native revision")).selectOption("1");
    await openView(page, "Table");
    await expect(detail.getByRole("button", { name: "Edit item", exact: true })).toBeDisabled();
    await detail.locator(".work-connect-options > summary").click();
    await expect(
      detail.getByRole("button", { name: "Connect selected target", exact: true }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await closeTestPage(page, true);
    await server.close();
    f.repository.close();
  }
});
