import { createRoot } from "react-dom/client";

if (new URLSearchParams(location.search).get("workspace") !== "map") {
  document.body.dataset.direction = "atlas";
  document.body.classList.add("presentation");
  document.getElementById("root")!.innerHTML =
    `<div id="app"></div><dialog id="workspace-dialog" aria-labelledby="dialog-title"></dialog><div class="sr-only" role="status" id="announcement"></div>`;
  void import("./workbench/app.js").then(({ startWorkbench }) => startWorkbench());
} else {
  void import("./unified-app.tsx").then(({ UnifiedApp }) => {
    createRoot(document.getElementById("root")!).render(<UnifiedApp />);
  });
}
