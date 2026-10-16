import type { FlowNode, Projection, Selection, WorkingView } from "./types.ts";

type Context = Pick<WorkingView, "focus" | "folderScope">;
type Node = Pick<FlowNode, "id" | "parentId" | "data">;
export type NodeIntent =
  | { kind: "reveal" | "toggle"; id: string }
  | { kind: "trace"; id: string; fromClick: boolean }
  | { kind: "select"; selection: Selection }
  | { kind: "none" };

export function selectNode(node: Node, context: Context, projection: Projection): NodeIntent {
  if (node.data.kind === "item") {
    const outsideFolder = context.folderScope && !projection.rootIds?.includes(node.id);
    if (context.focus || outsideFolder) return { kind: "reveal", id: node.id };
    return { kind: "trace", id: node.id, fromClick: true };
  }
  if (node.data.kind === "remainder") {
    if (!node.parentId) return { kind: "none" };
    const parent = projection.nodes.find((value) => value.id === node.parentId);
    return {
      kind: "select",
      selection: {
        kind: "group",
        id: node.parentId,
        type: node.data.type,
        groupKey: parent?.groupKey ?? node.data.type,
      },
    };
  }
  return {
    kind: "select",
    selection: {
      kind: node.data.kind === "group" ? "group" : "item",
      id: node.id,
      type: node.data.type,
      groupKey: node.data.groupKey ?? node.data.type,
    },
  };
}

export function activateNode(node: Node, context: Context): NodeIntent {
  if (node.data.kind === "group" && !node.data.external)
    return { kind: "toggle", id: node.data.groupKey ?? node.data.type ?? "" };
  if (node.data.kind === "item" && !context.focus && !context.folderScope)
    return { kind: "trace", id: node.id, fromClick: false };
  return { kind: "none" };
}
