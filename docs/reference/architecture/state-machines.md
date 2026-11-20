# State machines and transition ownership

Tracer uses domain guards, immutable captures and small local controllers, not a
universal state-machine runtime. This map identifies the authoritative owners;
the types and executable guards at those paths remain the machine-readable
contract. UI booleans must not become alternate engineering authority.

## Workflow map

| Workflow                           | Authoritative owner                                                                                                                                | States/events and guards                                                                                                                                                                                                                               | Persistence, failure and dependants                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native command / transaction       | `src/application/native-command.ts`, `src/application/evaluation-executor.ts`, `src/persistence/sqlite.ts`, `src/persistence/transaction-queue.ts` | Captured proposal → queued → active → committed or rolled back. Expected object/schema/native/evidence clocks are checked in the transaction. Nested same-repository transactions reject; handles expire after completion.                             | Native records, history, evidence and successful command outcome commit together. Rejection must leave the next transaction usable. Independent callers serialize locally; other SQLite writers can receive `busy`. No automatic callback replay. All authoring depends on this boundary.                                                                |
| Command outcome                    | `src/application/changeset-command.ts`, `src/application/evaluation-executor.ts`                                                                   | A successful command ID binds exact intent to its immutable result. A different intent conflicts. An absent lookup is not proof that an in-flight command failed.                                                                                      | Recovery ledgers survive reopen; exports are not database backups. Exact command lookup and explicit human inspection recover lost responses without inventing replacement commands.                                                                                                                                                                     |
| Verification                       | `src/application/verification-context.ts`, `verification-mutation.ts`, `verification-results.ts`, `verification-revise.ts`                         | Open → concluded; explicit revision/reopening rather than silent adoption. Pinned interpretation model, controlled lineage, exact versions and analysis digest govern transitions.                                                                     | Conclusion requires accounted targets and applicable passing results. Historical conclusions remain recorded when current applicability becomes `needs_reassessment`. Evidence review and configuration verification consume these conclusions; ordinary native status edits cannot grant controlled authority.                                          |
| Change assessment                  | `src/application/assessment-context.ts`, `assessment-dispositions.ts`, `assessment-analysis.ts`, `assessment-closure.ts`, `assessment-refresh.ts`  | Open → closed; explicit reopen/refresh. Closing requires current discovery and accounted obligations. Local actions are `open`, `done` or `waived`; existing identity/kind cannot disappear.                                                           | Done actions require known current support; reverification additionally needs a related qualifying result. Waivers require pinned-model permission. Refresh retains earlier obligations. Closure must not invalidate its own support.                                                                                                                    |
| Configuration and baseline capture | `src/application/configuration-capture.ts`, `src/core/configuration-capture-validation.ts`, `src/application/baselines.ts`                         | Guarded proposal → immutable capture. A configuration pins exact members/topology/content; a baseline pins a native revision. Repeated identical configuration identity/intent recovers the original capture.                                          | Atomic captures are not mutable approval states. Unknown content remains explicit. Comparisons retain their selected before/after pair; refresh must not select a newer capture silently. Assessments and verification consume exact captures.                                                                                                           |
| Observation / receipt / review     | `src/application/evidence.ts`, `review-capture.ts`, `receipt-comparison.ts`, `reference-state.ts`, `src/interfaces/local-observer.ts`              | Explicit observation appends available/unknown content facts. Receipt captures exact inputs/outcome. Review binds an exact comparison token; accepting unknown inputs rejects.                                                                         | Evidence is append-only. Local file/Git observation is bounded, offline and explicit; there is no automatic fetch, polling job or retained-byte guarantee. Repeated equivalent observations do not imply changed content. Failure/unknown is not absence or acceptance.                                                                                  |
| API compatibility and session      | `src/client.ts`, `src/interfaces/api-compatibility.ts`, `api-capabilities.ts`                                                                      | Configured writes remain blocked until explicit capability discovery succeeds. Failed/newer checks invalidate readiness; an older successful response cannot restore it. Connect acquires a private session for one immutable project/server identity. | No transport retries. Read failures and unknown write outcomes are distinct API errors. CLI/HTTP reuse application transitions rather than implementing separate domain lifecycles.                                                                                                                                                                      |
| Browser mutation / recovery        | `ui/mutation-controller.ts`, `ui/use-mutation.ts`, `ui/reconcile-mutation.ts`, `ui/mutation-recovery.tsx`, `ui/workbench/native-client.ts`         | Idle → saving → committed/rejected/unknown. Saving and unknown synchronously block dependent writes. Unknown → successful reconciliation read → explicit acknowledgement → idle; superseded reads cannot authorize acknowledgement.                    | The retained attempt owns submitted inputs. Creation proposals must contain a captured native ID so history inspection can address the proposed object. Draft owners retain that identity across uncertainty; successful save or explicit draft discard starts a new proposal. Bounded reads never prove absence. Acknowledgement never replays a write. |
| Browser asynchronous reads         | `ui/use-read.ts`, `ui/use-projection.ts`, `ui/use-page-cursor.ts`                                                                                  | Idle/loading/ready/failed, scoped by request key and generation. Obsolete completions are suppressed. Pagination continuations belong to captured context.                                                                                             | Retained results explain failures but cannot grant write authority. Failed or partial reads cannot establish absent obligations. Controlled task drafts capture their own basis and require explicit adoption after drift.                                                                                                                               |
| Workspace / draft adoption         | `ui/workbench/workspace-session.ts`, `workspace-navigation.ts`, `recovery.ts`, `artifact-draft.ts`, `ui/native-task.tsx`                           | Explicit saved/refreshed/inspection adoption; retained pages are unvisited/active/hidden. Drafts have captured bases, dirty/stale status, explicit discard and confirmed-save cleanup.                                                                 | Browser recovery restores presentation context, not proposals or pending-write authority. Historical context is read-only. Record, schema, reference and engineering drafts keep feature-specific owners; they are not interchangeable state machines.                                                                                                   |
| CSV / schema / export preparation  | `ui/csv-import.tsx`, `ui/schema-draft.ts`, `ui/schema-draft-recovery.tsx`, `ui/schema-editor.tsx`, `ui/project-export.tsx`                         | CSV source/mapping → guarded preview → commit. Schema proposal can be dirty/invalid/stale; invalid text blocks representation changes. Export unprepared → preparing → prepared/failed.                                                                | Preview/save captures schema/project guards. Unknown writes use shared recovery. Prepared export is deliberately immutable rather than a live projection. Failed saves retain drafts; refreshing does not implicitly revise their bases.                                                                                                                 |
| Host shutdown                      | `src/interfaces/local-server.ts`, `src/interfaces/serve.ts`                                                                                        | Listening → closing → closed. The first close call owns one shared completion promise. Stop accepting sockets, drain HTTP connections **and active handlers**, then permit repository closure.                                                         | Client disconnect/abort does not cancel an application command or prove rollback. Handler completion, including rejection, is independent of socket lifetime. Idle browser preconnections are destroyed; already-entered work drains normally. Shutdown must not impose a speculative command cancellation/retry.                                        |

