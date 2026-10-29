import { ensure, record, knownProperties } from "../core/model.ts";
import type {
  RelationshipDeclaration,
  CapturedRelationship,
  RelationshipComparison,
} from "../core/evidence.ts";
import { canonical } from "../core/evidence.ts";
import { pinRelationship } from "./native-pins.ts";
import type { Transaction } from "./ports/repository.ts";
import { expectVersion } from "./version-guard.ts";
import { currentEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import type { Relationship } from "../core/model.ts";

function comparisonReason(
  current: Relationship | undefined,
  changed: boolean,
  source: EngineeringStateReader["kind"],
) {
  if (current)
    return changed
      ? "Declared relationship changed; captured state is unchanged"
      : "Declared relationship matches";
  return source === "configuration"
    ? "Captured relationship is not selected in the target configuration; no live deletion inferred"
    : "Captured relationship is removed; original snapshot retained";
}

export async function captureRelationships(
  tx: Transaction,
  declarations: RelationshipDeclaration[] = [],
): Promise<CapturedRelationship[]> {
  ensure(
    Array.isArray(declarations) && declarations.length <= 100,
    "validation",
    "Declare at most 100 relationship inputs",
  );
  const captured: CapturedRelationship[] = [],
    seen = new Set<string>();
  for (const value of declarations) {
    ensure(record(value), "validation", "Invalid relationship input");
    knownProperties(value, ["id", "expectedVersion", "revision", "role"]);
    ensure(
      typeof value.id === "string" && !seen.has(value.id),
      "validation",
      "Declare each relationship once",
    );
    seen.add(value.id);
    ensure(
      value.role === undefined || (typeof value.role === "string" && value.role.trim()),
      "validation",
      "Invalid relationship usage role",
    );
    ensure(
      !(value.revision !== undefined && value.expectedVersion !== undefined),
      "validation",
      "Choose historical selection or current guard",
    );
    const current =
      value.revision === undefined ? await tx.get("relationship", value.id) : undefined;
    ensure(
      value.revision !== undefined || current,
      "not_found",
      "Relationship input is unavailable",
    );
    if (value.expectedVersion !== undefined)
      expectVersion(current!.version, value.expectedVersion, false, {
        kind: "relationship",
        id: value.id,
      });
    const pin = await pinRelationship(tx, value.id, value.revision ?? current!.version);
    const source = await tx.getAt("entity", pin.relationship.source, pin.projectRevision);
    const target = await tx.getAt("entity", pin.relationship.target, pin.projectRevision);
    ensure(source && target, "storage", "Captured relationship endpoint context unavailable");
    captured.push({
      ...pin,
      source,
      target,
      ...(value.role === undefined ? {} : { role: value.role }),
    });
  }
  return captured;
}
export async function compareRelationships(
  tx: Transaction,
  captured: CapturedRelationship[] = [],
  state: EngineeringStateReader = currentEngineeringState(tx),
): Promise<RelationshipComparison[]> {
  const results: RelationshipComparison[] = [];
  for (const recorded of captured) {
    const current = await state.getRelationship(recorded.relationship.id);
    const hasChanged = canonical(current ?? null) !== canonical(recorded.relationship),
      hasUnknown = !current;
    results.push({
      id: recorded.relationship.id,
      recorded,
      current: current ?? null,
      hasChanged,
      hasUnknown,
      state: hasUnknown ? "unknown" : hasChanged ? "changed" : "current",
      reasons: [comparisonReason(current, hasChanged, state.kind)],
    });
  }
  return results;
}
