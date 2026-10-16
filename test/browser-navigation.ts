import type { Page } from "@playwright/test";

export async function openView(page: Page, name: string) {
  const label =
    (
      {
        Workspace: "Work",
        Model: "Model",
        Evidence: "Evaluations",
        Work: "Direct editor",
        Graph: "Graph query",
        Table: "Trace query",
        Matrix: "Matrix query",
      } as Record<string, string>
    )[name] ?? name;
  const tab = page.getByRole("tab", { name: label, exact: true });
  if (["Work", "Graph", "Table", "Matrix"].includes(name) && !(await tab.isVisible()))
    await page.getByRole("tab", { name: "Work", exact: true }).click();
  await tab.click();
}

export async function showProjectBrowser(page: Page) {
  const browser = page.getByLabel("Project browser", { exact: true });
  if (!(await browser.count())) await openView(page, "Workspace");
  await browser.waitFor({ state: "attached" });
  if (await browser.isVisible()) return;
  await returnToReadingScope(page);
  await page.getByRole("button", { name: "Return to project items", exact: true }).click();
}

export async function familyControl(page: Page, name: string) {
  return page.getByLabel(name, { exact: true });
}

export async function editableField(page: Page, name: string) {
  if (name.startsWith("Workspace ")) await openWorkspaceReader(page);
  const control = page.getByLabel(name, { exact: true });
  if (!(await control.isVisible())) {
    const [prefix, ...field] = name.split(" ");
    const region =
      prefix === "Graph"
        ? ".graph-inspector"
        : prefix === "Item"
          ? ".work-detail"
          : ".workspace-inspector";
    const local = page
      .locator(region)
      .getByRole("button", { name: `Edit ${field.join(" ").replaceAll("_", " ")}`, exact: true });
    const resume = page
      .locator(region)
      .getByRole("button", { name: "Resume editing", exact: true });
    if (await resume.isVisible()) await resume.click();
    else if (await local.count()) await local.click();
    else await page.locator(region).getByRole("button", { name: "Edit item", exact: true }).click();
  }
  return control;
}

export async function graphControl(page: Page, name: string) {
  const control = page.getByLabel(name, { exact: true });
  if (!(await control.isVisible())) {
    const summary = ["Native revision", "Compare from", "Scrub native history"].includes(name)
      ? "History and comparison"
      : "Find a starting item";
    const toggle = page.locator(".graph-option > summary").filter({ hasText: summary });
    if (await toggle.isVisible()) await toggle.click();
    await control.waitFor({ state: "visible" });
  }
  return control;
}

export async function switchFamilyView(page: Page, name: string) {
  await returnToReadingScope(page);
  const button = page.locator(".workspace-bar").getByRole("button", { name, exact: true });
  await button.click();
}
export async function chooseRelatedGroup(page: Page, name: string | RegExp) {
  await returnToReadingScope(page);
  const scope = page.getByLabel("Family scope", { exact: true });
  const options = await scope.locator("option").evaluateAll((options) =>
    options.map((option) => ({
      value: (option as HTMLOptionElement).value,
      text: option.textContent,
    })),
  );
  for (const option of options) {
    const prefix = option.text?.trim() ?? "";
    const matches =
      typeof name === "string" ? name.split(" ·")[0] === prefix : name.test(`${prefix} ·`);
    if (!matches) continue;
    await scope.selectOption(option.value);
    return;
  }
  throw new Error(`No native scope matches ${name}`);
}
export async function openExampleTask(page: Page, title: string) {
  await openView(page, "Project");
  await page.getByRole("button", { name: `Explore scope · ${title}`, exact: true }).click();
}

export async function evaluationChooser(page: Page) {
  const stage = page.getByLabel("Captured result review", { exact: true });
  if (await stage.isVisible()) await stage.getByRole("button", { name: /^Return to / }).click();
  const authorReturn = page.getByRole("button", {
    name: "Return to recorded evaluations",
    exact: true,
  });
  if (await authorReturn.isVisible()) await authorReturn.click();
  const chooser = page.getByLabel("Evaluation receipt", { exact: true });
  await chooser.waitFor({ state: "visible" });
  return chooser;
}

/** One declaration editor is active; its retained siblings remain mounted but hidden. */
export function receiptInputEditor(page: Page) {
  return page.locator(".receipt-input-editor:not([hidden])");
}

async function returnToReadingScope(page: Page) {
  const reader = page.locator(".workspace-reader-return");
  if (await reader.isVisible()) await reader.click();
  const back = page
    .locator(".workspace-inspector")
    .getByRole("button", { name: "Return to scope", exact: true });
  if (await back.isVisible()) await back.click();
}
async function openWorkspaceReader(page: Page) {
  const inspector = page.getByLabel("Workspace inspector", { exact: true });
  if (await inspector.isVisible()) return;
  const show = page.getByRole("button", { name: /^Show details/ });
  if (await show.isVisible()) await show.click();
}
