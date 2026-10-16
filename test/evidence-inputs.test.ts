import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Comparison, Receipt } from "../src/core/evidence.ts";
const { EvidenceInputs } = await import("../ui/evidence-inputs.tsx");
const output = { id: "output", key: "REPORT", version: 1, type: "item", fields: {} };
const entity = { id: "input", key: "REQ", version: 3, type: "item", fields: {} };
const schema: Receipt["schema"] = {
  id: "project",
  version: 1,
  entityTypes: { item: { fields: {} } },
  relationshipTypes: {},
};
function comparison(): Comparison {
  return {
    receiptId: "receipt",
    token: "pinned",
    state: "unknown",
    hasChanged: true,
    hasUnknown: true,
    review: { state: "unreviewed" },
    supersededBy: [],
    inputs: [
      {
        entityId: entity.id,
        dependencyPath: [output.id, entity.id],
        state: "unknown",
        hasChanged: true,
        hasUnknown: true,
        recorded: { entityId: entity.id, entity, links: [] },
        current: { entity: null, observation: null, links: [] },
        reasons: ["Deleted <input>"],
      },
    ],
  };
}
function render(value: Comparison, receipt?: Receipt, focusInputId?: string) {
  return renderToStaticMarkup(
    createElement(EvidenceInputs, { comparison: value, receipt, focusInputId }),
  );
}
test("evidence input rendering preserves captured labels/versions and escapes explanation text", () => {
  const value = comparison();
  const receipt: Receipt = {
    id: "receipt",
    at: "then",
    actor: "test",
    output,
    schema,
    outcome: "Recorded",
    inputs: [value.inputs[0].recorded],
  };
  const markup = render(value, receipt);
  assert.match(markup, /Direct dependency/);
  assert.match(markup, /REPORT · recorded v1/);
  assert.match(markup, /REQ · recorded v3/);
  assert.match(markup, /unavailable/);
  assert.match(markup, /Deleted &lt;input&gt;/);
  assert.match(markup, /Canonical dependency IDs/);
  assert.match(render(value), /output → input/);
});
test("external recorded versus latest observations remain separately named with truthful unknown fallbacks", () => {
  const value = comparison();
  value.inputs[0].recorded.observation = {
    id: "observed",
    entityId: entity.id,
    availability: "available",
    hash: "captured",
    locator: { system: "file", path: "fixture" },
    actor: "test",
    at: "then",
  };
  value.inputs[0].current.entity = { ...entity, version: 4 };
  const markup = render(value);
  assert.match(markup, /Recorded: file · captured/);
  assert.match(markup, /Last observed: file · unknown/);
  assert.match(markup, /v4/);
  assert.doesNotMatch(markup, /satisfied|passing/);
});

test("attention comes before matching inputs and declared field changes remain visible without opening details", () => {
  const value = comparison();
  const matching = {
    ...value.inputs[0],
    entityId: "matching",
    state: "current" as const,
    hasChanged: false,
    hasUnknown: false,
    recorded: { ...value.inputs[0].recorded, entity: { ...entity, key: "MATCHING" } },
    current: { ...value.inputs[0].current, entity },
    reasons: ["Declared native input matches"],
  };
  const unknown = {
    ...value.inputs[0],
    entityId: "unavailable",
    hasChanged: false,
    recorded: { ...value.inputs[0].recorded, entity: { ...entity, key: "UNAVAILABLE" } },
  };
  const changed = {
    ...value.inputs[0],
    entityId: "changed",
    state: "changed" as const,
    hasUnknown: false,
    recorded: {
      ...value.inputs[0].recorded,
      fields: ["statement", "limit", "removed"],
      entity: {
        ...entity,
        key: "CHANGED",
        fields: { statement: "Captured <criterion>", limit: 20, removed: "captured", notes: "old" },
      },
    },
    current: {
      ...value.inputs[0].current,
      entity: {
        ...entity,
        version: 4,
        fields: { statement: "Current criterion", limit: 30, notes: "unrelated new annotation" },
      },
    },
  };
  value.inputs = [matching, unknown, changed];
  const before = JSON.stringify(value);
  const markup = render(value);
  assert.ok(
    markup.indexOf('aria-label="CHANGED: changed"') <
      markup.indexOf('aria-label="UNAVAILABLE: unknown"'),
  );
  assert.ok(
    markup.indexOf('aria-label="UNAVAILABLE: unknown"') <
      markup.indexOf('aria-label="MATCHING: current"'),
  );
  const visibleChanges = markup.slice(
    markup.indexOf('class="evidence-field-changes"'),
    markup.indexOf("<details"),
  );
  assert.match(visibleChanges, /Captured &lt;criterion&gt;/);
  assert.match(visibleChanges, /Current criterion/);
  assert.match(visibleChanges, /20/);
  assert.match(visibleChanges, /30/);
  assert.match(visibleChanges, /Not recorded/);
  assert.doesNotMatch(visibleChanges, /notes|unrelated new annotation/);
  assert.equal(JSON.stringify(value), before);
});

