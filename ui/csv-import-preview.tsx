import { useEffect, useRef, useState } from "react";
import type { CsvImportPreview } from "../src/core/csv-import-types.ts";

const PAGE_SIZE = 25;
function Pager({
  total,
  page,
  onChange,
}: {
  total: number;
  page: number;
  onChange(page: number): void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="csv-pager">
      <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
      </span>
      <button
        type="button"
        disabled={(page + 1) * PAGE_SIZE >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
export function CsvPreview({ value }: { value: CsvImportPreview }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, []);
  const [page, setPage] = useState(0);
  const [issuePage, setIssuePage] = useState(0);
  return (
    <div className="csv-preview" role="region" aria-label="CSV import preview">
      <h3 ref={heading} tabIndex={-1}>
        Import preview
      </h3>
      <p>
        {value.counts.records} new records · {value.counts.links} new links · {value.issues.length}{" "}
        errors
      </p>
      <p>
        Based on project revision {value.projectRevision}, model v{value.schemaVersion}. No changes
        have been saved.
      </p>
      <p>
        Ignored columns: {value.ignoredColumns.length ? value.ignoredColumns.join(", ") : "None"}.
      </p>
      {value.issues.length > 0 && (
        <div role="alert">
          <p>Fix all errors and preview again. The entire import is blocked.</p>
          <ul>
            {value.issues
              .slice(issuePage * PAGE_SIZE, (issuePage + 1) * PAGE_SIZE)
              .map((issue, index) => (
                <li key={index}>
                  {issue.line === undefined ? "Mapping" : `Line ${issue.line}`}
                  {issue.column ? ` · ${issue.column}` : ""}: {issue.message}
                </li>
              ))}
          </ul>
          <Pager total={value.issues.length} page={issuePage} onChange={setIssuePage} />
        </div>
      )}
      {value.rows.length > 0 && (
        <>
          <div className="csv-preview-table">
            <table>
              <thead>
                <tr>
                  <th>CSV line</th>
                  <th>Key / type</th>
                  <th>Mapped fields</th>
                  <th>Links by key</th>
                </tr>
              </thead>
              <tbody>
                {value.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>
                      <strong>{row.key}</strong>
                      <br />
                      {row.type}
                    </td>
                    <td>
                      <pre>{JSON.stringify(row.fields, null, 2)}</pre>
                    </td>
                    <td>
                      {row.links.map((link, index) => (
                        <div key={index}>
                          {link.source} → {link.target} ({link.type})
                          <pre>{JSON.stringify(link.fields)}</pre>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={value.rows.length} page={page} onChange={setPage} />
        </>
      )}
    </div>
  );
}
