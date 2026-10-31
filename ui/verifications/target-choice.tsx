import { useConfigurations, ConfigurationPaging } from "../configurations/native-capture.tsx";
import { ConfigurationChoice } from "../configurations/choice.tsx";
import type { Configuration } from "../../src/core/configuration.ts";
import type { VerificationTargetPolicy } from "../../src/core/verification-case.ts";
import type { Editing } from "../editing.ts";

export function VerificationTargetChoice({
  id,
  target,
  policy,
  bound,
  editing,
  onChange,
  onPolicy,
}: {
  id: string;
  target?: Configuration;
  policy: VerificationTargetPolicy;
  bound: boolean;
  editing: Editing;
  onChange(id: string): void;
  onPolicy(value: VerificationTargetPolicy): void;
}) {
  const catalog = useConfigurations(editing.epoch);
  return (
    <section aria-label="Verification engineering target">
      <h4>Engineering target</h4>
      <ConfigurationPaging catalog={catalog} />
      <ConfigurationChoice
        title="Verification target configuration"
        value={id ? { id, name: target?.name ?? id } : undefined}
        items={catalog.read.retained?.items ?? []}
        onChange={(x) => {
          if (x || !bound) onChange(x?.id ?? "");
        }}
        disabled={!catalog.read.ready}
      />
      <p>
        {id
          ? "Engineering inputs resolve from this immutable configuration. Later live edits do not rebase it."
          : "No configuration selected: existing current-head verification semantics apply."}
      </p>
      {bound && (
        <p>
          This case retains an explicit target. A new target requires a reasoned basis revision;
          clearing the picker cannot silently return to current-head semantics.
        </p>
      )}
      {id && (
        <label>
          Target input policy
          <select
            aria-label="Verification target policy"
            value={policy}
            onChange={(e) => onPolicy(e.target.value as VerificationTargetPolicy)}
          >
            <option value="target-reference-uses-v2">
              Independent contextual reference uses (V2)
            </option>
            <option value="target-input-correspondence-v1">
              Declared input correspondence (V1)
            </option>
          </select>
        </label>
      )}
      {target && !target.capture && (
        <p role="alert">
          This legacy capture has no controlled scope/content declaration. Select a controlled
          capture for target verification.
        </p>
      )}
    </section>
  );
}
