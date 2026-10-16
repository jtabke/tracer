import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "../ui/api.ts";
const { App, ProjectError, ProjectTabs, ProjectPanel, NativePanel, projectError } =
  await import("./legacy-app.tsx");
const render = (element: React.ReactElement) => renderToStaticMarkup(element);

test("application initial render is a loading project, never an empty project or a mounted advanced view", () => {
  const markup = render(createElement(App));
  assert.match(markup, /Opening project/);
  assert.match(markup, /Refresh current data/);
  assert.doesNotMatch(markup, /Configure model|Graph workspace|Work workspace/);
});
test("project error provenance distinguishes uncertain saves, rejected proposals and failed reads", () => {
  const uncertain = projectError(new ApiError("outcome_unknown", "Response lost"), {
    expectedVersion: 3,
  });
  assert.equal(uncertain.uncertain, true);
  assert.match(
    render(createElement(ProjectError, { error: uncertain })),
    /save may have completed/,
  );
  const rejected = projectError(new ApiError("conflict", "Changed"), { statement: "<proposal>" });
  const markup = render(createElement(ProjectError, { error: rejected }));
  assert.match(markup, /Nothing was saved by the rejected operation/);
  assert.match(markup, /&lt;proposal&gt;/);
  assert.match(
    render(createElement(ProjectError, { error: projectError("Read failed") })),
    /This read failed/,
  );
  assert.equal(
    projectError(Error("Too large"), { text: "x".repeat(15000) }).attempted!.length,
    12000,
  );
});
test("primary project tabs retain active semantics without duplicating query tools", () => {
  const markup = render(
    createElement(ProjectTabs, {
      tab: "model",
      activate() {
        throw Error("render must not navigate");
      },
    }),
  );
  assert.match(markup, /id="tab-model" role="tab" aria-selected="true"/);
  for (const name of ["project", "workspace", "evidence", "configurations", "model"])
    assert.match(markup, new RegExp(`id="tab-${name}"`));
  assert.equal([...markup.matchAll(/role="tab"/g)].length, 5);
  assert.doesNotMatch(markup, /id="tab-(graph|table|matrix|work)"/);
});
test("Work and advanced routes expose the actual local query toolbar while retaining primary Work selection", () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const view of ["workspace", "graph"]) {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { location: { search: `?view=${view}` } },
      });
      const markup = render(createElement(App));
      assert.match(markup, /aria-label="Query tools"/);
      const graphButton = markup.match(/<button id="tab-graph"[^>]*>.*?<\/button>/)?.[0];
      assert.ok(graphButton);
      assert.match(graphButton, /Graph query/);
      assert.match(markup, /id="tab-workspace" role="tab" aria-selected="true"/);
      if (view === "graph") assert.match(markup, /id="tab-graph" role="tab" aria-selected="true"/);
      assert.match(markup, /Opening project/);
    }
  } finally {
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("project panels do not mount unvisited children and retain visited draft owners while hidden", () => {
  let mounted = 0;
  const Child = () => {
    mounted++;
    return createElement("span", null, "Draft owner");
  };
  const props = {
    name: "workspace",
    tab: "model",
    opened: new Set(["model"]),
    children: createElement(Child),
  };
  const unopened = render(createElement(ProjectPanel, props));
  assert.equal(mounted, 0);
  assert.doesNotMatch(unopened, /Draft owner/);
  const hidden = render(
    createElement(ProjectPanel, { ...props, opened: new Set(["model", "workspace"]) }),
  );
  assert.equal(mounted, 1);
  assert.match(hidden, /hidden=""/);
  assert.match(hidden, /Draft owner/);
});
test("native panel guards schema-dependent child execution without inventing an empty schema", () => {
  let mounted = false;
  const Child = () => {
    mounted = true;
    return createElement("span", null, "Native");
  };
  const props = {
    name: "workspace",
    tab: "workspace",
    opened: new Set(["workspace"]),
    children: createElement(Child),
    fallback: createElement("p", null, "Configure model"),
    schema: null,
  };
  assert.match(render(createElement(NativePanel, props)), /Configure model/);
  assert.equal(mounted, false);
});
