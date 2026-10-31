import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Editing } from "../ui/editing.ts";
const { EvidenceView } = await import("../ui/evidence.tsx");
const editing: Editing = {
  busy: false,
  epoch: 0,
  mutate: async () => {
    throw Error("render must not mutate");
  },
  commit: async () => {
    throw Error("render must not commit");
  },
  report(error) {
    throw error;
  },
};
const render = (element: React.ReactElement) => renderToStaticMarkup(element);
test("evidence tasks remain independent with one required declared input and no invented comparison", () => {
  const markup = render(
    createElement(EvidenceView, {
      mutate: editing.mutate,
      epoch: 0,
      changed() {
        throw Error("render must not write");
      },
      report(error) {
        throw error;
      },
    }),
  );
  assert.match(markup, /class="[^"]*\bevidence-create\b/);
  assert.match(markup, /Observe an external artifact/);
  assert.match(markup, /Declared input 1/);
  assert.match(markup, /disabled="">Remove input 1/);
  assert.match(markup, /aria-label="Recorded evaluation results"/);
  assert.doesNotMatch(markup, /Freshness:/);
});
