import { useEffect, useRef, useState } from "react";
import type { ViewSave } from "../../../src/application/saved-views.ts";
import type { SavedView } from "../../../src/core/presentation.ts";
import { ApiError } from "../../../ui/api.ts";
import type { MutationExecutor } from "../../../ui/mutation-controller.ts";
import { useMutation } from "../../../ui/use-mutation.ts";
import { useProjection } from "../../../ui/use-projection.ts";

export function useSavedViews() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [epoch, setEpoch] = useState(0);
  const reconciliation = useRef<(() => void) | undefined>(undefined);
  const report = (failure: unknown) => {
    setError(
      failure instanceof ApiError && failure.code === "outcome_unknown"
        ? "Could not confirm the saved-view change. Refresh the list and inspect the named view before retrying."
        : String(failure),
    );
    setMessage("");
  };
  const mutation = useMutation(report);
  const projection = useProjection("/api/saved-views", {}, epoch, (failure) => {
    reconciliation.current = undefined;
    if (failure instanceof ApiError && failure.code === "not_found")
      setError("Restart the older running server to use saved views.");
    else report(failure);
  });
  useEffect(() => {
    if (!projection.ready) return;
    reconciliation.current?.();
    reconciliation.current = undefined;
    setError("");
  }, [projection.state]);
  const refresh = () => {
    reconciliation.current = mutation.beginReconciliation();
    setEpoch((value) => value + 1);
    setMessage("Review the refreshed list before retrying a failed save.");
  };
  const mutate: MutationExecutor = async (path, input) => {
    if (mutation.blocked || !projection.ready) return undefined;
    setError("");
    setMessage("");
    const value = await mutation.run(path, input);
    if (value !== undefined) {
      refresh();
      setMessage("Saved view updated. Engineering records are unchanged.");
    }
    return value;
  };
  return {
    views: projection.data,
    busy: mutation.busy || projection.loading,
    uncertain: mutation.state.status === "unknown",
    canResume:
      mutation.state.status === "unknown" && mutation.state.inspectedRead && projection.ready,
    resume: mutation.acknowledge,
    error,
    message,
    report,
    refresh,
    save: (input: ViewSave) => mutate("/api/saved-views", input),
    remove: (view: SavedView) =>
      mutate("/api/saved-views/remove", { id: view.id, expectedVersion: view.version }),
  };
}
