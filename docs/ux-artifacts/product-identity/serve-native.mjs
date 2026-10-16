import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { seedRealisticProject } from "../../../examples/seed-realistic-project.ts";
import { SQLiteRepository } from "../../../src/persistence/sqlite.ts";
import { Tracer } from "../../../src/application/service.ts";
import { startLocalServer } from "../../../src/interfaces/local-server.ts";
import { readDemoGuide } from "../../../src/interfaces/demo-guide.ts";
const root = dirname(fileURLToPath(import.meta.url));
const directory =
  process.env.TRACER_STUDY_DIRECTORY ?? (await mkdtemp(join(tmpdir(), "tracer-workbench-")));
let prior;
try {
  prior = JSON.parse(await readFile(join(directory, "preview-info.json"), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const database =
  prior?.database ?? (await seedRealisticProject(join(directory, "aster"), "medical")).database;
const secondaryDatabase =
  prior?.secondaryDatabase ??
  (await seedRealisticProject(join(directory, "gatherline"), "technology")).database;
const assets = process.env.TRACER_STUDY_ASSETS ?? join(directory, "preview");
if (!process.env.TRACER_STUDY_ASSETS)
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    build: { outDir: assets, emptyOutDir: true },
  });
const repository = new SQLiteRepository(database);
const secondaryRepository = new SQLiteRepository(secondaryDatabase);
let server;
try {
  server = await startLocalServer(
    new Tracer(repository),
    assets,
    Number(process.env.TRACER_STUDY_PORT ?? 8174),
    await readDemoGuide(join(dirname(database), "tasks.json")),
    [
      {
        id: "gatherline",
        title: "Gatherline",
        tracer: new Tracer(secondaryRepository),
        guide: await readDemoGuide(join(dirname(secondaryDatabase), "tasks.json")),
      },
    ],
  );
} catch (error) {
  repository.close();
  secondaryRepository.close();
  throw error;
}
await writeFile(
  join(directory, "preview-info.json"),
  JSON.stringify({ database, secondaryDatabase, origin: server.origin }),
);
// The static review can offer actual configured databases without cross-origin API access.
const catalogue = await fetch(server.origin + "/api/projects").then((response) => response.json());
const output = new URL("../../../output/product-identity/", import.meta.url);
await mkdir(output, { recursive: true });
if (process.env.TRACER_STUDY_CATALOG !== "0")
  await writeFile(
    new URL("native-projects.json", output),
    JSON.stringify(catalogue.map((project) => ({ ...project, url: server.origin + "/" }))),
  );
console.log(
  `Native workbench: ${server.origin}/?presentation=1&native=1\nAster database: ${database}\nGatherline database: ${secondaryDatabase}\nResume: TRACER_STUDY_DIRECTORY=${directory} node docs/ux-artifacts/product-identity/serve-native.mjs`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await server.close();
    repository.close();
    secondaryRepository.close();
  });