test("unknown does not conceal a simultaneous known change or fabricate absent input content", () => {
  const markup = render(comparison());
  assert.match(markup, /changed · unknown/);
  assert.match(markup, /Current unavailable/);
  assert.match(markup, /Current input could not be read/);
  assert.doesNotMatch(markup, /Changed declared fields/);
});

test("an explicitly selected receipt input comes first without changing freshness or comparison order", () => {
  const value = comparison();
  const matchingEntity = { ...entity, id: "matching", key: "MATCHING" };
  value.inputs.push({
    ...value.inputs[0],
    entityId: matchingEntity.id,
    state: "current",
    hasChanged: false,
    hasUnknown: false,
    recorded: { entityId: matchingEntity.id, entity: matchingEntity, links: [] },
    current: { entity: matchingEntity, observation: null, links: [] },
    reasons: ["Declared native input matches"],
  });
  const markup = render(value, undefined, matchingEntity.id);
  assert.ok(
    markup.indexOf('aria-label="MATCHING: current"') < markup.indexOf('aria-label="REQ: unknown"'),
  );
  assert.match(markup, /is-current is-focused/);
  assert.match(markup, /Selected input MATCHING/);
  assert.match(markup, /changed · unknown/);
  assert.equal(value.inputs[0].entityId, entity.id);
});

test("focused comparison keeps the complete native input list after the exact selected diff", () => {
  const value = comparison();
  value.inputs[0].current.entity = {
    ...entity,
    version: 4,
    fields: { statement: "Changed statement", limit: 30, nested: { retained: true } },
  };
  value.inputs[0].recorded.entity.fields = {
    statement: "Captured statement",
    limit: 20,
    nested: { retained: false },
  };
  value.inputs[0].hasUnknown = false;
  value.inputs[0].state = "changed";
  const matching = {
    ...entity,
    id: "matching",
    key: "MATCHING",
    fields: { statement: "Exact unchanged statement" },
  };
  value.inputs.push({
    ...value.inputs[0],
    entityId: matching.id,
    state: "current",
    hasChanged: false,
    hasUnknown: false,
    recorded: { entityId: matching.id, entity: matching, links: [] },
    current: { entity: matching, observation: null, links: [] },
    reasons: ["Native fields match"],
  });
  const before = JSON.stringify(value);
  const markup = renderToStaticMarkup(
    createElement(EvidenceInputs, {
      comparison: value,
      focusInputId: matching.id,
      mode: "focused",
    }),
  );
  assert.match(markup, /Selected input MATCHING/);
  assert.match(markup, /Exact unchanged statement/);
  assert.match(markup, /Declared inputs · 2/);
  assert.match(markup, /Compare input REQ/);
  assert.match(markup, /Compare input MATCHING/);
  assert.match(markup, /Captured v3/);
  assert.match(markup, /Current v4/);
  assert.ok(
    markup.indexOf('aria-label="Selected input comparison"') <
      markup.indexOf('aria-label="Complete declared inputs"'),
  );
  assert.doesNotMatch(markup, /<details[^>]*>\s*<summary>Declared inputs/);
  assert.equal(JSON.stringify(value), before);
});

test("focused comparison prioritizes a known change while preserving unavailable capture and original native records", () => {
  const value = comparison();
  value.inputs[0].recorded.entity = {
    ...entity,
    fields: { statement: "Unavailable input retained capture", nested: { original: "native" } },
  };
  value.inputs[0].hasChanged = false;
  const changedEntity = {
    ...entity,
    id: "changed",
    key: "CHANGED",
    fields: { statement: "Captured criterion", limit: 20 },
  };
  value.inputs.push({
    ...value.inputs[0],
    entityId: changedEntity.id,
    state: "changed",
    hasChanged: true,
    hasUnknown: false,
    recorded: { entityId: changedEntity.id, entity: changedEntity, links: [] },
    current: {
      entity: {
        ...changedEntity,
        version: 4,
        fields: { statement: "Current criterion", limit: 30 },
      },
      observation: null,
      links: [],
    },
    reasons: ["Declared fields changed"],
  });
  const focused = renderToStaticMarkup(
    createElement(EvidenceInputs, { comparison: value, mode: "focused" }),
  );
  assert.match(focused, /Selected input CHANGED/);
  assert.match(focused, /Captured criterion/);
  assert.match(focused, /Current criterion/);
  const visible = focused.slice(0, focused.indexOf("<details"));
  assert.equal(visible.match(/Captured criterion/g)?.length, 1);
  assert.match(focused, /Changed declared fields/);
  assert.match(focused, /Original native fields and relationship records/);
  assert.match(focused, /Compare input REQ/);
  const unknown = renderToStaticMarkup(
    createElement(EvidenceInputs, { comparison: value, focusInputId: entity.id, mode: "focused" }),
  );
  assert.match(unknown, /Unavailable input retained capture/);
  assert.match(unknown, /Current input could not be read/);
  assert.match(unknown, /&quot;original&quot;: &quot;native&quot;/);
  assert.match(unknown, /Compare input CHANGED/);
});
