import type { Schema } from "../src/core/model.ts";
import type { FlowRoute } from "./model-flow.ts";
import type { DefinitionSelection } from "./schema-guided.tsx";

export function routeDefinition(schema: Schema, route: FlowRoute): DefinitionSelection {
  return {
    group: "relationshipTypes",
    name: route.name,
    pathIndex: schema.relationshipTypes[route.name].workflow?.findIndex(
      (path) => `${route.name}:${path.source}:${path.target}:${path.direction}` === route.key,
    ),
  };
}

export function selectedWorkflowKey(schema: Schema, selection: DefinitionSelection) {
  if (selection.group !== "relationshipTypes") return "";
  const path = schema.relationshipTypes[selection.name]?.workflow?.[selection.pathIndex ?? -1];
  return path ? `${selection.name}:${path.source}:${path.target}:${path.direction}` : "";
}
