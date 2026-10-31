import type { Page } from "@playwright/test";

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

/** One declaration editor is active; retained siblings remain mounted but hidden. */
export function receiptInputEditor(page: Page) {
  return page.locator(".receipt-input-editor:not([hidden])");
}
