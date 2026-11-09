# Engineering checkpoint

## State-machine audit and bounded hardening — 2026-10-31

The owner selected application-wide state-machine discovery and low-risk, evidence-backed repairs. [Transition ownership](reference/architecture/state-machines.md) maps domain, persistence, API/client, asynchronous UI, draft/recovery and host lifecycle owners, invariants and remaining review checkpoints. Existing controllers/guards remain authoritative; no state-machine dependency, storage migration, contract expansion or automatic retry was introduced. Existing uncommitted UI/documentation work is preserved separately.

Implemented five demonstrated corrections:

- Assessment parsers reject coercible discriminator lookalikes such as `state: ["done"]`, which previously bypassed strict completion/waiver guards and could permit assessment closure without current reverification evidence. Candidate/support/parsed disposition discriminators now use the same literal-string rule. Rejections preserve native/evidence state and allow corrected command-identity reuse; malformed read projections fail closed. A small local predicate and shared native-support classification keep validation below the existing cognitive-complexity limit.
- Host shutdown drains active request-handler promises after HTTP connections close. A client abort no longer allows repository cleanup while its mutation remains in flight. Successful and failed disconnected handlers drain; repeated close calls retain one completion promise. No cancellation or replay is inferred from disconnection.
- Record-connection and reference draft owners capture native UUIDs before sending. Uncertain attempts retain those identities for history inspection rather than entering an unrecoverable missing-identity path. Confirmed connection saves and explicit draft discard rotate the proposed identity.
- The trace Matrix has one table-scroll owner instead of a redundant narrow-screen wrapper. Render preparation retains the surrounding controls' DOM-owned scroll offset across same-perspective renders. Opening an editor no longer loses a focus-induced 2px offset; exact desktop/narrow row geometry and scroll-position assertions remain intact.
- Documentation records/restores its actual `.native-task-body` scroller, not the now-nonscrolling dialog. A strengthened desktop/390px regression changes the shared scrollbar while another task is active and proves the reader restores its own position without losing the evidence draft or issuing a write. Formatting-only cleanup of the pre-existing `ui/native-task.tsx` edits preserves their behavior.

Final qualification:

- **One complete final `npm run check` passed: 706 unit/service/projection tests, all 161 production Chromium scenarios, workbench journeys, formatting, strict types, lint and unchanged measured-coverage/dead-code/duplication/complexity gates.** Log: `.local/state-machines/check-complete.log`. Earlier incomplete gate runs are superseded; their diagnostic logs remain local.
- The four new creation-recovery scenarios cover unsent and committed connection/reference outcomes, captured identities, inspection/acknowledgement, retained drafts, exact saved IDs and one POST only. Assessment checks cover literal-discriminator matrices, unchanged native/evidence state on rejection, corrected command-ID reuse, HTTP/CLI/read compatibility and controlled closure. Shutdown checks cover idempotent close and disconnected success/failure.
- The Matrix geometry failure and documentation restoration defect were reproduced before repair. The final gate exercises exact desktop/narrow geometry, inner and surrounding scroll ownership, documentation position across task switches, failed reads, stale writes, historical locks and unknown-outcome recovery. Actual 390px documentation and 680px Matrix-editor pixels were inspected.
- Independent read-only review found no concrete correctness issue in the initial scoped candidate and passed 20 focused tests. Subsequent scroll-owner repairs and complexity-only simplifications were locally reviewed and covered by the complete final gate. No quality threshold or assertion was weakened.

Qualification is complete for this slice. After qualification, the owner authorized committing and pushing all verified pending changes, including the earlier model/dialog work required by the final documentation-scroll fix. `main` matched the freshly fetched `origin/main` immediately before preparing the commit. Verification covers this complete combined candidate, not a state-machine-only subset. Private register WORK-041 records completion. Refresh publication/adoption races, latest-versus-pinned navigation semantics and focus-return expansion ownership remain separately scoped architectural follow-ups in the transition map, not unfinished required gates. No production-data scan/repair, release, deployment or representative-human validation is claimed.

## Consistent modal dismissal — 2026-10-31

The owner selected an audit/fix of modal close placement and outside-click dismissal. This follows the starter-first Model setup, typography and connected-review slice. Base: `beb7acb`; all changes remain uncommitted, including that earlier slice. No prior changes were reset or staged.

Shared task dialogs now show a 40px upper-right × control in a sticky header, with task navigation on a separate row at narrow widths. Sticky positioning lives in the shared task stylesheet rather than depending on the retained Development map’s styles. Removed the assessment-specific header override that conflicted with the shared layout. Workspace dialogs likewise keep their close header visible while scrolling. Native light dismissal enables backdrop click and Escape through cancellable close requests.

Retained task drafts survive ×, outside click and Escape. Transient workspace forms instead confirm before discarding edited input; cancelling that confirmation leaves the exact proposal intact. The × uses the same cancellable close path, and the existing workspace pending-save guard applies before any discard prompt. Focus returns to the logical opener, including after replacement/resizing. Sustained Model, Verification and Change assessments pages remain pages, not backdrop-dismissible dialogs. No backend, persisted schema, dependency, quality threshold or engineering lifecycle changed.

## Verification

- The full-check run passed **701 unit tests and all 157 production Chromium scenarios**, formatting/types/lint and the browser build. It stopped at historical workbench fixtures that still assumed edited dialogs closed without discard confirmation. Log: `.local/ui-audit/dialogs/check.log`.
- Updated only those fixture dismissal steps to explicitly accept the new confirmation. **Workbench journeys and all unchanged measured-coverage, dead-code, duplication and complexity gates passed** afterward: `.local/ui-audit/dialogs/final-gates.log`. Broader passing evidence is reused; no single complete final `npm run check` invocation is claimed.
- New desktop/390px tests check close-button geometry after scrolling, retained creation drafts through ×/backdrop/Escape, transient-form discard cancellation/acceptance, focus restoration and zero native writes. Existing pending-connection coverage now also proves outside-click cannot dismiss a saving form. Existing search/mobile-navigation/context/recovery scenarios passed unchanged apart from one explicit edited-form discard acceptance.
- Inspected actual 1440px/390px modal screenshots under `output/dialog-dismissal/`. No representative-human validation is claimed.

## Retained setup work

Engineering/Software/Custom starters, explicit Use this model, the connected read-only ModelMap review and secondary Customize model remain implemented. Development flow and native Trace connections retain separate meanings. Type/connection inspection does not mutate the model. Desktop fitting has an 80% readability floor; narrow diagrams scroll horizontally at full size. Model typography retains explicit 600/500/400 roles. The expanded passing browser suite covers this earlier slice, with its original evidence under `.local/ui-audit/graph/` and `.local/ui-audit/typography/`.

Private register **native 216/schema 7** records **WORK-040** for dialogs and **WORK-039** for setup. The deterministic export and online backup `.local/tracer-development/backups/dialog-dismissal-native216.sqlite` are saved locally. Public contribution needs no private database, generated logs or captures.

## Next action and limits

Review locally at `http://127.0.0.1:4318/`. Existing tabs need new assets; preserve unsaved drafts before reloading. The isolated review database is under `.local/ui-audit/redesign-dR62kxN0/`; earlier audit data at port 4317 remains intact. The agent did not reload or discard the existing review tab’s drafts. No commit, push, release or deployment is authorized by this request. Current `0.1.0` remains an unpublished source preview, without representative-user, hosted/team/backend-parity or physical/regulatory validation claims.
