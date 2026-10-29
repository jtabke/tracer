import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
export function useVerificationActivityTarget(analysis: VerificationAnalysis, editing: Editing) {
  const id = analysis.view.scope.target?.configurationId;
  const read = useProjection(
    "/api/configuration",
    id ? { id } : undefined,
    editing.epoch,
    editing.report,
  );
  return { ...read, ready: !id || read.ready };
}
export function VerificationTargetReadStatus({ failed }: { failed: boolean }) {
  return failed ? (
    <p role="alert">
      The exact verification target could not be read. Activity and support drafts are retained;
      recording is paused.
    </p>
  ) : null;
}
