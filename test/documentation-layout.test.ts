import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function markdownFiles() {
  return [
    "README.md",
    "SUPPORT.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "test/workbench/README.md",
    "test/README.md",
    "ui/README.md",
    ...readdirSync("docs", { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".md"))
      .map((file) => `docs/${file}`),
  ];
}
test("maintained documentation links resolve without private data or archived study directories", () => {
  const failures: string[] = [];
  for (const file of markdownFiles()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const href = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) continue;
      const path = resolve(dirname(file), decodeURIComponent(href.split(/[?#]/)[0]));
      if (!existsSync(path)) failures.push(`${file}: ${href}`);
      if (path.includes("/.local/") || path.includes("/docs/ux-artifacts/"))
        failures.push(`${file}: private/archived target ${href}`);
    }
  }
  assert.deepEqual(failures, []);
});
