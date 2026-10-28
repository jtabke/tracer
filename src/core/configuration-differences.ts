import { canonical } from "./evidence.ts";
import type { Configuration, PinnedEntity, PinnedRelationship } from "./configuration.ts";
import type {
  ConfigurationNativeDifference,
  ConfigurationPropertyChange,
  SelectedValue,
} from "./configuration-comparison.ts";
import type { Entity, Relationship, Json } from "./model.ts";

function selected(object: object, key: string): SelectedValue {
  return Object.hasOwn(object, key)
    ? { present: true, value: (object as Record<string, Json>)[key] }
    : { present: false };
}
function properties(before: object, after: object, prefix: string[] = []) {
  const result: ConfigurationPropertyChange[] = [];
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    if (!prefix.length && ["id", "version", "fields"].includes(key)) continue;
    const a = selected(before, key),
      b = selected(after, key);
    if (canonical(a) !== canonical(b)) result.push({ path: [...prefix, key], before: a, after: b });
  }
  return result;
}
function context(value: Configuration) {
  return {
    subject: value.subject,
    ...(value.capture
      ? { scope: value.capture.intent.scope, schema: value.capture.context.schema }
      : {}),
  };
}
export function configurationContextDifferences(before: Configuration, after: Configuration) {
  return properties(context(before), context(after), ["context"]);
}
type Pin = PinnedEntity | PinnedRelationship;
function object(pin: Pin): Entity | Relationship {
  return "entity" in pin ? pin.entity : pin.relationship;
}
function difference(
  id: string,
  before?: Pin,
  after?: Pin,
  known = true,
): ConfigurationNativeDifference {
  if (!before || !after)
    return {
      id,
      state: !known ? "unknown" : before ? "removed" : "added",
      revisionChanged: false,
      schemaChanged: false,
      versionOnly: false,
      changes: [],
    };
  const a = object(before),
    b = object(after);
  const changes = [...properties(a, b), ...properties(a.fields, b.fields, ["fields"])];
  const revisionChanged = before.revisionId !== after.revisionId;
  const schemaChanged = canonical(before.schema) !== canonical(after.schema);
  return {
    id,
    state: changes.length || revisionChanged || schemaChanged ? "modified" : "unchanged",
    revisionChanged,
    schemaChanged,
    versionOnly: revisionChanged && !schemaChanged && !changes.length,
    changes,
  };
}
export function configurationNativeDifferences(
  before: Pin[] | undefined,
  after: Pin[] | undefined,
) {
  const a = new Map(before?.map((p) => [object(p).id, p])),
    b = new Map(after?.map((p) => [object(p).id, p]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .map((id) => difference(id, a.get(id), b.get(id), before !== undefined && after !== undefined));
}
type Content = NonNullable<Configuration["capture"]>["content"][number];
function availableHash(value?: Content) {
  const observation = value?.observation;
  return observation?.availability === "available" ? observation.hash : undefined;
}
function fingerprint(before?: Content, after?: Content): "same" | "different" | "unknown" {
  const a = availableHash(before),
    b = availableHash(after);
  if (!a || !b) return "unknown";
  return a === b ? "same" : "different";
}
export function configurationContentDifferences(before: Configuration, after: Configuration) {
  const a = new Map(before.capture?.content.map((p) => [p.entityId, p])),
    b = new Map(after.capture?.content.map((p) => [p.entityId, p]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((entityId) => ({
    entityId,
    selectionChanged: canonical(a.get(entityId) ?? null) !== canonical(b.get(entityId) ?? null),
    content: fingerprint(a.get(entityId), b.get(entityId)),
  }));
}
