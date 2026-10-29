import type { Configuration } from "../../src/core/configuration.ts";
import type { Entity } from "../../src/core/model.ts";
import type { ApplicationModelPin } from "../../src/core/application-model.ts";
import { applicationModelChoices } from "../application-choices.tsx";
import { useProjection } from "../use-projection.ts";
import type { Editing } from "../editing.ts";

/** UI source projection only. The shared service validates every selected engineering pin. */
export function useVerificationBasisSource(
  selection: {
    models: ReturnType<typeof applicationModelChoices>;
    entities: Entity[];
    modelKey: string;
    requirementId: string;
    targetId: string;
    modelPin?: ApplicationModelPin;
  },
  editing: Editing,
  epoch: number,
) {
  const target = useProjection(
    "/api/configuration",
    selection.targetId ? { id: selection.targetId } : undefined,
    editing.epoch + epoch,
    editing.report,
  );
  const selected = target.retained;
  const { entities, models } = basisObjects(selection, selected);
  const pin =
    selection.modelPin ??
    (selection.modelKey !== "" ? models[Number(selection.modelKey)]?.pin : undefined);
  const model = useProjection(
    "/api/verification-model",
    pin,
    editing.epoch + epoch,
    editing.report,
  );
  const definition = model.retained?.definition;
  const live = useProjection(
    "/api/relationships",
    !selection.targetId && definition && selection.requirementId
      ? {
          source: selection.requirementId,
          type: definition.relationships.requirementMethod,
          limit: 100,
        }
      : undefined,
    editing.epoch + epoch,
    editing.report,
  );
  const relationships = selection.targetId
    ? selectedRelationships(
        selected,
        selection.requirementId,
        definition?.relationships.requirementMethod,
      )
    : (live.data?.items ?? []);
  return {
    entities,
    models,
    model,
    definition,
    target,
    relationships,
    ready: selection.targetId ? target.ready && Boolean(target.data?.capture) : live.ready,
    loading: selection.targetId ? target.loading : live.loading,
    failed: selection.targetId ? target.failed : live.failed,
    truncated: !selection.targetId && Boolean(live.retained?.nextAfter),
  };
}

function basisObjects(
  selection: {
    targetId: string;
    entities: Entity[];
    models: ReturnType<typeof applicationModelChoices>;
  },
  selected: Configuration | undefined,
) {
  if (!selection.targetId) return { entities: selection.entities, models: selection.models };
  return {
    entities: selected?.members.map((x) => x.entity) ?? [],
    models:
      selected?.members.flatMap((x) =>
        applicationModelChoices([x.entity], x.schema, "requirement_verification"),
      ) ?? [],
  };
}
function selectedRelationships(
  selected: Configuration | undefined,
  requirementId: string,
  type: string | undefined,
) {
  return (selected?.relationships ?? [])
    .map((x) => x.relationship)
    .filter((x) => x.source === requirementId && x.type === type);
}