Applicability, freshness, discovery completeness and current release/readiness
projections are derived judgments, not separately writable lifecycle statuses.
Search/filter selections, expanded sections, camera positions and notices are
ordinary local presentation state. Do not add lifecycle abstractions for them.

## Decisions and invariants

- **Keep existing owners.** Reuse typed commands, parsers, captured drafts,
  generation guards and transactional ports. A library or central transition
  framework would duplicate these authorities without fixing the observed gaps.
- **Discriminators must be literal strings.** Assessment action kind/state,
  support kind/mode, candidate kind and parsed disposition decision/applicability
  reject coercible JSON lookalikes such as `["done"]`. Validation must not accept
  a value that later misses strict-equality transition guards. The same parser
  protects incoming commands and persisted/read projections; malformed historical
  data must fail closed, never be silently normalized into approval.
- **Identity precedes sending.** Connection and reference draft owners allocate
  the relationship UUID before submission. The mutation controller retains the
  exact attempt; reconciliation uses that identity without another POST.
- **Shutdown owns logical work, not just transport.** A disconnected request can
  still commit. Host cleanup waits for its handler before closing storage.
- **Scroll restoration follows the actual owner.** The trace Matrix's
  `.matrix-scroll` owns table scrolling; the surrounding `.view` offset survives
  same-perspective DOM replacement through `prepareWorkspaceRender`, without a
  new persisted state field. The trace wrapper must not add another scroll owner.
  Documentation retains its own `.native-task-body` position while other retained
  tasks use that shared scroller; closed/hidden readers cannot adopt their scroll.
