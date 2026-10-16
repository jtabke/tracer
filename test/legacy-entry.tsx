// Test-only mount for existing editor/query contract regressions. Never shipped by the app build.
import { createRoot } from "react-dom/client";
import { App } from "./legacy-app.tsx";
createRoot(document.getElementById("root")!).render(<App />);
