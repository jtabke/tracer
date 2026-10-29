import { projectTaskGroups, projectUtilities } from "../project-task-navigation.tsx";
import { projectToolIcon } from "./project-tool-icon.tsx";
import { escapeHtml } from "./html.ts";

export function containNavigationFocus(dialog: HTMLDialogElement, event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button")];
  const boundary = event.shiftKey ? buttons[0] : buttons.at(-1);
  if (document.activeElement !== boundary) return;
  event.preventDefault();
  (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
}

export function renderProjectSidebar({
  brand,
  workspaceIcon,
  project,
  native,
  settings,
}: {
  brand: string;
  workspaceIcon: string;
  project: string;
  native: boolean;
  settings: boolean;
}) {
  const groups = native ? projectTaskGroups.filter((group) => group.navigation) : [];
  const destinations = (scope: "work" | "project") =>
    groups
      .filter((group) => group.navigation === scope)
      .flatMap((group) => group.tasks)
      .map(
        ({ task, title }) =>
          `<button data-action="task-${task}" aria-label="${escapeHtml(title)}">${projectToolIcon(task)}<span>${escapeHtml(title)}</span></button>`,
      )
      .join("");
  return `<aside class="rail project-sidebar" aria-label="Project navigation"><div class="brand">${brand}<span>Tracer</span></div><div class="sidebar-project"><strong>${escapeHtml(project)}</strong><span>${native ? "Saved locally" : "Preview"}</span></div><nav class="railnav" aria-label="Engineering work"><button data-action="workspace" aria-label="Workspace" ${settings ? "" : 'class="active" aria-current="page"'}>${workspaceIcon}<span>Workspace</span></button>${destinations("work")}</nav><nav class="railnav project-sidebar-footer" aria-label="Project setup and help">${destinations("project")}${native ? `<button data-action="project-settings" aria-label="Project settings" ${settings ? 'class="active" aria-current="page"' : ""}>${projectToolIcon("settings")}<span>Project settings</span></button>` : ""}</nav></aside>`;
}

export function renderProjectSettings(refreshDisabled: boolean) {
  const button = (
    action: string,
    title: string,
    description: string,
    icon: string,
    disabled = false,
  ) =>
    `<button class="project-settings-action" data-action="${action}" aria-label="${escapeHtml(title)}" ${disabled ? "disabled" : ""}>${icon}<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span aria-hidden="true">↗</span></button>`;
  return `<section class="project-settings-page" aria-label="Project settings" tabindex="-1"><p>Occasional project operations, without leaving your working context.</p>${projectTaskGroups
    .filter((group) => group.settings)
    .map(
      (group) =>
        `<section><h2>${escapeHtml(group.title)}</h2>${group.tasks.map(({ task, title, description }) => button(`task-${task}`, title, description, projectToolIcon(task))).join("")}${group.title === "Advanced" ? projectUtilities.map((utility) => button(utility.action, utility.title, utility.description, projectToolIcon(utility.icon), utility.action === "refresh-project" && refreshDisabled)).join("") : ""}</section>`,
    )
    .join(
      "",
    )}<p>Unsaved drafts stay in this tab until reload. Search / ⌘K includes every task.</p></section>`;
}
