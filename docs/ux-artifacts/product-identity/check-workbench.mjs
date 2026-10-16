import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, createServer } from "vite";
import { runScript, startFixture, studyRoot, repositoryRoot } from "./verification-fixtures.mjs";

// One build, isolated databases per mutating suite, automatic server/database cleanup.
const directory = await mkdtemp(join(tmpdir(), "tracer-workbench-check-"));
const assets = join(directory, "assets");
const fixtures = [];
let staticServer;
try {
  await build({
    configFile: false,
    root: studyRoot,
    logLevel: "warn",
    build: { outDir: assets, emptyOutDir: true },
  });
  const fixture = async () => {
    const value = await startFixture(assets);
    fixtures.push(value);
    return value;
  };
  if (!process.argv.includes("--screenshots-only")) {
    await runScript("verify-snapshot.ts");
    await runScript("verify-authoring-policy.mjs");
    await runScript("build-data.mjs");
    staticServer = await createServer({
      configFile: false,
      root: repositoryRoot,
      server: { host: "127.0.0.1", port: 0 },
    });
    await staticServer.listen();
    const port = staticServer.httpServer.address().port;
    await runScript("verify.mjs", { TRACER_STUDY_ORIGIN: `http://127.0.0.1:${port}` });
    await staticServer.close();
    staticServer = null;
    for (const file of [
      "verify-native.mjs",
      "verify-matrix-editor.mjs",
      "verify-workbench.mjs",
      "verify-authoring-refinement.mjs",
      "verify-assessment-safety.mjs",
    ]) {
      const instance = await fixture();
      const env = { TRACER_NATIVE_ORIGIN: instance.origin };
      if (file === "verify-assessment-safety.mjs") await runScript("prepare-assessment.mjs", env);
      await runScript(file, env);
      await instance.close();
      fixtures.pop();
    }
  }
  const desktop = await fixture(),
    narrow = await fixture();
  for (const value of [desktop, narrow])
    await runScript("prepare-assessment.mjs", { TRACER_NATIVE_ORIGIN: value.origin });
  await runScript("verify-assessment-flow.mjs", {
    TRACER_DESKTOP_PORT: new URL(desktop.origin).port,
    TRACER_NARROW_PORT: new URL(narrow.origin).port,
  });
  await runScript("verify-controls.mjs", { TRACER_NATIVE_ORIGIN: desktop.origin });
  await runScript("verify-workflow-layout.mjs", {
    TRACER_NATIVE_ORIGIN: desktop.origin,
    TRACER_FLOW_KEY: "PRS-02",
  });
  await runScript("package-review.mjs");
} finally {
  await staticServer?.close();
  for (const instance of fixtures.reverse()) await instance.close();
  await rm(directory, { recursive: true, force: true });
}
