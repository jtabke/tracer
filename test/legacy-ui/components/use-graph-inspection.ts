import { useEffect, useRef, useState } from "react";
import type { Graph } from "../../../src/application/views.ts";
import type { Entity } from "../../../src/core/model.ts";
import type { Focus } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import type { GraphEdge } from "./graph-model.ts";
import type { Inspection, Selection } from "./graph-state.ts";
import { resolveFocusNode, shouldAdoptSharedFocus } from "./graph-state.ts";

export function useGraphInspection({
  items,
  graph,
  root,
  setRoot,
  setExpanded,
  setInspectorOpen,
  sharedFocus,
  historical,
  visible,
  onFocus,
}: {
  items?: Entity[];
  graph?: Graph;
  root: string;
  setRoot: (id: string) => void;
  setExpanded: (values: string[]) => void;
  setInspectorOpen: (value: boolean) => void;
  sharedFocus?: Focus;
  historical: boolean;
  visible: boolean;
  onFocus?: (value: Focus) => void;
}) {
  const handledFocus = useRef<string | undefined>(undefined);
  const [inspection, setInspection] = useState<Inspection>({});
  const [dirty, setDirty] = useState(false);
  const { selection, receipt } = inspection;
  useEffect(() => {
    if (!root && items?.length) {
      const first = [...items!].sort((a, b) => label(a).localeCompare(label(b)))[0];
      setRoot(first.id);
      setInspection({ selection: { kind: "node", node: first } });
    }
  }, [root, items]);
  const canLeave = () =>
    !dirty || window.confirm("Discard the unsaved inspector draft to change selection?");
  const inspect = (selection?: Selection, receipt?: string) => {
    setDirty(false);
    setInspection({ selection, receipt });
  };
  const publishFocus = (node: Entity) => {
    if (historical) return;
    handledFocus.current = node.id;
    onFocus?.({ id: node.id, type: node.type });
  };
  const selectNode = (id: string) => {
    setInspectorOpen(true);
    if (selection?.kind === "node" && selection.node.id === id && !receipt) return;
    if (!canLeave()) return;
    const node = graph?.nodes.find((value) => value.id === id);
    if (!node) return;
    inspect({ kind: "node", node });
    publishFocus(node);
  };
  const selectEdge = (edge: GraphEdge) => {
    setInspectorOpen(true);
    if (!canLeave()) return;
    inspect({ kind: "edge", edge });
  };
  const focus = (id: string) => {
    if (id === root) return;
    if (!canLeave()) return;
    const node = resolveFocusNode(items, graph, selection, id);
    setRoot(id);
    setExpanded([]);
    inspect(node ? { kind: "node", node } : undefined);
    if (node) publishFocus(node);
  };
  useEffect(() => {
    if (!shouldAdoptSharedFocus(visible, sharedFocus, historical, handledFocus.current, dirty))
      return;
    handledFocus.current = sharedFocus!.id;
    setRoot(sharedFocus!.id);
    setExpanded([]);
    inspect();
  }, [sharedFocus?.id, historical, dirty, visible]);
  const selectReceipt = (id: string) => {
    if (id === receipt || !canLeave()) return;
    inspect(selection, id);
  };
  return {
    selection,
    receipt,
    dirty,
    setDirty,
    selectNode,
    selectEdge,
    focus,
    inspect,
    canLeave,
    selectReceipt,
    pendingSelection: dirty && Boolean(sharedFocus) && handledFocus.current !== sharedFocus?.id,
  };
}
