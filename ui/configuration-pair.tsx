import { useState } from "react";
import type { Configuration } from "../src/core/configuration.ts";
import type { ConfigurationPair } from "../src/core/configuration-comparison.ts";
import type { Editing } from "./editing.ts";
import { useConfigurations, ConfigurationPaging } from "./configurations.tsx";
import { useProjection } from "./use-projection.ts";
import { ConfigurationDifferences } from "./configuration-differences.tsx";
import { ConfigurationDependencies } from "./configuration-dependencies.tsx";

export function ConfigurationPairWorkspace({
  catalog,
  editing,
  active,
  onReturn,
}: {
  catalog: ReturnType<typeof useConfigurations>;
  editing: Editing;
  active: boolean;
  onReturn(): void;
}) {
  const [before, setBefore] = useState<Configuration>(),
    [after, setAfter] = useState<Configuration>();
  const [pair, setPair] = useState<ConfigurationPair>();
  const [epoch, setEpoch] = useState(0);
  const changed = pair && (before?.id !== pair.beforeId || after?.id !== pair.afterId);
  return (
    <section
      aria-label="Compare configuration task"
      className="configuration-comparison"
      hidden={!active}
    >
      <button className="text-action" onClick={onReturn}>
        Return to configurations
      </button>
      <h2>Compare configurations</h2>
      <p>
        Choose two immutable captures. Changes describe selected facts; engineering impact remains
        unassessed.
      </p>
      <ConfigurationPaging catalog={catalog} />
      <ConfigurationChoice
        title="Before configuration"
        value={before}
        items={catalog.read.retained?.items ?? []}
        onChange={setBefore}
        disabled={!catalog.read.ready || editing.busy}
      />
      <ConfigurationChoice
        title="After configuration"
        value={after}
        items={catalog.read.retained?.items ?? []}
        onChange={setAfter}
        disabled={!catalog.read.ready || editing.busy}
      />
      <button
        disabled={!before || !after || !catalog.read.ready || editing.busy}
        onClick={() => {
          if (before && after) {
            setPair({ beforeId: before.id, afterId: after.id });
            setEpoch((x) => x + 1);
          }
        }}
      >
        Compare selected pair
      </button>
      {changed && (
        <p role="status">
          Pair choices changed. The displayed comparison still belongs to its recorded pair; compare
          explicitly to adopt these choices.
        </p>
      )}
      <ReadConfigurationPair pair={pair} editing={editing} epoch={epoch} />
    </section>
  );
}

function ConfigurationChoice({
  title,
  value,
  items,
  onChange,
  disabled = false,
}: {
  title: string;
  value?: Configuration;
  items: Configuration[];
  onChange(value: Configuration | undefined): void;
  disabled?: boolean;
}) {
  return (
    <label>
      {title}
      <select
        aria-label={title}
        value={value?.id ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(items.find((x) => x.id === e.target.value))}
      >
        <option value="">Choose an exact capture</option>
        {value && !items.some((x) => x.id === value.id) && (
          <option value={value.id}>{value.name} · retained selection</option>
        )}
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} · {x.members.length} members · {x.at}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadConfigurationPair({
  pair,
  editing,
  epoch,
}: {
  pair: ConfigurationPair | undefined;
  editing: Editing;
  epoch: number;
}) {
  const [retry, setRetry] = useState(0);
  const comparison = useProjection(
    "/api/configuration-comparison",
    pair,
    editing.epoch + epoch + retry,
    editing.report,
  );
  return (
    <>
      {" "}
      {comparison.loading && <p role="status">Reading exact selected states…</p>}
      {comparison.failed && (
        <p role="alert">
          This exact pair could not be read. Previously read context is retained; no current state
          has been substituted.
        </p>
      )}
      {pair && (
        <button disabled={comparison.loading} onClick={() => setRetry((x) => x + 1)}>
          Retry exact pair
        </button>
      )}
      {comparison.retained && (
        <>
          <ConfigurationDifferences value={comparison.retained} />
          <ConfigurationDependencies
            key={comparison.retained.basis.digest}
            pair={comparison.retained.basis}
            editing={editing}
          />
        </>
      )}
    </>
  );
}
