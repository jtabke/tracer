import { useState } from "react";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import { traceColumnKey as slotKey } from "../../../src/core/presentation.ts";
import type { Editing } from "../../../ui/editing.ts";
import { fieldsFrom } from "../../../ui/fields.tsx";
import { useProjection } from "../../../ui/use-projection.ts";
import type { RelationshipSlot } from "./relationship-slots.ts";
import { relationshipSlots } from "./relationship-slots.ts";

export function useMappingDraft(
  source: Entity,
  schema: SchemaObject,
  editing: Editing,
  paused: boolean,
  onClose: () => void,
  initialSlot?: RelationshipSlot,
  initialTarget?: Entity,
  onRecorded?: () => void,
) {
  const [base] = useState({ source, schema });
  const slots = relationshipSlots(base.schema, base.source.type);
  const initial =
    slots.find((slot) => initialSlot && slotKey(slot) === slotKey(initialSlot)) ?? slots[0];
  const [direction, setDirection] = useState(initial?.direction ?? "outgoing");
  const directions = [...new Set(slots.map((slot) => slot.direction))];
  const meanings = [
    ...new Set(
      slots.filter((slot) => slot.direction === direction).map((slot) => slot.relationshipType),
    ),
  ];
  const [chosenMeaning, setMeaning] = useState(initial?.relationshipType ?? "");
  const meaning = meanings.includes(chosenMeaning) ? chosenMeaning : (meanings[0] ?? "");
  const definition = base.schema.relationshipTypes[meaning];
  const types = slots
    .filter((slot) => slot.direction === direction && slot.relationshipType === meaning)
    .map((slot) => slot.targetType);
  const [target, setTarget] = useState<Entity | undefined>(initialTarget),
    [values, setValues] = useState<Record<string, string>>({});
  const [candidateReady, setCandidateReady] = useState(false),
    [failed, setFailed] = useState(false);
  const endpoints = mappingEndpoints(base.source, target, direction);
  const existing = useProjection(
    "/api/relationships",
    endpoints
      ? { source: endpoints.source.id, target: endpoints.target.id, type: meaning, limit: 1 }
      : undefined,
    editing.epoch,
    editing.report,
  );
  function readyToRecord() {
    if (
      !endpoints ||
      !definition ||
      !existing.ready ||
      existing.data?.items.length ||
      editing.busy ||
      paused ||
      !candidateReady
    )
      return undefined;
    return { endpoints, definition };
  }
  const record = async () => {
    const ready = readyToRecord();
    if (!ready) return;
    try {
      const fields = fieldsFrom(values, ready.definition.fields);
      if (
        await editing.commit(
          [
            {
              op: "relationship.create",
              input: {
                type: meaning,
                source: ready.endpoints.source.id,
                target: ready.endpoints.target.id,
                fields,
              },
              expectedEndpoints: {
                sourceVersion: ready.endpoints.source.version,
                targetVersion: ready.endpoints.target.version,
              },
              rejectExisting: true,
            },
          ],
          base.schema.version,
        )
      ) {
        onRecorded?.();
        onClose();
      } else setFailed(true);
    } catch (error) {
      setFailed(true);
      editing.report(error, values);
    }
  };
  return {
    base,
    meanings,
    directions,
    direction,
    setDirection,
    meaning,
    setMeaning,
    definition,
    types,
    target,
    setTarget,
    values,
    setValues,
    setCandidateReady,
    failed,
    existing,
    endpoints,
    record,
    ready: !!readyToRecord(),
  };
}

function mappingEndpoints(
  item: Entity,
  candidate: Entity | undefined,
  direction: RelationshipSlot["direction"],
) {
  if (!candidate) return undefined;
  return direction === "incoming"
    ? { source: candidate, target: item }
    : { source: item, target: candidate };
}
