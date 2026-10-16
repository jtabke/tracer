import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Entity, SchemaObject } from "../src/core/model.ts";
import type { FamilyWorkspace } from "../src/application/views.ts";
import type { WorkspaceActions } from "./legacy-ui/components/workspace-context.tsx";
import { statementText } from "../ui/statement-text.ts";
import type { Editing } from "../ui/editing.ts";
const { WorkspaceReading } = await import("./legacy-ui/components/workspace-reading.tsx");
const { FamilyStatement } = await import("./legacy-ui/components/workspace-statement.tsx");
const { ConfigurationDetails } = await import("../ui/configuration-details.tsx");
const { WorkspaceContext } = await import("./legacy-ui/components/workspace-context.tsx");
const { NewItemDialog, MappingDialog } =
  await import("./legacy-ui/components/workspace-dialogs.tsx");

test("Working views, authoring context and captured connection endpoints preserve native statements", () => {
  const values = [
    { queuedIds: ["operation-1", "operation-2"], acknowledged: false },
    [0, false],
    0,
    false,
    null,
  ];
  const actions: WorkspaceActions = {
    paused: false,
    dirty: false,
    onChoose() {},
    onInspect() {},
    onMap() {},
  };
  const editing: Editing = {
    busy: false,
    epoch: 0,
    mutate: async () => undefined,
    commit: async () => {
      assert.fail("Reading statement content must not commit an operation");
    },
    report(error) {
      assert.fail(String(error));
    },
  };
  for (const statement of values) {
    const entity: Entity = {
      id: "item",
      key: "REQ-JSON",
      type: "requirement",
      version: 1,
      fields: { statement, title: "Fallback title" },
    };
    const data: FamilyWorkspace = {
      schema: { id: "project", version: 1, entityTypes: {}, relationshipTypes: {} },
      projectRevision: 1,
      root: entity,
      members: [entity],
      membership: [],
      connections: [{ entityId: entity.id, total: 0, loaded: 0 }],
      nodes: [entity],
      links: [],
    };
    const expected = statement === null ? "Fallback title" : JSON.stringify(statement);
    assert.equal(statementText(entity), expected);
    const text = renderToStaticMarkup(createElement("p", null, expected));
    const family = renderToStaticMarkup(createElement(FamilyStatement, { entity, actions }));
    const reading = renderToStaticMarkup(createElement(WorkspaceReading, { data, actions }));
    // A title fallback is now the row heading; its complete escaped content
    // must remain present regardless of the surrounding presentation element.
    assert.ok(family.includes(text.slice(3, -4)));
    assert.ok(reading.includes(text));
    assert.doesNotMatch(reading, /\[object Object\]/);
    for (const meaning of ["fixture", ""]) {
      const relationships = renderToStaticMarkup(
        createElement(WorkspaceContext, {
          data,
          meaning,
          direction: "incoming",
          view: "relationships",
          actions,
          columns: [],
          onColumns() {},
          onArtifact() {},
        }),
      );
      const preview = renderToStaticMarkup(
        createElement("p", meaning ? { className: "workspace-member-preview" } : null, expected),
      );
      assert.ok(relationships.includes(preview));
      assert.doesNotMatch(relationships, /\[object Object\]/);
    }
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
              schema: data.schema,
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
    const schema: SchemaObject = {
      id: "project",
      version: 1,
      entityTypes: {
        requirement: { fields: { title: { type: "string" }, statement: { type: "json" } } },
      },
      relationshipTypes: {
        relates_to: { source: ["requirement"], target: ["requirement"], fields: {} },
      },
    };
    const mapping = renderToStaticMarkup(
      createElement(MappingDialog, {
        source: entity,
        initialTarget: { ...entity, id: "target", key: "REQ-TARGET" },
        schema,
        editing,
        paused: false,
        stage: true,
        onClose() {},
      }),
    );
    const capturedStatement = renderToStaticMarkup(
      createElement("p", { className: "workspace-captured-statement" }, expected),
    );
    const authoring = renderToStaticMarkup(
      createElement(NewItemDialog, {
        schema,
        editing,
        context: { source: entity, siblings: [] },
        onCreated() {},
        onClose() {},
      }),
    );
    assert.deepEqual(
      {
        capturedEndpoints: mapping.split(capturedStatement).length - 1,
        authoringContext: authoring.includes(text),
      },
      { capturedEndpoints: 2, authoringContext: true },
    );
    assert.doesNotMatch(mapping, /\[object Object\]/);
    assert.doesNotMatch(authoring, /\[object Object\]/);
  }
});
