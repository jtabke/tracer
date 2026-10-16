import { test as base, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import v8ToIstanbul from "v8-to-istanbul";
import coverage from "istanbul-lib-coverage";
import { pathToFileURL } from "node:url";
export * from "@playwright/test";

type Script = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>[number];
async function recordedScript(script: Script) {
  if (!script.source) return null;
  const asset = basename(new URL(script.url).pathname);
  const file = [resolve("dist/assets", asset), resolve(".fallow/legacy-ui/assets", asset)].find(
    (file) => existsSync(file),
  );
  if (!file || !existsSync(file + ".map")) return null;
  const converter = v8ToIstanbul(
    file,
    0,
    {
      source: script.source,
      originalSource: "",
      sourceMap: { sourcemap: JSON.parse(readFileSync(file + ".map", "utf8")) },
    },
    (path) => path.includes("/node_modules/"),
  );
  await converter.load();
  converter.applyCoverage(script.functions);
  const url = pathToFileURL(file).href;
  return {
    istanbul: converter.toIstanbul(),
    script: { scriptId: script.scriptId, url, functions: script.functions },
    url,
    mapping: JSON.parse(readFileSync(file + ".map", "utf8")),
    lineLengths: script.source.split("\n").map((line) => line.length),
  };
}

type Capture = { save(restart?: boolean): Promise<void> };
const captures = new WeakMap<Page, Capture>();
export async function closeTestPage(page: Page, close = false) {
  await captures.get(page)?.save();
  if (page.isClosed()) return;
  if (close) await page.close();
  else await page.goto("about:blank");
}
// Capture before fixture cleanup navigates away; teardown remains a fallback for plain tests.
export const test = base.extend({
  page: async ({ page }, use, info) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    const measured = coverage.createCoverageMap({});
    const name = `${info.workerIndex}-${info.testId.replaceAll(/[^a-zA-Z0-9-]/g, "_")}`;
    let collecting = true,
      sequence = 0;
    const capture: Capture = {
      async save(restart = false) {
        if (!collecting) return;
        collecting = false;
        const entries = (await page.coverage.stopJSCoverage()).filter((entry) =>
          entry.url.startsWith("http"),
        );
        const records = [];
        for (const script of entries) {
          const result = await recordedScript(script);
          if (result) {
            measured.merge(result.istanbul);
            records.push(result);
          }
        }
        const output = resolve(".fallow/coverage");
        mkdirSync(resolve(output, "browser"), { recursive: true });
        mkdirSync(resolve(output, "raw"), { recursive: true });
        writeFileSync(
          resolve(output, "browser", name + ".json"),
          JSON.stringify(measured.toJSON()),
        );
        writeFileSync(
          resolve(output, "raw", `${name}-${sequence++}.json`),
          JSON.stringify({
            result: records.map((record) => record.script),
            "source-map-cache": Object.fromEntries(
              records.map((record) => [
                record.url,
                { data: record.mapping, lineLengths: record.lineLengths, url: record.url + ".map" },
              ]),
            ),
          }),
        );
        if (restart) {
          await page.coverage.startJSCoverage({ resetOnNavigation: false });
          collecting = true;
        }
      },
    };
    // Snapshot counters before navigation destroys its execution context.
    const goto = page.goto.bind(page),
      reload = page.reload.bind(page);
    page.goto = async (...args) => {
      await capture.save(true);
      return goto(...args);
    };
    page.reload = async (...args) => {
      await capture.save(true);
      return reload(...args);
    };
    captures.set(page, capture);
    try {
      await use(page);
    } finally {
      await capture.save();
      captures.delete(page);
      page.goto = goto;
      page.reload = reload;
    }
  },
});
