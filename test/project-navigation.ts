import type { Page } from "@playwright/test";

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
