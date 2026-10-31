# Engineering checkpoint

## Completed source-preview productization — 2026-10-31

The owner selected coverage-preserving legacy retirement, supported local operations, feature ownership, production-browser PR smoke, support/security/issue guidance and honest changelog/maturity claims. Prior verified assessment/public organization work is committed locally as `ae844f4` and `9f84f1b`. This checkpoint belongs to the subsequent complete productization candidate. No push, release or deployment is authorized.

The duplicate test-only tabbed UI is retired after a read-only audit and production ports. [The coverage map](../test/README.md) names shared regression owners and explicitly disposes of unshipped prototype affordances; it does not claim bit-for-bit shell parity. Original sources remain in Git and `.local/tracer-development/archive/legacy-ui-9f84f1b/`. All browser specs target the shipped `dist/`; the retained workbench harness remains orchestration over production owners.

The ports repaired real integration defects: receipt-switch discard/unknown-save guards, exact configuration return, native-task receipt layout, modal documentation scroll and structured statement presentation. Configuration and record code now follows [feature ownership](../ui/README.md), without compatibility shims or parallel state models. Backend lifecycle, immutable evidence/history and explicit command-recovery contracts remain unchanged.

## Verification

- `npm run check` passed: **701 unit tests, 153 production Chromium scenarios**, workbench types/native journeys/layout/assessment safety, formatting/strict types/lint and unchanged dead-code/duplication/measured-complexity/coverage gates. Log: `output/productization/check.log` (SHA-256 `0c007e1dfc57ff64389483ff993d5d59bab35f7a0195dc51ad84de531c4abc77`).
- The new default-workbench checks cover incoming-only endpoint races/no partial writes, 65 connections including an endpoint outside drawn nodes, structured fields, failed-refresh locks, historical absence/relink and lost committed schema-response inspection without replay. Actual record connection-draft discard is checked at three widths. Online backup tests retain live-WAL history/command outcomes and reject overwrite/missing-source/symlink cases.
- A public-only source copy passed strict types/build with installed dependencies but **without private data, archives or prebuilt assets**: `output/productization/public-source-build.log`.
- Inspected current receipt pixels at 1440/390px and documentation at 390px. These software checks are not representative-user validation. PR smoke is configured; no hosted Actions execution is claimed.

The exact public candidate is recorded in `output/productization/candidate-files.json` (SHA-256 `847563dadf64756d1aeffa2dc5960258ae62624bf109431bb6db6cbc4662a8d6`; excludes only this reporting checkpoint). Detailed audit/run artifacts remain local, not tracked report dumps. Earlier 726/235 counts belong to the pre-retirement candidate and are not current evidence.

## Preservation and next action

Native **211/schema 7**, **WORK-037** records completion; previous work records retain their historical evidence and now reflect later commit authority. The deterministic private export and online backup `.local/tracer-development/backups/productization-native211.sqlite` are saved. A disposable restored copy matched the native211 export exactly and retained the command outcome (`output/productization/backup-restore-check.log`). Public builds need no register. [Register recovery](development/register.md) and [historical recovery](development/archive.md) retain preservation guidance.

Review the local productization commit. Keep new experiments/private exports local and preserve production regression ownership. Select representative-user evaluation, further capabilities or a distribution/release decision separately. Current `0.1.0` remains an unpublished source preview, with no support SLA, team/backend parity or physical/regulatory conformity claim.
