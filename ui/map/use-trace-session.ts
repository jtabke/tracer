import { useRef, useState } from "react";
import type { ViewSnapshot, WalkSession } from "./types.ts";
export function useTraceSession() {
  const [walk, setWalk] = useState<WalkSession | null>(null);
  const [traceHistory, setTraceHistory] = useState<ViewSnapshot[]>([]);
  const [traceNotice, setTraceNotice] = useState<{
    key: string;
    relations: string;
    text: string;
  } | null>(null);
  const returnFrame = useRef<ViewSnapshot | null>(null);
  return { walk, traceHistory, traceNotice, returnFrame, setWalk, setTraceHistory, setTraceNotice };
}
