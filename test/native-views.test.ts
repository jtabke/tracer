import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchemaObject } from "../src/core/model.ts";
import type { Editing } from "../ui/editing.ts";
const { TableView } = await import("./legacy-ui/components/table.tsx");
const { MatrixView } = await import("./legacy-ui/components/matrix.tsx");
const { TableWorkspace } = await import("./legacy-ui/components/chain-table.tsx");
const { EvidenceView } = await import("../ui/evidence.tsx");
const schema: SchemaObject = {
  id: "project",
  version: 3,
  entityTypes: { item: { fields: { statement: { type: "string", required: true } } } },
  relationshipTypes: { traces: { source: ["item"], target: ["item"], fields: {} } },
};
const editing: Editing = {
  async mutate() {
    throw Error("render must not mutate");
  },
  epoch: 0,
  busy: false,
  report(error) {
    throw error;
  },
  async commit() {
    throw Error("render must not write");
  },
};
const render = (element: React.ReactElement) => renderToStaticMarkup(element);
test("native table and matrix initial reads retain explicit loading boundaries and permitted types", () => {
  const table = render(createElement(TableView, { schema, editing }));
  assert.match(table, /Loading table/);
  assert.match(table, /Filter this page/);
  assert.doesNotMatch(table, /Add entity/);
  const matrix = render(createElement(MatrixView, { schema, editing }));
  assert.match(matrix, /Choose types to load the matrix/);
  assert.match(matrix, /New link attributes/);
  assert.match(matrix, /<option selected="">traces<\/option>/);
  const empty = { ...schema, entityTypes: {}, relationshipTypes: {} };
  assert.match(
    render(createElement(TableView, { schema: empty, editing })),
    /Define an entity type/,
  );
  assert.match(
    render(createElement(MatrixView, { schema: empty, editing })),
    /Define a relationship type/,
  );
});
test("relationship columns retain bounded scope, initial loading and lazy editable rows", () => {
  const markup = render(
    createElement(TableWorkspace, {
      schema,
      editing,
      onFocus() {
        throw Error("render must not select");
      },
    }),
  );
  assert.match(markup, /maximum 8 columns/);
  assert.match(markup, /1,000 links/);
  assert.match(markup, /Loading relationship chains/);
  assert.doesNotMatch(markup, /aria-label="Entity table"/);
});
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
