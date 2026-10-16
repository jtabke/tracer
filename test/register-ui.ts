import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Node's native TypeScript runner does not parse JSX. Use the existing compiler
// for real server-rendered component tests; styling remains browser-tested.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: new URL(url).pathname,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    }).outputText;
    return { format: "module", source, shortCircuit: true };
  },
});
