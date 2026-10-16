import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Configuration } from "../src/core/configuration.ts";
import "./configuration-workspace.css";
import {
  ConfigurationCapture,
  ConfigurationDetails,
  ConfigurationPaging,
  useConfigurations,
} from "./configurations.tsx";
import { useProjection } from "./use-projection.ts";

export type ConfigurationIntent = { id: string; sequence: number };

export function ConfigurationWorkspace({
  epoch,
  busy,
  changed,
  report,
  intent,
  returnLabel,
  onReturn,
}: {
  epoch: number;
  busy: boolean;
  changed(): void;
  report(error: unknown, attempted?: unknown): void;
  intent?: ConfigurationIntent;
  returnLabel?: string;
  onReturn?(): void;
}) {
  const catalog = useConfigurations(epoch);
  const entities = useProjection("/api/entities", { limit: 1000 }, epoch, report);
  const [selected, setSelected] = useState("");
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (!intent?.id) return;
    setSelected(intent.id);
    setCapturing(false);
  }, [intent?.sequence, intent?.id]);
  return (
    <section className="configuration-workspace" aria-label="Project configurations">
      <div hidden={capturing}>
        <header className={`configuration-workspace-header ${selected ? "has-selection" : ""}`}>
          <div>
            <h2>Configurations</h2>
            <p>Captured sets of exact native revisions.</p>
          </div>
          <button onClick={() => setCapturing(true)}>Capture configuration</button>
          {onReturn && (
            <button className="text-action" onClick={onReturn}>
              {returnLabel ?? "Return to previous task"}
            </button>
          )}
        </header>
        <div className={`configuration-catalog-layout ${selected ? "has-selection" : ""}`}>
          <ConfigurationCatalog catalog={catalog} selected={selected} onSelect={setSelected} />
          {selected && (
            <SelectedConfiguration
              id={selected}
              epoch={epoch}
              report={report}
              onBack={() => setSelected("")}
            />
          )}
        </div>
      </div>
      <ConfigurationCapture
        stage
        active={capturing}
        onReturn={() => setCapturing(false)}
        catalog={catalog}
        entities={entities.data?.items ?? []}
        disabled={busy || !entities.ready || !!entities.data?.nextAfter}
        changed={changed}
        report={report}
      />
    </section>
  );
}

function ConfigurationCatalog({
  catalog,
  selected,
  onSelect,
}: {
  catalog: ReturnType<typeof useConfigurations>;
  selected: string;
  onSelect(id: string): void;
}) {
  return (
    <section className="configuration-catalog" aria-label="Configuration catalogue">
      <ConfigurationPaging catalog={catalog} />
      {catalog.read.loading && <p role="status">Loading configurations…</p>}
      {catalog.read.ready && !catalog.read.data?.items.length && (
        <p>No configuration captures yet.</p>
      )}
      <ul className="configuration-catalog-rows">
        {catalog.read.data?.items.map((value) => (
          <ConfigurationRow
            key={value.id}
            value={value}
            selected={selected === value.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

function ConfigurationRow({
  value,
  selected,
  onSelect,
}: {
  value: Configuration;
  selected: boolean;
  onSelect(id: string): void;
}) {
  return (
    <li>
      <button
        aria-label={`Open configuration ${value.name}`}
        aria-pressed={selected}
        onClick={() => onSelect(value.id)}
      >
        <strong>{value.name}</strong>
        <span>
          {value.members.length} pinned members · subject v{value.subject.version}
        </span>
        <small>{value.at}</small>
      </button>
    </li>
  );
}

function SelectedConfiguration({
  id,
  epoch,
  report,
  onBack,
}: {
  id: string;
  epoch: number;
  report(error: unknown): void;
  onBack(): void;
}) {
  const [retry, setRetry] = useState(0);
  const exact = useProjection("/api/configuration", { id }, epoch + retry, report);
  const known = exact.data ?? exact.retained;
  const value = known?.id === id ? known : undefined;
  const region = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!exact.ready) return;
    const heading = region.current?.querySelector<HTMLElement>("h3");
    heading?.focus({ preventScroll: true });
  }, [id, exact.ready]);
  return (
    <section
      className="configuration-selected"
      aria-label="Selected configuration capture"
      ref={region}
    >
      <button className="configuration-catalog-return text-action" onClick={onBack}>
        Return to configuration catalogue
      </button>
      {exact.loading && <p role="status">Reading exact configuration…</p>}
      {!exact.loading && !exact.ready && (
        <div role="alert">
          <p>
            This exact configuration could not be read. No current or later capture has been
            substituted.
          </p>
          {value && <p>Previously read capture retained.</p>}
          <button onClick={() => setRetry((value) => value + 1)}>Retry exact configuration</button>
        </div>
      )}
      {value && <ConfigurationDetails key={value.id} value={value} />}
    </section>
  );
}
