import type { Page } from "@playwright/test";

export async function openNativeTask(page: Page, name: string) {
  const close = page.getByRole("button", { name: "Return to workspace", exact: true });
  if (await close.isVisible()) await close.click();
  if (name === "Evidence") {
    await openProjectDestination(page, "Project settings");
    await page.getByRole("button", { name: "Evaluation records", exact: true }).click();
  } else {
    await openProjectDestination(page, name === "Project" ? "Workspace" : name);
  }
}

export async function refreshNativeTask(page: Page, name: string) {
  await openNativeTask(page, "Project settings");
  await page
    .locator(".project-settings-page")
    .getByRole("button", { name: "Refresh project", exact: true })
    .click();
  await openNativeTask(page, name);
}

// The same destination is docked on desktop and in the modal navigation drawer on mobile.
export async function openProjectDestination(page: Page, name: string) {
  await page.locator(".sidebar-shell").waitFor();
  const sidebar = page.locator(".sidebar-shell > .project-sidebar");
  if (await sidebar.isVisible()) {
    await sidebar.getByRole("button", { name, exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Project navigation", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
