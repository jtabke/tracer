import { seedProject } from "./seed-project.ts";
import { seedScaleProject } from "./seed-scale-project.ts";
import { seedRealisticProject } from "./seed-realistic-project.ts";

if (process.argv[2] === "--help") {
  console.log(
    "npm run seed -- [NEW_DIRECTORY] [--size small|working|large|medical|technology|integrated]\nDefaults to the small offline example. Existing directories are never overwritten.",
  );
} else {
  const args = process.argv.slice(2);
  const destination = args[0] && !args[0].startsWith("--") ? args.shift()! : "tracer-demo";
  let size = "small";
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--size")
      throw new Error(
        "Use npm run seed -- [NEW_DIRECTORY] [--size small|working|large|medical|technology|integrated]",
      );
    size = args[1];
  }
  if (!["small", "working", "large", "medical", "technology", "integrated"].includes(size))
    throw new Error("Size must be small, working, large, medical, technology or integrated");
  const project =
    size === "medical" || size === "technology" || size === "integrated"
      ? await seedRealisticProject(destination, size)
      : size === "small"
        ? await seedProject(destination)
        : await seedScaleProject(destination, size as "working" | "large");
  console.log(
    `Seeded project: ${project.directory}\nStart: npm start -- --db ${JSON.stringify(project.database)}\nTask/scenario guide: ${project.directory}/${size === "small" ? "scenarios.json" : "tasks.json"}`,
  );
}
