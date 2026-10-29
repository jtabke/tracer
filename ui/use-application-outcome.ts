import { useEffect, useEffectEvent, useRef } from "react";
import { useProjection } from "./use-projection.ts";
export function useRecoveredApplication(
  commandId: string | undefined,
  outputId: string,
  editing: import("./editing.ts").Editing,
  epoch: number,
  saved: () => void,
) {
  const outcome = useProjection(
      "/api/evaluation-outcome",
      commandId ? { commandId } : undefined,
      editing.epoch + epoch,
      editing.report,
    ),
    handled = useRef("");
  const confirmed = useEffectEvent(saved);
  useEffect(() => {
    if (
      editing.busy ||
      !outcome.ready ||
      !outcome.data ||
      !commandId ||
      handled.current === commandId
    )
      return;
    if (outcome.data.commandId === commandId && outcome.data.receipt.output.id === outputId) {
      handled.current = commandId;
      confirmed();
    }
  }, [editing.busy, outcome.ready, outcome.data, commandId, outputId]);
}
