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
import { currentEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";

export function nativeState(value: Entity, fields?: string[]) {
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
  source: EngineeringStateReader["kind"] = "current",
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
        source === "configuration"
          ? "Recorded or selected source state is unknown; changing the target requires an explicit new configuration capture"
          : "Recorded or last observed source state is unknown; observe the scoped input explicitly",
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
  source: EngineeringStateReader["kind"] = "current",
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
  const selectedUnknown =
    source === "configuration" &&
    input.recorded.links.some(
      (recorded, index) => relationshipIds.has(recorded.id) && input.current.links[index] === null,
    );
  return {
    hasChanged: content.changed || linksChanged,
    hasUnknown: selectedUnknown || (includeContent && (!input.current.entity || content.unknown)),
  };
}

async function compareDependencyLinks(
  state: EngineeringStateReader,
  baselines: Relationship[],
  reasons: string[],
) {
  const links: (Relationship | null)[] = [];
  let changed = false;
  for (const baseline of baselines) {
    const link = await state.getRelationship(baseline.id);
    links.push(link ?? null);
    if (!link || canonical(baseline) !== canonical(link)) {
      changed = true;
      const absent =
        state.kind === "configuration"
          ? "not selected in target; no live deletion inferred"
          : "removed";
      reasons.push(
        `Declared dependency link ${baseline.id}: v${baseline.version} → ${link ? "v" + link.version : absent}`,
      );
    }
  }
  return { links, changed };
}

async function compareInput(
  resolution: EngineeringStateReader,
  recorded: CapturedInput,
  outputId: string,
): Promise<InputComparison> {
  const currentEntity = await resolution.getEntity(recorded.entityId);
  const observation = recorded.observation
    ? await resolution.getObservation(recorded.entityId)
    : null;
  const links: (Relationship | null)[] = [];
  const reasons: string[] = [];
  let changed = false,
    unknown = false;
  if (!currentEntity) {
    unknown = true;
    reasons.push(
      resolution.kind === "configuration"
        ? "Input is not selected in the target configuration; no live deletion inferred"
        : "Input entity is deleted or unavailable",
    );
  }
  const content = compareContent(recorded, currentEntity, observation, reasons, resolution.kind);
  changed = content.changed;
  unknown ||= content.unknown;
  const dependency = await compareDependencyLinks(resolution, recorded.links, reasons);
  links.push(...dependency.links);
  changed ||= dependency.changed;
  unknown ||= resolution.kind === "configuration" && dependency.links.some((link) => link === null);
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

/** Summarize an exact full or projected population; preserve absent legacy direct-input metadata. */
export function summarizeComparedInputs(
  receiptId: string,
  inputs: InputComparison[],
  relationshipInputs?: ComparedState["relationshipInputs"],
): ComparedState {
  const hasUnknown =
    inputs.some((x) => x.hasUnknown) || (relationshipInputs ?? []).some((x) => x.hasUnknown);
  const hasChanged =
    inputs.some((x) => x.hasChanged) || (relationshipInputs ?? []).some((x) => x.hasChanged);
  return {
    receiptId,
    inputs,
    ...(relationshipInputs === undefined ? {} : { relationshipInputs }),
    hasChanged,
    hasUnknown,
    state: comparedState(hasUnknown, hasChanged),
  };
}

export async function compareCapturedInputs(
  tx: Transaction,
  receipt: Receipt,
  state: EngineeringStateReader = currentEngineeringState(tx),
): Promise<ComparedState> {
  const inputs: InputComparison[] = [];
  for (const recorded of receipt.inputs) {
    inputs.push(await compareInput(state, recorded, receipt.output.id));
  }
  const relationshipInputs = await compareRelationships(tx, receipt.relationshipInputs, state);
  return summarizeComparedInputs(
    receipt.id,
    inputs,
    receipt.relationshipInputs === undefined ? undefined : relationshipInputs,
  );
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
