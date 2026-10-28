import { compareRelationships } from "./relationship-inputs.ts";
import type { Entity, Relationship } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type {
  CapturedInput,
  ComparedState,
  InputComparison,
  Observation,
  Receipt,
  Review,
  Comparison,
} from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";

function nativeState(value: Entity, fields?: string[]) {
  return fields
    ? fields.map((name) => ({
        name,
        present: Object.hasOwn(value.fields, name),
        ...(Object.hasOwn(value.fields, name) ? { value: value.fields[name] } : {}),
      }))
    : value;
}

// Review applicability follows only declared dependencies, not observation IDs,
// timestamps, unrelated commits, external annotations or unselected native fields.
export function comparisonToken(value: ComparedState) {
  return canonical({
    receiptId: value.receiptId,
    ...(value.relationshipInputs === undefined
      ? {}
      : {
          relationshipInputs: value.relationshipInputs.map((r) => ({
            id: r.id,
            current: r.current,
            state: r.state,
          })),
        }),
    inputs: value.inputs.map((input) => ({
      entityId: input.entityId,
      exists: input.current.entity !== null,
      state: input.state,
      source: input.recorded.observation
        ? {
            availability: input.current.observation?.availability ?? "unknown",
            hash: input.current.observation?.hash ?? null,
          }
        : input.current.entity
          ? nativeState(input.current.entity, input.recorded.fields)
          : null,
      links: input.current.links,
    })),
  });
}

function comparedState(unknown: boolean, changed: boolean): ComparedState["state"] {
  return unknown ? "unknown" : changed ? "changed" : "current";
}

function compareContent(
  recorded: CapturedInput,
  currentEntity: Entity | undefined,
  observation: Observation | null,
  reasons: string[],
) {
  const result = { unknown: false, changed: false };
  if (recorded.observation) {
    if (
      recorded.observation.availability !== "available" ||
      !observation ||
      observation.availability !== "available"
    ) {
      result.unknown = true;
      reasons.push(
        "Recorded or last observed source state is unknown; observe the scoped input explicitly",
      );
    } else if (recorded.observation.hash !== observation.hash) {
      result.changed = true;
      reasons.push(`Scoped content changed: ${recorded.observation.hash} → ${observation.hash}`);
    } else
      reasons.push(
        "Scoped content matches; unrelated commits and annotations are not dependencies",
      );
  } else if (
    currentEntity &&
    canonical(nativeState(recorded.entity, recorded.fields)) !==
      canonical(nativeState(currentEntity, recorded.fields))
  ) {
    result.changed = true;
    reasons.push(
      `Native input changed: v${recorded.entity.version} → v${currentEntity.version}${recorded.fields ? " (declared fields)" : ""}`,
    );
  }
  return result;
}

/** Evaluate only selected dependencies while retaining the full comparison for explanation. */
export function scopedInputState(
  input: InputComparison,
  includeContent: boolean,
  relationshipIds: Set<string>,
): { hasChanged: boolean; hasUnknown: boolean } {
  const content = includeContent
    ? compareContent(
        input.recorded,
        input.current.entity ?? undefined,
        input.current.observation,
        [],
      )
    : { changed: false, unknown: false };
  const linksChanged = input.recorded.links.some(
    (recorded, index) =>
      relationshipIds.has(recorded.id) &&
      canonical(recorded) !== canonical(input.current.links[index] ?? null),
  );
  return {
    hasChanged: content.changed || linksChanged,
    hasUnknown: includeContent && (!input.current.entity || content.unknown),
  };
}

async function compareDependencyLinks(
  tx: Transaction,
  baselines: Relationship[],
  reasons: string[],
) {
  const links: (Relationship | null)[] = [];
  let changed = false;
  for (const baseline of baselines) {
    const link = await tx.get("relationship", baseline.id);
    links.push(link ?? null);
    if (!link || canonical(baseline) !== canonical(link)) {
      changed = true;
      reasons.push(
        `Declared dependency link ${baseline.id}: v${baseline.version} → ${link ? "v" + link.version : "removed"}`,
      );
    }
  }
  return { links, changed };
}

async function compareInput(
  tx: Transaction,
  recorded: CapturedInput,
  outputId: string,
): Promise<InputComparison> {
  const currentEntity = await tx.get("entity", recorded.entityId);
  const observation = recorded.observation
    ? ((await tx.latestEvidence("observation", recorded.entityId)) ?? null)
    : null;
  const links: (Relationship | null)[] = [];
  const reasons: string[] = [];
  let changed = false,
    unknown = false;
  if (!currentEntity) {
    unknown = true;
    reasons.push("Input entity is deleted or unavailable");
  }
  const content = compareContent(recorded, currentEntity, observation, reasons);
  changed = content.changed;
  unknown ||= content.unknown;
  const dependency = await compareDependencyLinks(tx, recorded.links, reasons);
  links.push(...dependency.links);
  changed ||= dependency.changed;
  return {
    entityId: recorded.entityId,
    dependencyPath: [outputId, ...recorded.links.map((link) => link.id), recorded.entityId],
    state: comparedState(unknown, changed),
    hasChanged: changed,
    hasUnknown: unknown,
    reasons: reasons.length ? reasons : ["Declared native input matches"],
    recorded,
    current: { entity: currentEntity ?? null, observation, links },
  };
}

export async function compareCapturedInputs(
  tx: Transaction,
  receipt: Receipt,
): Promise<ComparedState> {
  const inputs: InputComparison[] = [];
  for (const recorded of receipt.inputs) {
    inputs.push(await compareInput(tx, recorded, receipt.output.id));
  }
  const relationshipInputs = await compareRelationships(tx, receipt.relationshipInputs);
  const hasUnknown =
    relationshipInputs.some((r) => r.hasUnknown) || inputs.some((input) => input.hasUnknown);
  const hasChanged =
    relationshipInputs.some((r) => r.hasChanged) || inputs.some((input) => input.hasChanged);
  return {
    receiptId: receipt.id,
    ...(receipt.relationshipInputs === undefined ? {} : { relationshipInputs }),
    state: comparedState(hasUnknown, hasChanged),
    hasChanged,
    hasUnknown,
    inputs,
  };
}
/** Shared transaction-local comparison and review applicability for all read surfaces. */
export async function compareReceiptState(
  tx: Transaction,
  receipt: Receipt,
): Promise<Omit<Comparison, "supersededBy">> {
  const comparison = await compareCapturedInputs(tx, receipt),
    token = comparisonToken(comparison);
  const latest = await tx.latestEvidence("review", receipt.id);
  return { ...comparison, token, review: reviewState(latest, token) };
}
function reviewState(latest: Review | undefined, token: string): Comparison["review"] {
  const matching = latest?.token === token ? latest : undefined;
  return {
    state: matching?.decision ?? "unreviewed",
    ...(matching ? { decision: matching } : {}),
    ...(latest && !matching ? { previous: latest } : {}),
  };
}
