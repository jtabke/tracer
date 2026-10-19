import { resolve, join } from "node:path";
import { inNewProject } from "../../examples/isolated-project.ts";
import { seedWorkspace } from "../../examples/seed-workspace.ts";
import { seedRealisticProject } from "../../examples/seed-realistic-project.ts";
import { readDemoGuide } from "./demo-guide.ts";
import type { DemoGuide } from "./demo-guide.ts";
import { tmpdir } from "node:os";
import { seedProject } from "../../examples/seed-project.ts";
import { seedScaleProject } from "../../examples/seed-scale-project.ts";
import { SQLiteRepository } from "../persistence/sqlite.ts";
import { Tracer } from "../application/service.ts";
import { startLocalServer } from "./local-server.ts";
import { observeLocal } from "./local-observer.ts";

let db = "tracer.sqlite",
  port = 4317;
let headless = false;
let seeded = false,
  explicitDatabase = false;
let demoSize = "integrated";
let explicitSize = false;
let guidePath: string | undefined;
let guide: DemoGuide | undefined;
let secondaryDb: string | undefined;
let secondaryGuidePath: string | undefined;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--help") {
    console.log(
      "npm start -- [--db project.sqlite [--guide tasks.json] | --seed-demo [--demo-size integrated|medical|technology|working|large|small|software|engineering|empty]] [--secondary-db second.sqlite [--secondary-guide tasks.json]] [--port 4317] [--headless]",
    );
    process.exit(0);
  }
  if (args[index] === "--headless") {
    headless = true;
    continue;
  }
  if (args[index] === "--seed-demo") {
    seeded = true;
    continue;
  }
  const flag = args[index];
  const value = args[++index];
  if (
    !value ||
    !["--db", "--port", "--demo-size", "--guide", "--secondary-db", "--secondary-guide"].includes(
      flag,
    )
  )
    throw new Error(
      "Use --db PATH, --guide tasks.json, --seed-demo, --demo-size integrated|medical|technology|working|large|small|software|engineering|empty or --port NUMBER",
    );
  if (flag === "--db") {
    db = value;
    explicitDatabase = true;
  } else if (flag === "--demo-size") {
    demoSize = value;
    explicitSize = true;
  } else if (flag === "--secondary-db") secondaryDb = value;
  else if (flag === "--secondary-guide") secondaryGuidePath = value;
  else if (flag === "--guide") guidePath = value;
  else port = Number(value);
}
if (seeded && explicitDatabase)
  throw new Error("--seed-demo cannot be combined with --db; existing projects are never seeded");
if (guidePath && (!explicitDatabase || seeded))
  throw new Error("--guide requires an explicit --db project");
if (
  ![
    "working",
    "large",
    "small",
    "software",
    "engineering",
    "medical",
    "technology",
    "integrated",
    "empty",
  ].includes(demoSize) ||
  (explicitSize && !seeded)
)
  throw new Error(
    "--demo-size requires --seed-demo and working, large, small, software, engineering, medical, technology, integrated or empty",
  );
if (secondaryGuidePath && !secondaryDb)
  throw new Error("--secondary-guide requires --secondary-db");
if (seeded && secondaryDb)
  throw new Error("--seed-demo creates an isolated project; do not combine it with --secondary-db");
if (seeded) {
  const destination = join(tmpdir(), "tracer-demo-" + crypto.randomUUID());
  const project =
    demoSize === "medical" || demoSize === "technology" || demoSize === "integrated"
      ? await seedRealisticProject(destination, demoSize)
      : demoSize === "empty"
        ? await inNewProject(destination, async (_tracer, paths) => paths)
        : demoSize === "software" || demoSize === "engineering"
          ? await seedWorkspace(destination, demoSize)
          : demoSize === "small"
            ? await seedProject(destination)
            : await seedScaleProject(destination, demoSize as "working" | "large");
  db = project.database;
  if ("tasks" in project && Array.isArray(project.tasks)) {
    guidePath = join(project.directory, "tasks.json");
    console.log(
      `Example walkthrough: ${project.directory}/GUIDE.md\nTrace queries and task URLs: ${project.directory}/tasks.json`,
    );
  }
  console.log(
    `Example project: ${project.directory}\nEach demo launch creates a fresh project. Saved edits remain in its database; use Resume saved setup below to reopen it.`,
  );
}
if (guidePath) guide = await readDemoGuide(guidePath);
if (secondaryDb && resolve(secondaryDb) === resolve(db))
  throw new Error("Projects must use different database files");
const repository = new SQLiteRepository(db);
const secondaryRepository = secondaryDb ? new SQLiteRepository(secondaryDb) : undefined;
try {
  const secondaryGuide = secondaryGuidePath ? await readDemoGuide(secondaryGuidePath) : undefined;
  const server = await startLocalServer(
    new Tracer(repository, undefined, observeLocal),
    headless ? undefined : resolve("dist"),
    port,
    guide,
    secondaryRepository
      ? [
          {
            id: "second",
            title: secondaryGuide?.title.split(" — ")[0] ?? "Second project",
            tracer: new Tracer(secondaryRepository, undefined, observeLocal),
            guide: secondaryGuide,
          },
        ]
      : [],
    headless ? { actor: "local-api", reason: "Headless operation" } : undefined,
  );
  const resume = [
    headless ? "npm run serve:api -- --db" : "npm start -- --db",
    shellArgument(resolve(db)),
    "--port",
    new URL(server.origin).port || "80",
  ];
  if (guidePath) resume.push("--guide", shellArgument(resolve(guidePath)));
  if (secondaryDb) resume.push("--secondary-db", shellArgument(resolve(secondaryDb)));
  if (secondaryGuidePath)
    resume.push("--secondary-guide", shellArgument(resolve(secondaryGuidePath)));
  console.log(
    `Tracer: ${server.origin}/\nDatabase: ${resolve(db)}\nResume saved setup: ${resume.join(" ")}\nCtrl+C to close.`,
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await server.close();
    repository.close();
    secondaryRepository?.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  repository.close();
  secondaryRepository?.close();
  throw error;
}

function shellArgument(value: string) {
  return "'" + value.replaceAll("'", `'"'"'`) + "'";
}
