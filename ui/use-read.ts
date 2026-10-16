import { useEffect, useEffectEvent, useState } from "react";

export type ReadState<T> =
  | { status: "idle" }
  | { status: "loading"; scope: string; generation: number | string; retained?: T }
  | { status: "ready"; scope: string; generation: number | string; data: T }
  | { status: "failed"; scope: string; generation: number | string; retained?: T; error: unknown };

/** A retained snapshot is display context, never authorization to write. */
export function readResult<T>(
  state: ReadState<T>,
  scope: string | undefined,
  generation: number | string,
) {
  const matching = scope !== undefined && state.status !== "idle" && state.scope === scope;
  const current = matching && state.generation === generation;
  const ready = current && state.status === "ready";
  const retained = matching ? (state.status === "ready" ? state.data : state.retained) : undefined;
  return {
    data: matching && state.status !== "failed" ? retained : undefined,
    retained,
    ready,
    loading: scope !== undefined && (!current || state.status === "loading"),
    failed: current && state.status === "failed",
    state,
  };
}

export function useRead<T>(
  scope: string | undefined,
  generation: number | string,
  load: () => Promise<T>,
  report: (error: unknown) => void,
  enabled = true,
) {
  const loadCurrent = useEffectEvent(load);
  const reportCurrent = useEffectEvent(report);
  const [state, setState] = useState<ReadState<T>>({ status: "idle" });
  useEffect(() => {
    if (scope === undefined) return;
    let active = true;
    setState((previous) => ({
      status: "loading",
      scope,
      generation,
      retained: readResult(previous, scope, generation).retained,
    }));
    if (!enabled) return;
    const request = async () => loadCurrent();
    void request()
      .then((data) => {
        if (active) setState({ status: "ready", scope, generation, data });
      })
      .catch((error) => {
        if (!active) return;
        setState((previous) => ({
          status: "failed",
          scope,
          generation,
          retained: readResult(previous, scope, generation).retained,
          error,
        }));
        reportCurrent(error);
      });
    return () => {
      active = false;
    };
  }, [scope, generation, enabled]);
  const result = readResult(state, scope, generation);
  return { ...result, ready: enabled && result.ready, loading: enabled && result.loading };
}
