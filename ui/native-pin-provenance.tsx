import type { PinnedEntity } from "../src/core/configuration.ts";

export function NativePinProvenance({ pin }: { pin: PinnedEntity }) {
  return (
    <details>
      <summary>Captured revision provenance</summary>
      <p>
        Project revision {pin.projectRevision} · schema v{pin.schema.version}
      </p>
      <small>
        Revision {pin.revisionId} · changeset {pin.changesetId}
      </small>
    </details>
  );
}
