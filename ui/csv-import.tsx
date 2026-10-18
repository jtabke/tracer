import { useEffect, useRef, useState } from "react";
import type { SchemaObject } from "../src/core/model.ts";
import { parseCsv } from "../src/core/csv.ts";
import type { CsvTable } from "../src/core/csv.ts";
import { previewCsvImport } from "../src/core/csv-import.ts";
import type { CsvImportMapping, CsvImportPreview } from "../src/core/csv-import-types.ts";
import { read } from "./api.ts";
import type { Editing } from "./editing.ts";
import { CsvMapping, initialCsvMapping } from "./csv-import-mapping.tsx";
import { CsvPreview } from "./csv-import-preview.tsx";
import "./csv-import.css";

type Source = { text: string; name: string; table?: CsvTable; mapping?: CsvImportMapping };
const empty: Source = { text: "", name: "" };
export function CsvImport({
  schema,
  editing,
  changed,
  onDirty,
}: {
  schema: SchemaObject | null;
  editing: Editing;
  changed(): void;
  onDirty?(dirty: boolean): void;
}) {
  const [source, setSource] = useState<Source>(empty);
  const [preview, setPreview] = useState<CsvImportPreview>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const sequence = useRef(0);
  const busy = editing.busy || working;
  useEffect(() => onDirty?.(Boolean(source.text)), [source.text, onDirty]);
  function replace(next: Source) {
    sequence.current++;
    setPreview(undefined);
    setNotice("");
    setError("");
    setSource(next);
  }
  function columns(text: string, name: string) {
    try {
      const table = parseCsv(text);
      replace({ text, name, table, mapping: initialCsvMapping(table, "records") });
    } catch (failure) {
      replace({ text, name });
      setError(String(failure));
    }
  }
  async function file(file: File | undefined) {
    if (!file) return;
    replace(empty);
    setWorking(true);
    try {
      if (file.size > 512 * 1024) throw new Error("CSV exceeds 512 KiB");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      columns(text, file.name);
    } catch (failure) {
      setError(`Could not read UTF-8 CSV: ${String(failure)}`);
    } finally {
      setWorking(false);
    }
  }
  async function inspect() {
    if (!source.mapping || !schema || busy) return;
    const current = ++sequence.current;
    setWorking(true);
    setPreview(undefined);
    setError("");
    setNotice("");
    try {
      const snapshot = await read("/api/project-snapshot", {});
      if (snapshot.schema?.version !== schema.version)
        throw new Error(
          "The model changed. Return to the workspace and refresh before mapping these columns again.",
        );
      const result = previewCsvImport(source.text, source.mapping, snapshot);
      if (sequence.current === current) setPreview(result);
    } catch (failure) {
      if (sequence.current === current) setError(String(failure));
    } finally {
      setWorking(false);
    }
  }
  async function commit() {
    if (!preview?.operations.length || preview.issues.length || busy) return;
    setWorking(true);
    setPreview(undefined);
    try {
      const saved = await editing.mutate("/api/changesets", {
        expectedSchemaVersion: preview.schemaVersion,
        expectedProjectRevision: preview.projectRevision,
        operations: preview.operations,
      });
      if (!saved) {
        setError(
          "Import was not confirmed. Inspect the workspace message before creating another preview. The CSV and mapping are retained.",
        );
        return;
      }
      replace(empty);
      setNotice(
        `Imported ${preview.counts.records} records and ${preview.counts.links} links together at project revision ${saved.changeset.projectRevision}.`,
      );
      changed();
    } finally {
      setWorking(false);
    }
  }
  if (!schema) return <p>Configure the project model before importing CSV.</p>;
  return (
    <div className="csv-import">
      <h2>Import CSV</h2>
      <p>
        Create records or links in one transaction. Existing records are never overwritten. Keys
        match exactly, including case and spaces.
      </p>
      <p>
        Use comma-separated UTF-8 CSV with a header row. Quoted commas, line breaks and doubled
        quotes are supported. Limits: 512 KiB, 100 columns, 1,000 data rows and 1,000 combined
        records/links.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <CsvSource
        source={source}
        schema={schema}
        busy={busy}
        replace={replace}
        file={file}
        columns={columns}
        inspect={inspect}
      />
      {preview && <CsvPreview key={sequence.current} value={preview} />}
      {preview && (
        <button
          type="button"
          disabled={busy || preview.issues.length > 0 || !preview.operations.length}
          onClick={() => void commit()}
        >
          Commit entire import
        </button>
      )}
      {busy && <p role="status">Working…</p>}
    </div>
  );
}

function CsvSource({
  source,
  schema,
  busy,
  replace,
  file,
  columns,
  inspect,
}: {
  source: Source;
  schema: SchemaObject;
  busy: boolean;
  replace(source: Source): void;
  file(file: File | undefined): Promise<void>;
  columns(text: string, name: string): void;
  inspect(): Promise<void>;
}) {
  return (
    <fieldset disabled={busy}>
      <legend>Choose data</legend>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void file(selected);
          }}
        />
      </label>
      <details>
        <summary>Paste or edit CSV</summary>
        <label>
          CSV text
          <textarea
            aria-label="CSV text"
            rows={6}
            value={source.text}
            onChange={(event) => replace({ text: event.target.value, name: "Pasted CSV" })}
          />
        </label>
        <button
          type="button"
          disabled={!source.text}
          onClick={() => columns(source.text, source.name)}
        >
          Read columns
        </button>
      </details>
      {source.table && (
        <p>
          {source.name}: {source.table.rows.length} data rows, {source.table.headers.length}{" "}
          columns. Empty cells omit fields; boolean cells use true/false, number cells use finite
          numbers, JSON cells use JSON text.
        </p>
      )}
      {source.table && source.mapping && (
        <CsvMapping
          table={source.table}
          schema={schema}
          value={source.mapping}
          onChange={(mapping) => replace({ ...source, mapping })}
        />
      )}
      <button type="button" disabled={!source.mapping} onClick={() => void inspect()}>
        Preview import
      </button>
    </fieldset>
  );
}
