import { inNewProject } from "./isolated-project.ts";
import { seedWorkspace } from "./seed-workspace.ts";
import { seedRealisticProject } from "./seed-realistic-project.ts";
import { seedProject } from "./seed-project.ts";
import { seedScaleProject } from "./seed-scale-project.ts";

/** Loaded only for an explicit demo launch, never by ordinary API or browser startup. */
export async function seedDemo(destination: string, size: string) {
  if (size === "medical" || size === "technology" || size === "integrated")
    return seedRealisticProject(destination, size);
  if (size === "empty") return inNewProject(destination, async (_tracer, paths) => paths);
  if (size === "software" || size === "engineering") return seedWorkspace(destination, size);
  if (size === "small") return seedProject(destination);
  if (size === "working" || size === "large") return seedScaleProject(destination, size);
  throw new Error("Unknown demo size");
}