- **No storage migration or public-contract expansion.** These corrections use
  existing allowed IDs, parsers and lifecycle boundaries. They add no dependency,
  persisted state flag, background job or duplicate source of truth.

## Focused verification owners

| Boundary                                                                             | Executable checks                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomicity, concurrency, expired handles and recovery ledgers                         | `test/repository-contract.ts`, `repository-evidence-contract.ts`, `sqlite-concurrency.test.ts`, `changeset-outcomes.test.ts`, `evaluation-command.test.ts` |
| Controlled assessment transitions, malformed discriminators and rejected-write reuse | `test/assessment-discriminators.test.ts`, `assessment-actions.test.ts`, `assessment-lifecycle.test.ts`, `assessment-lifecycle-interfaces.test.ts`          |
| Verification, captures, evidence and references                                      | `test/verification-lifecycle.test.ts`, `configuration-capture.test.ts`, `reference-primitives.test.ts`, `evidence.test.ts`                                 |
| Unknown creation response, stable proposal identity, inspection and no replay        | `test/reference-draft.test.ts`, `creation-recovery-browser.spec.ts`                                                                                        |
| Host cleanup, disconnected success/failure, idempotent close and launcher ownership  | `test/local-server-shutdown.test.ts`, `headless-launcher.test.ts`                                                                                          |
| UI read/mutation authority, navigation and browser restoration                       | `test/ui-constraints.test.ts`, `workbench-navigation.test.ts`, `test/map/workbench-recovery.test.mjs`, feature browser specs                               |

Exact Matrix geometry/scroll restoration is covered by
`test/workbench/verify-workbench.mjs`; documentation position, navigation and
retained authoring are covered by `test/documentation-browser.spec.ts`.

See the [checkpoint](../../checkpoint.md) for candidate-specific results and gaps;
the presence of a test here is not a claim that its latest run passed.

## Remaining review checkpoints

These are audit findings to qualify before further implementation, not an
approved migration or rewrite backlog:

1. **Workspace refresh publication/adoption ordering.**
   `ui/workbench/app.js:refreshAssessmentWorkspace` checks mutation authority before
   awaiting the reload, without rechecking it before adoption. The bounded loader
   now checks the native clock and its request generation after reading both the
   window and saved views. That guards superseded loads, not a mutation starting
   during refresh. Qualify mutation authority at publication and adoption together.
2. **Restored latest context versus pinned investigations.**
   `ui/workbench/recovery.ts` can advance a formerly latest `revision` while retaining
   the old selected `event`. Its existing tests also retain pinned investigation
   context. Specify ordinary latest-following versus pinned behavior before
   changing navigation/history semantics.
3. **Focus return scope.** `workspace-navigation.ts` supports
   `focusReturn.baseScope`, but normal capture sites omit it. Qualify a real
   capture → focus/investigate → return test with expanded neighbors; decide whether
   expansion ownership must be restored as well as visible membership.
4. **Legacy malformed records.** Strict parsing deliberately refuses malformed
   lifecycle discriminators. No production-database prevalence scan or automatic
   data repair is authorized. If encountered, inspect original command/evidence
   and define an explicit recovery procedure; do not rewrite immutable history.

This map covers application boundary owners and representative end-to-end paths,
not an exhaustive proof of every interleaving or component. Authenticated hosting,
other database adapters, external-provider jobs and cross-device draft recovery
are not implemented workflows and gain no guarantees from this audit.
