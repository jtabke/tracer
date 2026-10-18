import { useState } from "react";
import {
  serializeProjectExport,
  type ProjectExport as ExportDocument,
} from "../src/core/project-export.ts";
import { read } from "./api.ts";
import "./project-export.css";

type Prepared = { document: ExportDocument; content: string; bytes: number };

export function ProjectExport() {
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="project-export" aria-label="Project export">
      <h2>Export project</h2>
      <p>
        Prepare a JSON file with all records, links, model versions, recorded history and evidence.
        Configurations, baselines and saved views are included.
      </p>
      <p>
        File and Git references include their recorded locations and any observed hashes or commits.
        Preserve those external files separately; their contents are not included.
      </p>
      <button disabled={busy} onClick={() => void prepare()}>
        {busy ? "Preparing export…" : "Prepare current export"}
      </button>
      {error && <p role="alert">{error}</p>}
      {prepared && <ExportSummary prepared={prepared} />}
    </section>
  );
  async function prepare() {
    setBusy(true);
    setPrepared(null);
    setError("");
    try {
      const document = await read("/api/project-export", {});
      const content = serializeProjectExport(document);
      setPrepared({ document, content, bytes: new TextEncoder().encode(content).length });
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }
}

function ExportSummary({ prepared }: { prepared: Prepared }) {
  const { document, content, bytes } = prepared;
  const { current, evidence, provenance } = document;
  const rows = [
    ["Records", current.entities.length],
    ["Links", current.relationships.length],
    ["Native changesets", provenance.changesets.length],
    ["Object revisions (including deletions)", provenance.revisions.length],
    ["External identities", evidence.external.length],
    ["Observations", evidence.observations.length],
    ["Results", evidence.receipts.length],
    ["Reviews", evidence.reviews.length],
    ["Configurations", document.configurations.length],
    ["Baselines", document.baselines.length],
    ["Saved views", document.savedViews.length],
  ];
  return (
    <section aria-label="Prepared export">
      <div className="toolbar">
        <h3>Prepared export</h3>
        <button
          onClick={() =>
            download(
              content,
              `tracer-r${document.projectRevision}-e${document.evidenceRevision}.json`,
            )
          }
        >
          Download JSON
        </button>
      </div>
      <p role="status">
        Native revision r{document.projectRevision} · Model{" "}
        {current.schema ? `v${current.schema.version}` : "not configured"} · Evidence sequence{" "}
        {document.evidenceRevision}
      </p>
      <p>
        This file reflects one database snapshot. Later edits do not change this prepared file.
        Prepare again to include them. Evidence retains its original input versions and review
        decisions; freshness is not recalculated.
      </p>
      <dl>
        {rows.map(([name, count]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p>
        {bytes.toLocaleString()} bytes · JSON format v{document.formatVersion}
      </p>
    </section>
  );
}

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
