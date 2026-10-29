import type { Entity, SchemaObject } from "../../src/core/model.ts";
import type { AssessmentScopeQuery } from "../../src/core/change-assessment.ts";
import type { ConfigurationComparison } from "../../src/core/configuration-comparison.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import { useConfigurations, ConfigurationPaging } from "../configurations.tsx";
import { ConfigurationChoice } from "../configuration-choice.tsx";

export type AssessmentSourceDraft = {
  source: "baseline" | "configuration_pair";
  baselineId: string;
  beforeId: string;
  afterId: string;
};
export function useAssessmentSource(
  query: AssessmentScopeQuery,
  after: string | undefined,
  editing: Editing,
) {
  const pair = "source" in query;
  const baselines = useProjection(
    "/api/baselines",
    pair ? undefined : { limit: 25, after },
    editing.epoch,
    editing.report,
  );
  const comparison = useProjection(
    "/api/configuration-comparison",
    pair && query.beforeId && query.afterId
      ? { beforeId: query.beforeId, afterId: query.afterId }
      : undefined,
    editing.epoch,
    editing.report,
  );
  return {
    baselines,
    comparison,
    ready: pair
      ? comparison.ready &&
        Boolean(comparison.data?.before.capture && comparison.data.after.capture) &&
        comparison.data?.comparability.state !== "incompatible"
      : baselines.ready,
  };
}
export function AssessmentPairChoice({
  value,
  comparison,
  editing,
  onChange,
}: {
  value: AssessmentSourceDraft;
  comparison?: ConfigurationComparison;
  editing: Editing;
  onChange(value: Partial<AssessmentSourceDraft>): void;
}) {
  const catalog = useConfigurations(editing.epoch);
  return (
    <section aria-label="Assessment configuration pair">
      <ConfigurationPaging catalog={catalog} />
      <ConfigurationChoice
        title="Assessment before configuration"
        value={
          value.beforeId
            ? { id: value.beforeId, name: comparison?.before.name ?? value.beforeId }
            : undefined
        }
        items={catalog.read.retained?.items ?? []}
        onChange={(x) => onChange({ beforeId: x?.id ?? "" })}
        disabled={!catalog.read.ready}
      />
      <ConfigurationChoice
        title="Assessment after configuration"
        value={
          value.afterId
            ? { id: value.afterId, name: comparison?.after.name ?? value.afterId }
            : undefined
        }
        items={catalog.read.retained?.items ?? []}
        onChange={(x) => onChange({ afterId: x?.id ?? "" })}
        disabled={!catalog.read.ready}
      />
      <p>
        Policy: scoped-reference-dependencies-v1. Another pair requires a new assessment identity
        and new judgments.
      </p>
      {comparison && (
        <>
          <p>Comparability: {comparison.comparability.state}</p>
          {comparison.comparability.issues.map((x) => (
            <p key={x.code}>{x.explanation}</p>
          ))}
        </>
      )}
    </section>
  );
}
export function assessmentRootChoices(entities: Entity[], pair?: ConfigurationComparison) {
  return pair
    ? [
        ...new Map(
          [...pair.before.members, ...pair.after.members].map((x) => [x.entity.id, x.entity]),
        ).values(),
      ]
    : entities;
}
export function assessmentRelationshipChoices(
  schema: SchemaObject | null,
  pair?: ConfigurationComparison,
) {
  const schemas = pair
    ? [
        pair.before.capture?.context.schema,
        pair.after.capture?.context.schema,
        ...(pair.before.relationships ?? []).map((x) => x.schema),
        ...(pair.after.relationships ?? []).map((x) => x.schema),
      ]
    : [schema];
  return [...new Set(schemas.flatMap((x) => Object.keys(x?.relationshipTypes ?? {})))].sort();
}
