import { useState } from "react";
import type { ConfigurationComparison } from "../../src/core/configuration-comparison.ts";
import type { ConfigurationHandoff } from "./handoff.ts";
import { RecordChoice } from "../application-choices.tsx";

export function ConfigurationInvestigation({
  value,
  ready,
  onAssess,
}: {
  value: ConfigurationComparison;
  ready: boolean;
  onAssess(value: Omit<ConfigurationHandoff, "sequence">): void;
}) {
  const [rootId, setRootId] = useState("");
  const members = [
    ...new Map(
      [...value.before.members, ...value.after.members].map((x) => [x.entity.id, x.entity]),
    ).values(),
  ];
  const supported = Boolean(
    value.before.capture && value.after.capture && value.comparability.state !== "incompatible",
  );
  return (
    <section aria-label="Investigate selected configuration pair">
      <h3>Investigate engineering work</h3>
      <p>
        Select a root from this pair's explicit members. Opening an assessment records a scoped
        investigation; it does not establish impact or verification.
      </p>
      <RecordChoice
        name="Investigation root"
        entities={members}
        value={rootId}
        onChange={setRootId}
      />
      {!supported && (
        <p>
          A controlled assessment requires two controlled captures with a common engineering
          subject.
        </p>
      )}
      <button
        disabled={!ready || !supported || !rootId}
        onClick={() =>
          onAssess({
            pair: { beforeId: value.basis.beforeId, afterId: value.basis.afterId },
            rootId,
          })
        }
      >
        Assess displayed pair
      </button>
    </section>
  );
}
