# Export a project

Use **Project settings → Import & export → Export project → Prepare current export**, inspect the captured revision and counts, then choose **Download JSON**. Preparing and downloading do not change records, history, evidence or saved views. The prepared file stays fixed when later edits occur; prepare again to include them. A failed preparation clears the previous download and displays the error.

## What the file contains

The versioned `tracer-project-export` JSON format contains:

- `current`: the current schema (or `null` for an unconfigured project), all active records and all active directed links. UUIDs, stable keys, field values and exact object versions are retained.
- `provenance`: all recorded native changesets and object revisions, including historical schemas and deletion tombstones. Revisions identify their changeset, project revision, schema version and ordinal; changesets retain their original actor, reason and time.
- `evidence`: external identities, observations, immutable results/receipts and reviews. Captured inputs, output versions, relationship paths, historical pins, schema snapshots, outcomes, supersession/configuration references, comparison snapshots and original provenance remain as recorded.
- `configurations` and `baselines`: all immutable captures, including exact member/link pins and native commit descriptors.
- `savedViews`: current named view definitions and their versions. These are mutable presentation metadata with no native change history.

Everything is read in **one database transaction**, including the native `projectRevision` and separate evidence append watermark `evidenceRevision`. The native revision does not version evidence, captures or saved views. The watermark covers the evidence collection only. Evidence and captures are exported as recorded at preparation, not as evidence that existed at a baseline's native revision. Freshness is not recalculated and an accepted review is not converted into a current approval.

Native provenance is everything recorded by this database. A migrated legacy database may already contain reconstructed history; exporting preserves that provenance without inventing missing historical information. The scope explicitly states `all-recorded` and `references-only`.

## Preserve external references

The file includes original external identities and observation locators, availability, observed SHA-256 hashes, Git commit IDs and unknown-state reasons where recorded. Export never reads files, contacts Git or creates a new observation. An unobserved external identity stays unobserved; an unknown observation stays unknown.

**External file contents and Git repositories are not bundled.** Preserve referenced files separately and retain the recorded Git commits and repository content. Preserve the original locator-to-file mapping when moving a project. A recorded hash identifies observed content; it does not prove the file is still available. This JSON is a portable data export, not a rendered design-review package or an implemented restore/import format. Continue using a SQLite backup when you need to reopen the database directly. Operational changeset command IDs/outcomes are excluded from JSON export; the database backup preserves durable retry recovery.

## CLI, API and application API

Write canonical JSON directly to a file from the repository root:

```sh
node src/interfaces/cli.ts --db project.sqlite project export > project-export.json
```

The command accepts no extra arguments. Check its exit status; on failure it prints an error to stderr and emits no partial JSON to stdout. Shell redirection may still create an empty file.

The local server exposes the same read-only format through **`GET /api/project-export`**, with the existing selected-project context and no query parameters. It returns `Cache-Control: no-store`; all existing loopback/origin checks apply.

Portable application code can call:

```ts
import { serializeProjectExport } from "@tracer-local/core";

const document = await tracer.exportProject();
const utf8Json = serializeProjectExport(document);
```

## Determinism and bounds

For unchanged persisted content, browser downloads, HTTP responses and CLI output have identical UTF-8 bytes: recursively sorted object keys, compact JSON and one final LF. Current records/links use binary ID order; changesets use project revision order; history uses project revision and ordinal. Evidence and captures retain append order within each collection, including ties in recorded timestamps. Saved views use the existing binary name/ID order. Arrays inside immutable payloads keep their recorded order. There is no generated export timestamp, random export ID, database filename or exporter identity. Original stored timestamps, paths and provenance remain intact.

An export may contain at most **250,000 collection entries and 64 MiB of canonical UTF-8 JSON**. Entries include current objects, history, changesets, evidence, captures and saved views; embedded snapshots count toward bytes. These are implementation budgets, not observed project workloads. Export exhausts all pages independently of map/rendering limits. An exceeded bound or failed read rejects the whole export with a useful error; nothing is silently truncated. Large projects can still use a database backup.
