import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { NextWorkQuery } from "../src/core/next-work.ts";
import { read, url } from "./api.ts";
import type { Editing } from "./editing.ts";
import { useRead } from "./use-read.ts";
import { useProjection } from "./use-projection.ts";

/** Queue refresh and retained editor/review identities share one tab-local owner. */
export function useNextWorkState(
  editing: Editing,
  active: boolean,
  onDirty: (value: boolean) => void,
) {
  const [selection, setSelection] = useState<NextWorkQuery>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "item" | "review">("list");
  const [recordId, setRecordId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const { itemDirty, setItemDirty, reviewDirty, setReviewDirty } = useNextWorkDrafts(onDirty);
  const report = (failure: unknown) => setError(String(failure));
  const queues = useRead(
    url("/api/next-work", selection),
    `${editing.epoch}:${refresh}`,
    () => read("/api/next-work", selection),
    report,
    active && mode === "list",
  );
  const item = useProjection(
    "/api/connections",
    recordId ? { id: recordId } : undefined,
    editing.epoch,
    report,
  );
  const refreshQueues = () => {
    setError("");
    setRefresh((value) => value + 1);
  };
  const returnToList = () => {
    setError("");
    setMode("list");
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
    });
  };
  const chooseRecord = (id: string) => {
    if (itemDirty && id !== recordId)
      setError("Your item draft is retained. Finish or discard it before choosing another item.");
    else {
      setRecordId(id);
      setError("");
    }
    setMode("item");
  };
  return {
    queues,
    item,
    selection,
    heading,
    mode,
    error,
    receiptId,
    itemDirty,
    reviewDirty,
    setItemDirty,
    setReviewDirty,
    setReceiptId,
    report,
    chooseRecord,
    returnToList,
    refreshQueues,
    itemActive: active && mode === "item",
    reviewActive: active && mode === "review",
    resumeItem: () => setMode("item"),
    resumeReview: () => setMode("review"),
    chooseReceipt: (id: string) => {
      setReceiptId(id);
      setMode("review");
      setError("");
    },
    chooseSelection: (value: NextWorkQuery) => {
      setSelection(value);
      setError("");
    },
    resetSelection: () => {
      setSelection({});
      refreshQueues();
    },
  };
}
function useNextWorkDrafts(onDirty: (value: boolean) => void) {
  const [itemDirty, setItemDirty] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const notifyDirty = useEffectEvent(onDirty);
  useEffect(() => {
    notifyDirty(itemDirty || reviewDirty);
    return () => notifyDirty(false);
  }, [itemDirty, reviewDirty]);
  return { itemDirty, setItemDirty, reviewDirty, setReviewDirty };
}
