import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const studyRoot = fileURLToPath(new URL("./", import.meta.url));
export const repositoryRoot = resolve(studyRoot, "../..");
export function disposableOrigin(value = process.env.TRACER_NATIVE_ORIGIN) {
  assert.ok(
    value,
    "Use the fixture runner or explicitly set TRACER_NATIVE_ORIGIN to a disposable server.",
  );
  const url = new URL(value);
  assert.equal(url.hostname, "127.0.0.1", "Verification writes are local only.");
  assert.notEqual(url.port, "8174", "Never mutate the persistent review server.");
  return url.origin;
}
export function reviewFolder() {
  const output = resolve(repositoryRoot, "output/product-identity");
  const folder = resolve(output, process.env.TRACER_CAPTURE_NAME ?? "workbench-review");
  assert.ok(folder.startsWith(output + sep), "Keep review artifacts inside ignored output.");
  return folder + sep;
}
export async function runScript(file, env = {}) {
  const child = spawn(process.execPath, [join(studyRoot, file)], {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  const [code, signal] = await once(child, "exit");
  assert.equal(code, 0, `${file} failed (${signal ?? code}).`);
}
export async function startFixture(assets) {
  const directory = await mkdtemp(join(tmpdir(), "tracer-verification-"));
  const child = spawn(process.execPath, [join(studyRoot, "serve-native.mjs")], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      TRACER_STUDY_DIRECTORY: directory,
      TRACER_STUDY_ASSETS: assets,
      TRACER_STUDY_PORT: "0",
      TRACER_STUDY_CATALOG: "0",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const exited = once(child, "exit");
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
    await rm(directory, { recursive: true, force: true });
  };
  let timeout;
  try {
    const origin = await new Promise((resolveOrigin, reject) => {
      let output = "";
      timeout = setTimeout(() => reject(new Error("Fixture startup timed out.")), 30000);
      child.on("error", reject);
      child.once("exit", () => reject(new Error("Fixture exited before startup.")));
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/Native workbench: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) resolveOrigin(match[1]);
      });
    });
    return { origin, close };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
