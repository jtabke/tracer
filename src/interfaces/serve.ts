import { resolve, join } from "node:path";
import { readDemoGuide } from "./demo-guide.ts";
import type { DemoGuide } from "./demo-guide.ts";
import { tmpdir } from "node:os";
import { SQLiteRepository } from "../persistence/sqlite.ts";
import { Tracer } from "../application/service.ts";
import { startLocalServer } from "./local-server.ts";
import { observeLocal } from "./local-observer.ts";
import { ensure } from "../core/model.ts";

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
ensure(Number.isInteger(port) && port >= 0 && port <= 65535, "usage", "Invalid port");
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
  const { seedDemo } = await import("../../examples/seed-demo.ts");
  const project = await seedDemo(destination, demoSize);
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
const secondaryGuide = secondaryGuidePath ? await readDemoGuide(secondaryGuidePath) : undefined;
let repository: SQLiteRepository | undefined;
let secondaryRepository: SQLiteRepository | undefined;
try {
  repository = new SQLiteRepository(db);
  secondaryRepository = secondaryDb ? new SQLiteRepository(secondaryDb) : undefined;
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
    try {
      await server.close();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      repository?.close();
      secondaryRepository?.close();
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch (error) {
  repository?.close();
  secondaryRepository?.close();
  throw error;
}

function shellArgument(value: string) {
  return "'" + value.replaceAll("'", `'"'"'`) + "'";
}
