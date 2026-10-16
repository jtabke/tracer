import { bundleLinks, entityAt, linksFor } from "./model.ts";
import type {
  MapIndex,
  NodeDefinition,
  Organization,
  Point,
  Projection,
  WalkStep,
} from "./types.ts";

export const WALK_LIMIT = 30;

export function connectionChoices(
  index: MapIndex,
  id: string,
  organization: Organization,
  query: string = "",
  kind: string = "all",
) {
  const text = query.trim().toLowerCase();
  return linksFor(index, id)
    .map((link) => {
      const outgoing = link.nativeSource === id;
      const other = entityAt(index, outgoing ? link.nativeTarget : link.nativeSource);
      const path = organization[other.id]?.path ?? ["Unfiled"];
      return { link, outgoing, other, path };
    })
    .filter(
      ({ link, other, path }) =>
        (kind === "all" || kind === link.type) &&
        `${link.type.replaceAll("_", " ")} ${other.key} ${other.fields.title} ${path.join(" ")}`
          .toLowerCase()
          .includes(text),
    )
    .sort(
      (a, b) => a.link.type.localeCompare(b.link.type) || a.other.key.localeCompare(b.other.key),
    );
}

export function appendWalkStep(
  index: MapIndex,
  steps: WalkStep[],
  linkId: string,
  position?: Point,
) {
  if (steps.length >= WALK_LIMIT) throw new Error("Path has reached its 30-step limit.");
  const link = index.linkById.get(linkId),
    current = steps.at(-1)?.id;
  if (!link || !current || (link.nativeSource !== current && link.nativeTarget !== current))
    throw new Error("Only a recorded connection incident to the current item can be followed.");
  return [
    ...steps,
    {
      id: link.nativeSource === current ? link.nativeTarget : link.nativeSource,
      via: link.id,
      position,
    },
  ];
}

export function walkProjection(
  index: MapIndex,
  organization: Organization,
  steps: WalkStep[],
): Projection {
  if (!steps.length || !index.entities.has(steps[0].id))
    throw new Error("A path needs a recorded starting item.");
  const ids = new Set<string>(),
    linkIds = new Set<string>(),
    nodes: NodeDefinition[] = [];
  for (const [i, step] of steps.entries()) {
    if (!index.entities.has(step.id)) throw new Error("Path item is missing.");
    if (i) {
      const link = checkedWalkLink(index, steps[i - 1].id, step);
      linkIds.add(link.id);
    }
    if (ids.has(step.id)) continue;
    ids.add(step.id);
    nodes.push({
      id: step.id,
      kind: "item",
      entity: entityAt(index, step.id),
      walk: true,
      folderPath: organization[step.id]?.path ?? ["Unfiled"],
      initialPosition: step.position,
    });
  }
  const links = [...linkIds].map((id) => {
    const link = index.linkById.get(id)!;
    // This lens labels the actual native relationship direction, even when the
    // development overview has an authored reverse workflow display.
    return {
      ...link,
      source: link.nativeSource,
      target: link.nativeTarget,
      label: link.type.replaceAll("_", " "),
    };
  });
  return {
    mode: "walk",
    nodes,
    edges: bundleLinks(links, new Map([...ids].map((id) => [id, id]))),
    scopeIds: [...ids],
    scopedLinkIds: [...linkIds],
    totalRecords: ids.size,
    individualCount: ids.size,
    scopedLinks: linkIds.size,
    omittedRecords: 0,
    omittedEdges: 0,
  };
}

function checkedWalkLink(index: MapIndex, previous: string, step: WalkStep) {
  const link = index.linkById.get(step.via ?? "");
  if (
    !link ||
    !(
      (link.nativeSource === previous && link.nativeTarget === step.id) ||
      (link.nativeTarget === previous && link.nativeSource === step.id)
    )
  )
    throw new Error("Path steps must be connected by the exact recorded link.");
  return link;
}
