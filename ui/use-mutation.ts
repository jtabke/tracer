import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MutationController } from "./mutation-controller.ts";
import { write } from "./write-transport.ts";

export const MutationControllerContext = createContext<MutationController | null>(null);

export function createMutationController(report: (error: unknown, attempted?: unknown) => void) {
  return new MutationController(write, report);
}

export function useMutation(report: (error: unknown, attempted?: unknown) => void) {
  const shared = useContext(MutationControllerContext);
  const latest = useRef(report);
  latest.current = report;
  const [controller] = useState(
    () =>
      shared ?? createMutationController((error, attempted) => latest.current(error, attempted)),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  useEffect(() => {
    if (shared && state.status === "rejected") latest.current(state.error);
  }, [shared, state]);
  return {
    state,
    busy: state.status === "saving",
    blocked: state.status === "saving" || state.status === "unknown",
    run: controller.run,
    beginReconciliation: controller.beginReconciliation,
    acknowledge: controller.acknowledge,
  };
}
