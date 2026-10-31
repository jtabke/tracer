# Private development register

Tracer's own needs, requirements and delivery records are an optional local dogfooding project, not required to build or use the product. The native register owns structured delivery/work status; Markdown and screenshots do not replace controlled evidence or representative-user validation.

## Local workflow

```sh
node scripts/register.mjs status
node scripts/register.mjs show WORK-035
node scripts/register.mjs export
node scripts/register.mjs backup /absolute/path/to/new-backup.sqlite
```

The helper resolves its default database, bootstrap and deterministic review export under ignored `.local/tracer-development/`, independently of the shell working directory. `--db PATH` selects a different database explicitly for inspection or disposable work. Export remains local; do not commit generated snapshots, per-run reports or backup chains. A fresh clone intentionally has no private register.

Read schema/object versions before guarded edits and preserve unchanged fields. Whole fields objects replace earlier fields; evidence-dependent work must guard the captured native/evidence clocks. Inspect unknown command outcomes before acknowledgment; never blindly replay an uncertain write. Delivery, verification and representative-user validation remain independent statuses.

## Recovery and first setup

Missing data is not permission to seed a replacement. Recover a completed SQLite online backup to the intended database path, then use `--db PATH status` to inspect it before selecting it. Never copy only an active SQLite main file while WAL writes may be outstanding. JSON export is not a supported database restore format; it omits operational recovery state retained by SQLite backup.

The helper's `init` is only for an explicitly selected disposable project using a recovered private `bootstrap.json`. It refuses existing files and missing bootstrap material before creating a database. It does not reconstruct the latest project or silently reseed a fresh clone. For ordinary product projects, use [getting started](../guides/getting-started.md).

The public tree retains useful [acceptance specifications](specifications/) and [model templates](../reference/models/), not the live database or a second delivery-status inventory.

## Historical evidence

During public-project cleanup, the complete former `projects/tracer/` directory moved to `.local/tracer-development/`, preserving its filenames, database, original reports and backup chain. Historical recorded paths beginning `projects/tracer/` resolve there for local inspection; do not rewrite captured source hashes or historical assertions to pretend the files always lived at the new path. The helper alone moved to `scripts/register.mjs`.

A verified native209 online backup and checksum manifest of the pre-move working-tree documents/register payloads are retained locally under `output/public-project-cleanup/`. Old published payloads also remain in Git history at `debc6cbf15ea2ff86a2e3036cab3188c7dcf979a`; that commit does not contain later uncommitted register updates. Neither local directory is a promised remote/off-machine backup. Keep an independently managed durable backup when the private project matters.

See [archive recovery](archive.md) for older design/engineering history. Per-run evidence stays local; deliberately publish a scoped, sanitized report only when contributors actually need it.
