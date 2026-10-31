# Engineering checkpoint

## Current maintenance slice

**Owner-selected, 2026-10-30:** organize the public project for users/contributors: keep generated development dumps private, separate user/reference/development documentation, shorten architecture/progress pages and move the maintained workbench harness beside tests. No staging, commit, push, history rewrite or deployment is selected.

The native development project has moved intact from `projects/tracer/` to ignored `.local/tracer-development/`. `node scripts/register.mjs status` reads the same schema7 project; a pre-move SQLite online backup and checksum manifest are retained in ignored `output/public-project-cleanup/`. Fresh clones intentionally have no private register and cannot silently reseed one. Useful model templates and bounded specifications remain public.

Documentation now starts at [the index](README.md), with `guides/`, `reference/` and maintained `development/` direction. [Architecture](architecture.md) links focused contracts rather than a dated implementation journal. [test/workbench/](../test/workbench/README.md) owns the unchanged production-backed fixture/check workflows. Historical pointers, duplicate plans and long activity logs are preserved through [archive recovery](development/archive.md), not carried as public product surfaces.

## Verification

The final complete `npm run check` passed **726 unit tests, 235 browser scenarios**, workbench types/native journeys/layout/gallery and the measured-quality gates with unchanged thresholds. The existing harness-only analysis exclusion moved with those same files; production source gained no exemption. Canonical log: `output/public-project-cleanup/check.log`.

New regressions check all maintained Markdown links, ignored private/generated data versus publishable source, and fresh-clone refusal to silently reseed/create a missing private register. In-app desktop/mobile documentation, external source links, generated API documentation and the relocated fixture runners passed. A disposable public-source copy, with installed dependencies but no private register/archive or prior build, passed strict types and the production build (`public-only-build.log`). The relocated native209 database matched its preserved deterministic export byte-for-byte before recording this maintenance outcome. No source-history assertions were rewritten.

The pre-reorganization docs/register payloads and native209 online backup remain locally checksum-preserved. Native work record WORK-036 owns this completed maintenance outcome; native210 and its local export/online backup retain the updated register without publishing generated snapshots. The latest backup is `.local/tracer-development/backups/public-project-organization-native210.sqlite`. Historical check logs, including the preceding 724-test cleanup candidate, remain available locally. After verification, the safe cleaner removed generated builds, coverage/analysis caches and the harness snapshot while preserving `.local/`, backups, logs and source history. Fresh coverage-dependent quality runs now require regeneration.

## Remaining authority and limits

Implementation and software verification are complete; review the organized diff before selecting commits/push. Private data, report hashes, unknown-save controls and prior assessment work are preserved. Representative-user validation, authenticated hosting/backend parity and production readiness remain separate unproven obligations. No staging, publishing or history rewrite has occurred.

The optional [native register](development/register.md) owns structured work/delivery status; this page is a concise engineering handoff, not another feature backlog. Older exact activity/check records are available through the archive guidance.
