import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Configuration } from "../src/core/configuration.ts";
import type { Entity } from "../src/core/model.ts";
import type { Editing } from "./editing.ts";
import { ControlledConfigurationCapture } from "./configuration-capture.tsx";
import { ConfigurationPairWorkspace } from "./configuration-pair.tsx";
import { useApplicationDirty } from "./application-choices.tsx";
import "./configuration-workspace.css";
import { ConfigurationDetails, ConfigurationPaging, useConfigurations } from "./configurations.tsx";
import { useProjection } from "./use-projection.ts";

export type ConfigurationIntent = { id: string; sequence: number };

export function ConfigurationWorkspace({
  editing,
  entities,
  onDirty,
  changed,
  intent,
  returnLabel,
  onReturn,
}: {
  editing: Editing;
  entities: Entity[];
  onDirty(value: boolean): void;
  changed(): void;
  intent?: ConfigurationIntent;
  returnLabel?: string;
  onReturn?(): void;
}) {
  const catalog = useConfigurations(editing.epoch);
  const [{ selected, mode, captureKey }, setNavigation] = useState({
    selected: "",
    mode: "catalog",
    captureKey: 0,
  });
  const [dirty, setDirty] = useState(false);
  const capturing = mode === "capture",
    comparing = mode === "compare";
  const setMode = (mode: string) => setNavigation((previous) => ({ ...previous, mode }));
  const setSelected = (selected: string) =>
    setNavigation((previous) => ({ ...previous, selected }));
  useApplicationDirty(dirty, onDirty);
  function startCapture() {
    setNavigation((previous) => ({
      ...previous,
      captureKey: previous.captureKey + 1,
      mode: "capture",
    }));
  }
  useEffect(() => {
    if (!intent?.id) return;
    setNavigation((previous) => ({ ...previous, selected: intent.id, mode: "catalog" }));
  }, [intent?.sequence, intent?.id]);
  return (
    <section className="configuration-workspace" aria-label="Project configurations">
      <div hidden={capturing || comparing}>
        <header className={`configuration-workspace-header ${selected ? "has-selection" : ""}`}>
          <div>
            <h2>Configurations</h2>
            <p>Exact native, relationship and observed-content selections.</p>
          </div>
          <button onClick={() => setMode("capture")}>Capture configuration</button>
          <button onClick={() => setMode("compare")}>Compare configurations</button>
          <NewCaptureButton dirty={dirty} busy={editing.busy} start={startCapture} />
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
              epoch={editing.epoch}
              report={editing.report}
              onBack={() => setSelected("")}
            />
          )}
        </div>
      </div>
      <ControlledConfigurationCapture
        key={captureKey}
        active={capturing}
        onReturn={() => setMode("catalog")}
        entities={entities}
        editing={editing}
        onDirty={setDirty}
        changed={changed}
      />
      <ConfigurationPairWorkspace
        catalog={catalog}
        editing={editing}
        active={comparing}
        onReturn={() => setMode("catalog")}
      />
    </section>
  );
}

function NewCaptureButton({
  dirty,
  busy,
  start,
}: {
  dirty: boolean;
  busy: boolean;
  start(): void;
}) {
  return (
    <button
      disabled={busy}
      onClick={() => {
        if (
          dirty &&
          !window.confirm("Discard this capture draft and start a new capture identity?")
        )
          return;
        start();
      }}
    >
      Start new capture
    </button>
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
