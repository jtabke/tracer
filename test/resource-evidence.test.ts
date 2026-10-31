import "./register-ui.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Comparison, InputComparison, RelationshipComparison } from "../src/core/evidence.ts";
const { EvidenceInputs } = await import("../ui/evidence/inputs.tsx");
const resource = {
  id: "resource",
  type: "@resource",
  version: 1,
  fields: {},
  resource: {
    label: "Customer <specification>",
    source: { system: "file" as const, externalId: "customer-spec" },
  },
};
const source = { id: "source", key: "REQ-104", type: "requirement", version: 3, fields: {} };
const observation = {
  id: "observed-A",
  entityId: resource.id,
  availability: "available" as const,
  hash: "captured-hash",
  locator: { system: "git" as const, repository: "repo", path: "spec.md", ref: "main" },
  at: "2026-10-23",
  actor: "test",
  commit: "captured-commit",
};
function input(): InputComparison {
  return {
    entityId: resource.id,
    dependencyPath: [source.id, resource.id],
    state: "changed",
    hasChanged: true,
    hasUnknown: false,
    reasons: ["Content changed"],
    recorded: {
      entityId: resource.id,
      entity: resource,
      observation,
      facet: "content",
      links: [],
      role: "design input",
    },
    current: {
      entity: { ...resource, resource: { label: "Renamed source" } },
      observation: { ...observation, id: "observed-B", hash: "latest-hash", at: "2026-10-24" },
      links: [],
    },
  };
}
function relationship(): RelationshipComparison {
  return {
    id: "ref-A",
    state: "current",
    hasChanged: false,
    hasUnknown: false,
    reasons: ["Reference unchanged"],
    current: null,
    recorded: {
      revisionId: "revision",
      changesetId: "changeset",
      projectRevision: 1,
      schema: { id: "project", version: 1, entityTypes: {}, relationshipTypes: {} },
      role: "acceptance basis",
      source,
      target: resource,
      relationship: {
        id: "ref-A",
        type: "cites",
        source: source.id,
        target: resource.id,
        version: 2,
        fields: {},
        reference: {
          role: "definition",
          explanation: "Defines the limit",
          selector: { kind: "section", value: "4.2" },
          state: { mode: "pinned", observationId: observation.id },
        },
      },
    },
  };
}
function render(inputs: InputComparison[], relationships: RelationshipComparison[]) {
  const comparison: Comparison = {
    receiptId: "receipt",
    token: "token",
    review: { state: "unreviewed" },
    supersededBy: [],
    state: "changed",
    hasChanged: true,
    hasUnknown: false,
    inputs,
    relationshipInputs: relationships,
  };
  const before = JSON.stringify(comparison);
  const result = renderToStaticMarkup(
    createElement(EvidenceInputs, { comparison, mode: "focused" }),
  );
  assert.equal(JSON.stringify(comparison), before);
  return result;
}
test("captured resource identity and external states remain distinct from unchanged native versions", () => {
  const markup = render([input()], [relationship()]);
  const visible = markup.slice(0, markup.indexOf("<details"));
  assert.match(visible, /Customer &lt;specification&gt;/);
  assert.doesNotMatch(visible, /Renamed source/);
  assert.match(visible, /Native record · Captured v1 → Current v1/);
  assert.match(visible, /Source identity/);
  assert.match(visible, /customer-spec/);
  assert.match(visible, /captured-hash/);
  assert.match(visible, /latest-hash/);
  assert.match(visible, /captured-commit/);
  assert.match(visible, /repo · main/);
  assert.doesNotMatch(markup, /evidence-statement-comparison/);
  assert.match(markup, /passage relevance remains unknown/);
  assert.match(markup, /Pin captured in this evaluation/);
  assert.match(markup, /2026-10-23 · available · captured-hash/);
  assert.match(markup, /Endpoint context does not declare a content dependency/);
});
test("two scoped references retain separate pins and never substitute another evaluation observation", () => {
  const a = relationship(),
    b = relationship();
  b.id = b.recorded.relationship.id = "ref-B";
  b.recorded.relationship.reference = {
    role: "support",
    selector: { kind: "future-selector", value: { quote: "<unresolved>" } },
    state: { mode: "pinned", observationId: "not-captured" },
  };
  const markup = render([input()], [a, b]);
  assert.match(markup, /Declared relationships · 2/);
  assert.match(markup, /section · 4.2/);
  assert.match(markup, /future-selector · \{&quot;quote&quot;:&quot;&lt;unresolved&gt;&quot;\}/);
  assert.match(markup, /Pinned observation · not-captured/);
  assert.equal(
    markup.match(/No matching content input was declared in this evaluation\./g)?.length,
    1,
  );
  assert.match(markup, /Unknown · declared scope is retained without resolving the passage/);
});
test("native pins, live references and ordinary relationships preserve their separate meanings", () => {
  const pinned = relationship(),
    live = relationship(),
    domain = relationship();
  pinned.recorded.relationship.reference!.state = { mode: "pinned", revision: 7 };
  live.id = "live";
  live.recorded.relationship.reference!.state = { mode: "current" };
  delete live.recorded.relationship.reference!.selector;
  domain.id = "domain";
  delete domain.recorded.relationship.reference;
  domain.recorded.relationship.type = "satisfies";
  domain.hasChanged = domain.hasUnknown = true;
  domain.state = "unknown";
  domain.reasons = ["Relationship removed <review>"];
  const markup = render([], [pinned, live, domain]);
  assert.match(markup, /Pinned native revision v7/);
  assert.match(markup, /Captured endpoint context: REQ-104 v3 · Customer &lt;specification&gt; v1/);
  assert.match(markup, /Live reference · latest observed state/);
  assert.match(markup, /Whole resource/);
  assert.match(markup, /satisfies · Customer &lt;specification&gt; · changed · unknown/);
  assert.match(markup, /Relationship removed &lt;review&gt;/);
  assert.doesNotMatch(markup, /Pin captured in this evaluation/);
  assert.match(markup, /relationship inputs are shown below/);
});
test("unavailable latest content shows observed availability without fabricating bytes or passage changes", () => {
  const value = input();
  value.hasUnknown = true;
  value.current.observation = {
    ...observation,
    id: "missing",
    availability: "unknown",
    hash: undefined,
    commit: undefined,
    reason: "File unavailable",
  };
  const markup = render([value], []);
  assert.match(markup, /changed · unknown/);
  assert.match(markup, /Availability unknown/);
  assert.match(markup, /File unavailable/);
  assert.match(markup, /<code>Unknown<\/code>/);
  assert.doesNotMatch(markup, /evidence-statement-comparison/);
});
