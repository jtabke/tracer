const projectPicker = document.querySelector("[data-project-switch]");
const projectMenu = document.querySelector("[data-project-menu]");
const projectChoices = [...projectMenu.querySelectorAll("[data-project]")];
const projectIdentity = {
  orbit: { name: "Orbit R1", kind: "Integrated product", mark: "O", page: "shell.html" },
  aster: { name: "Aster Home BP", kind: "Medical device", mark: "A", page: "medical.html" },
};
function currentProjectKey() {
  return document.body.dataset.project;
}
function updateProjectIdentity() {
  const current = currentProjectKey(),
    identity = projectIdentity[current];
  document.querySelector("[data-project-name]").textContent = identity.name;
  document.querySelector("[data-project-kind]").textContent = identity.kind;
  document.querySelector("[data-project-mark]").textContent = identity.mark;
  document.querySelector("[data-project-mark]").classList.toggle("aster", current === "aster");
  projectPicker.setAttribute("aria-label", `Switch project. Current project ${identity.name}`);
  projectChoices.forEach((choice) =>
    choice.setAttribute("aria-selected", String(choice.dataset.project === current)),
  );
}
function openProjectMenu() {
  projectMenu.hidden = false;
  projectPicker.setAttribute("aria-expanded", "true");
  projectChoices.find((choice) => choice.dataset.project === currentProjectKey()).focus();
}
function closeProjectMenu(restoreFocus = false) {
  projectMenu.hidden = true;
  projectPicker.setAttribute("aria-expanded", "false");
  if (restoreFocus) projectPicker.focus();
}
function saveProjectSession() {
  const app = window.tracerStudy;
  const snapshot = app.capture();
  if (snapshot === null) return;
  sessionStorage.setItem(`tracer-study:${app.key}`, JSON.stringify(snapshot));
}
function switchStudyProject(key) {
  if (key === currentProjectKey()) return closeProjectMenu(true);
  try {
    saveProjectSession();
  } catch {
    return showSwitchFailure();
  }
  location.assign(projectIdentity[key].page);
}
function showSwitchFailure() {
  let status = projectMenu.querySelector("[role=alert]");
  if (!status) {
    status = document.createElement("p");
    status.setAttribute("role", "alert");
    projectMenu.append(status);
  }
  status.textContent =
    "Could not retain this project session. Stay here and save or copy your work before switching.";
}
function moveProjectFocus(event) {
  const offsets = { ArrowDown: 1, ArrowUp: -1 };
  const index = projectChoices.indexOf(document.activeElement);
  if (event.key === "Home") return projectChoices[0].focus();
  if (event.key === "End") return projectChoices.at(-1).focus();
  const next = (index + offsets[event.key] + projectChoices.length) % projectChoices.length;
  projectChoices[next].focus();
}
projectPicker.addEventListener("click", () => {
  if (projectMenu.hidden) openProjectMenu();
  else closeProjectMenu(true);
});
projectPicker.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  openProjectMenu();
});
projectChoices.forEach((choice) =>
  choice.addEventListener("click", () => switchStudyProject(choice.dataset.project)),
);
projectMenu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") return closeProjectMenu(true);
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  moveProjectFocus(event);
});
document.addEventListener("click", (event) => {
  if (projectMenu.hidden) return;
  if (event.target.closest(".project-switcher")) return;
  closeProjectMenu();
});
window.addEventListener("pagehide", () => {
  try {
    saveProjectSession();
  } catch {
    /* Switching explicitly handles storage failure. */
  }
});
updateProjectIdentity();
