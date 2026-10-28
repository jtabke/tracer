import { canonical } from "./evidence.ts";
import {
  configurationContentDifferences,
  configurationContextDifferences,
  configurationNativeDifferences,
} from "./configuration-differences.ts";
import type { Configuration } from "./configuration.ts";
import type { Json } from "./model.ts";

export type ConfigurationPair = { beforeId: string; afterId: string };
/** Presence is explicit: an absent property is not JSON null. Arrays retain order. */
export type SelectedValue = { present: false } | { present: true; value: Json };
export type ConfigurationPropertyChange = {
  path: string[];
  before: SelectedValue;
  after: SelectedValue;
};
export type ConfigurationNativeDifference = {
  id: string;
  state: "added" | "removed" | "modified" | "unchanged" | "unknown";
  revisionChanged: boolean;
  schemaChanged: boolean;
  versionOnly: boolean;
  changes: ConfigurationPropertyChange[];
};
export type ConfigurationContentDifference = {
  entityId: string;
  selectionChanged: boolean;
  /** Fingerprint evidence only; neither a passage judgment nor retained bytes. */
  content: "same" | "different" | "unknown";
};
export type ConfigurationComparison = {
  contract: "configuration_comparison";
  version: 1;
  basis: ConfigurationPair & {
    policy: "exact-selected-state-v1";
    beforeDigest: string;
    afterDigest: string;
    digest: string;
  };
  /** Full immutable pins retain unchanged context and historical endpoint identities. */
  before: Configuration;
  after: Configuration;
  comparability: {
    state: "exact" | "qualified" | "incompatible";
    issues: { code: string; explanation: string }[];
    engineeringMeaning: "not_assessed";
  };
  contextChanges: ConfigurationPropertyChange[];
  members: ConfigurationNativeDifference[];
  relationships: ConfigurationNativeDifference[];
  content: ConfigurationContentDifference[];
  completeness: {
    population: "all_selected_states";
    topology: "declared" | "unknown";
    content: "declared" | "unknown";
    projectDeletion: "not_inferred";
    passage: "not_assessed";
    externalBytes: "not_retained";
  };
};

function contextIssues(before: Configuration, after: Configuration) {
  const issues: ConfigurationComparison["comparability"]["issues"] = [];
  if (!before.capture || !after.capture) return issues;
  const add = (code: string, explanation: string) => issues.push({ code, explanation });
  if (canonical(before.capture.intent.scope) !== canonical(after.capture.intent.scope))
    add(
      "scope_changed",
      "Scope declarations differ; membership differences do not establish equivalent engineering coverage.",
    );
  if (canonical(before.capture.context.schema) !== canonical(after.capture.context.schema))
    add(
      "schema_changed",
      "Captured schema contexts differ; structural comparison does not establish semantic model compatibility.",
    );
  return issues;
}
function comparability(
  before: Configuration,
  after: Configuration,
  content: ConfigurationComparison["content"],
): ConfigurationComparison["comparability"] {
  const issues: ConfigurationComparison["comparability"]["issues"] = [];
  const add = (code: string, explanation: string) => issues.push({ code, explanation });
  if (before.subject.id !== after.subject.id)
    add(
      "different_subjects",
      "The selected subjects differ; no common engineering scope is established.",
    );
  if (!before.capture || !after.capture)
    add(
      "legacy_scope",
      "Legacy capture has no controlled scope/content declaration; omitted states remain unknown.",
    );
  if (before.relationships === undefined || after.relationships === undefined)
    add("unknown_topology", "An undeclared topology is unknown, not an empty graph.");
  issues.push(...contextIssues(before, after));
  if (
    before.capture?.intent.scope.coverage === "partial" ||
    after.capture?.intent.scope.coverage === "partial"
  )
    add(
      "partial_scope",
      "At least one scope is explicitly partial; no project-wide no-impact conclusion follows.",
    );

  if (content.some((x) => x.content === "unknown"))
    add(
      "unknown_content",
      "Some selected content lacks comparable available hashes; missing membership or observations is not proven byte deletion.",
    );
  return {
    state:
      before.subject.id !== after.subject.id
        ? "incompatible"
        : issues.length
          ? "qualified"
          : "exact",
    issues,
    engineeringMeaning: "not_assessed",
  };
}
/** Shared deterministic projection also validates complete typed response populations. */
export function configurationDifferenceView(before: Configuration, after: Configuration) {
  const content = configurationContentDifferences(before, after);
  return {
    comparability: comparability(before, after, content),
    contextChanges: configurationContextDifferences(before, after),
    members: configurationNativeDifferences(before.members, after.members),
    relationships: configurationNativeDifferences(before.relationships, after.relationships),
    content,
    completeness: {
      population: "all_selected_states",
      topology: before.relationships && after.relationships ? "declared" : "unknown",
      content: before.capture && after.capture ? "declared" : "unknown",
      projectDeletion: "not_inferred",
      passage: "not_assessed",
      externalBytes: "not_retained",
    },
  } satisfies Pick<
    ConfigurationComparison,
    "comparability" | "contextChanges" | "members" | "relationships" | "content" | "completeness"
  >;
}
