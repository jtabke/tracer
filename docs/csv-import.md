# Import CSV

Open your project, save its model, then choose **Project tools → Import CSV**. Upload a comma-separated UTF-8 file or open **Paste or edit CSV** and choose **Read columns**. The first nonempty row supplies unique column headers.

## Map records and links

Choose **New records, with optional links**, select one record type, and map a **Stable key column** plus its schema-defined fields. Matching field headers are suggested; review each selection. **Do not import** omits a field. Required fields still need values in every row.

Use **Add link mapping** to choose an outgoing relationship and a target-key column. Each cell contains one exact key. Targets may be existing records or records anywhere in this same file, including later rows. An empty target cell creates no link; supplying link attributes without a target is an error. Relationship fields have their own column mappings.

For connections between existing records, choose **Links between existing records**, map source and target key columns, choose a relationship type and map any relationship fields. Both endpoints must exist and satisfy the model's allowed types.

Keys match exactly across the project, including case and spaces. Titles and UUIDs are not lookup keys. Existing keys or repeated record keys produce errors; this import creates records and never overwrites them. For different record types, import one file per type, then connect their keys. Duplicate connections are errors rather than silently skipped rows.

## Preview and commit

Choose **Preview import**. Tracer reads a fresh complete project snapshot and shows proposed record fields, key-to-key links, ignored columns and errors with CSV line/column context. Multiline quoted cells retain their starting physical line number. Tables and errors are paged in groups of 25; counts cover the whole file.

Fix every error and preview again. Changing data or mappings clears the previous preview. Unmapped columns are explicitly listed and omitted. No preview writes records or allocates a history revision.

When the preview is ready, choose **Commit entire import**. All records and links save in one native changeset. The server revalidates fields, key uniqueness, model version, captured project revision, relationship permissions, endpoint versions and duplicate connections inside the transaction. A failure rolls back every imported record/link and the proposed revision. Any intervening native project change requires a new preview, including unrelated edits. The captured revision also protects the preview's resulting workspace-size checks.

A successful confirmation identifies the saved revision. If the response is lost, writes pause and the CSV/mapping remain in this tab. Return to the workspace to inspect saved records/history and acknowledge the uncertain outcome. No import is automatically replayed. Reopening or reloading does not retain an unsaved CSV draft; the existing draft warning applies.

## Cell formats and limits

- Strings remain literal text, including formulas; Tracer does not evaluate cells.
- Empty cells omit fields. Boolean cells use `true` or `false` (case-insensitive); number cells use finite decimal/exponent notation without units or thousands separators. JSON fields contain valid JSON text.
- Quoted commas/newlines and doubled quotes are supported, including CRLF and a UTF-8 byte-order mark. Entirely empty rows are skipped. Malformed quoting, inconsistent row widths and empty/duplicate headers are errors.
- One import accepts up to 512 KiB, 100 columns, 1,000 data rows, eight outgoing link mappings and 1,000 combined record/link operations. The serialized batch must fit the local HTTP request limit; the preview checks its size. Split larger files deliberately.
- Preview uses the application's complete snapshot bound of 10,000 records / 100,000 connections. Oversized projects reject the read rather than resolving keys from a partial population. Preview also blocks imports whose resulting record/link counts would cross those limits.

Spreadsheet workbooks, automatic delimiter/encoding detection, updates/merges into existing records, multiple keys per cell, saved mapping recipes and evidence-file import are outside this CSV slice. A record named “test result” does not create an immutable evaluation receipt; record actual or clearly labeled simulated outcomes through Evaluations.

## Use the planner from a script

The public `previewCsvImport` helper is read-only and uses the same parser/mapping semantics as the UI. It produces explicit create identities and captured version guards for `applyChangeset`. Inspect the rows, ignored columns and issues before applying its operations:

```ts
import { readFile } from "node:fs/promises";
import { Tracer, previewCsvImport } from "@tracer-local/core";
import { SQLiteRepository } from "@tracer-local/core/sqlite";

const repository = new SQLiteRepository("project.sqlite");
try {
  const tracer = new Tracer(repository);
  const preview = previewCsvImport(
    await readFile("requirements.csv", "utf8"),
    {
      kind: "records",
      type: "requirement",
      keyColumn: 0,
      fields: { title: 1, acceptance: 2 },
      links: [{ type: "mapped_to", targetColumn: 3, fields: {} }],
    },
    await tracer.getProjectSnapshot(),
  );
  console.log(preview.rows, preview.ignoredColumns, preview.issues);
  if (preview.issues.length || !preview.operations.length) throw new Error("Fix import errors");
  // Apply only after reviewing this exact preview; do not automatically retry failures.
  await tracer.applyChangeset(
    {
      expectedSchemaVersion: preview.schemaVersion,
      expectedProjectRevision: preview.projectRevision,
      operations: preview.operations,
    },
    { actor: "csv-import", reason: "Reviewed requirements import" },
  );
} finally {
  repository.close();
}
```

Column indexes are zero-based. This mapping assumes the editable Engineering starter and columns `key,title,acceptance,design_key`; every nonempty `design_key` must resolve to a permitted target. There is no dedicated CSV CLI command; scripts and the existing changeset HTTP/CLI route share native commit semantics. See the [developer reference](developer-reference.md) for guarded batch commands and the [workspace reference](workspace-guide.md) for editing and evidence.
