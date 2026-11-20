# Engineering checkpoint

## Workspace identity and scale

The Graph / Matrix / History workbench now opens a bounded native neighborhood. Search, project views, matrix columns and historical details use revision-pinned reads on demand. No database migration or framework replacement was needed. The [workspace architecture](reference/architecture/workspace.md) describes the owners, stale-read guard, retained editors and recovery boundary. This builds on the starter-first Model, modal dismissal and state-machine hardening in `a5e7b8f`; their [transition owners and invariants](reference/architecture/state-machines.md) remain in force.

### Evidence

- On the synthetic 10,000-record / 100,000-connection project the initial graph used **6 API responses, 121,083 decoded body bytes**. The initial JavaScript totaled 664,752 decoded bytes. The audited loader used 118 reads and 88,821,296 JSON bytes. The [browser scale test](../test/main-workflow-scale-browser.spec.ts) enforces an eight-request, 256 KiB opening budget and also covers a small graph with 1,500 historical edits. It checks the opening and a confirmed edit without a project snapshot or history scan.
- An unchanged-schema preview over the same population validated every record and connection in 110 population pages, without the previous 200,000 individual entity reads. In the local probe, the preview took 196 ms and a 21-link historical incident query took 0.09–0.47 ms. A one-step matrix projection with 4,000 roots took 79 ms including its first link index, then under 0.5 ms with that index retained. These local in-process results exclude rendering and are not timing guarantees.
- [Regression tests](../test/workspace-reads.test.ts) cover rename and reuse of a key, revision-pinned paging across a deletion, superseded reads, and preservation of parallel links and matrix truncation. The shipped browser workflows exercise retained drafts, focus and uncertain saves without replay.

### Verification

After integrating the upstream Model and recovery changes, `npm run check` passed: formatting, strict types, UI lint, **711 unit/service tests**, **162 production Chromium tests**, the workbench journeys and the measured quality gate. Chromium ran with the repository default of one worker. The combined gate log and the local fixture measurements are in `output/workspace-audit/rebase-check.log` and `output/workspace-audit/final-probe.log`; they are intentionally untracked.

The publicly documented project-wide limits still apply when a complete view is requested. This checkpoint does not claim arbitrary-scale support, representative-user validation, release, or deployment. The private delivery register was unavailable and was not changed.
