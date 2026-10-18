import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import postcss from "postcss";

const directory = "ui/workbench/styles/";
const entry = postcss.parse(readFileSync("ui/workbench/workspace.css", "utf8"));
const imports: string[] = [];
entry.walkAtRules("import", (rule) => {
  imports.push(rule.params.replace(/^"\.\/styles\//, "").replace(/"$/, ""));
});
const sheets = imports.map((name) => postcss.parse(readFileSync(directory + name, "utf8")));

test("workbench entry imports every stylesheet exactly once", () => {
  assert.equal(new Set(imports).size, imports.length);
  assert.deepEqual(
    [...imports].sort(),
    readdirSync(directory)
      .filter((f) => f.endsWith(".css"))
      .sort(),
  );
  assert.equal(imports[0], "base.css");
  assert.deepEqual(imports.slice(-2), ["search.css", "editing.css"]);
});

test("workbench custom properties resolve to theme or explicit runtime owners", () => {
  // Inspector rendering and graph-layout.ts supply these per-element dimensions.
  const defined = new Set(["--inspector-width", "--inspector-overlap", "--camera-zoom"]);
  for (const sheet of sheets)
    sheet.walkDecls(/^--/, (decl) => {
      defined.add(decl.prop);
    });
  for (const sheet of sheets)
    sheet.walkDecls((decl) => {
      for (const match of decl.value.matchAll(/var\((--[\w-]+)/g)) {
        assert.ok(
          defined.has(match[1]),
          `${decl.prop}: ${decl.value} references undefined ${match[1]}`,
        );
      }
    });
});

test("workbench colors use valid hexadecimal lengths", () => {
  for (const sheet of sheets)
    sheet.walkDecls((decl) => {
      for (const match of decl.value.matchAll(/#([\da-f]+)\b/gi)) {
        assert.ok([3, 4, 6, 8].includes(match[1].length), `Invalid color: ${decl.value}`);
      }
    });
});
