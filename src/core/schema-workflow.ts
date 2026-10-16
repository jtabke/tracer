import type { RelationshipDefinition } from "./model.ts";

/** Explicit project-owned development flow, distinct from stored trace direction. */
export type WorkflowConnection = {
  source: string;
  target: string;
  direction: "forward" | "reverse";
  label: string;
  feedback?: boolean;
};

export function validWorkflow(
  value: unknown,
  names: object,
  definition: RelationshipDefinition,
): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 256) return false;
  const identities = new Set<string>();
  for (const route of value) {
    if (!validRoute(route, names, definition)) return false;
    const identity = JSON.stringify([route.source, route.target, route.direction]);
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}
function validRoute(
  route: unknown,
  names: object,
  definition: RelationshipDefinition,
): route is WorkflowConnection {
  if (!route || typeof route !== "object" || Array.isArray(route)) return false;
  const value = route as Record<string, unknown>;
  return (
    validEndpoint(value.source, names, definition.source) &&
    validEndpoint(value.target, names, definition.target) &&
    validDescription(value)
  );
}
function validEndpoint(value: unknown, names: object, allowed?: string[]): value is string {
  return (
    typeof value === "string" &&
    Object.hasOwn(names, value) &&
    (allowed === undefined || allowed.includes(value))
  );
}

function validDescription(value: Record<string, unknown>) {
  return (
    (value.direction === "forward" || value.direction === "reverse") &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    value.label.length <= 120 &&
    (value.feedback === undefined || typeof value.feedback === "boolean")
  );
}
