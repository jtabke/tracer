import { useRef, useState, useSyncExternalStore } from "react";
import { MutationController } from "./mutation-controller.ts";
import { write } from "./write-transport.ts";

export function useMutation(report: (error: unknown, attempted?: unknown) => void) {
  const latest = useRef(report);
  latest.current = report;
  const [controller] = useState(
    () => new MutationController(write, (error, attempted) => latest.current(error, attempted)),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  return {
    state,
    busy: state.status === "saving",
    blocked: state.status === "saving" || state.status === "unknown",
    run: controller.run,
    beginReconciliation: controller.beginReconciliation,
    acknowledge: controller.acknowledge,
  };
}
