import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import { statementText } from "../ui/statement-text.ts";
import { projectWorkspace } from "../ui/workbench/workspace-snapshot.ts";
const { ConfigurationDetails } = await import("../ui/configurations/details.tsx");

test("production workspace and captured configurations preserve structured, false, zero and null statements without writes", () => {
  const schema: SchemaObject = {
    id: "project",
    version: 1,
    entityTypes: {
      requirement: { fields: { title: { type: "string" }, statement: { type: "json" } } },
    },
    relationshipTypes: {},
  };
  for (const statement of [
    { queuedIds: ["operation-1", "operation-2"], acknowledged: false },
    [0, false],
    0,
    false,
    null,
  ]) {
    const entity: Entity = {
      id: "item",
      key: "REQ-JSON",
      type: "requirement",
      version: 1,
      fields: { statement, title: "Fallback title" },
    };
    const before = structuredClone(entity);
    const expected = statement === null ? "Fallback title" : JSON.stringify(statement);
    assert.equal(statementText(entity), expected);
    const projected = projectWorkspace(
      { schema, projectRevision: 1, entities: [entity], relationships: [] },
      [],
      [],
    );
    assert.equal(projected.entities[0].statement, expected);
    assert.deepEqual(entity, before);
    const capture = renderToStaticMarkup(
      createElement(ConfigurationDetails, {
        value: {
          id: "capture",
          name: "Pinned statement",
          at: "2026-10-13T00:00:00Z",
          actor: "renderer-test",
          subject: entity,
          members: [
            {
              entity,
              schema,
              projectRevision: 1,
              revisionId: "revision",
              changesetId: "changeset",
            },
          ],
        },
      }),
    );
    const pinnedText = renderToStaticMarkup(
      createElement("p", { className: "configuration-pinned-statement" }, expected),
    );
    assert.ok(capture.includes(pinnedText));
    assert.doesNotMatch(capture, /\[object Object\]/);
    assert.deepEqual(entity, before);
  }
});
