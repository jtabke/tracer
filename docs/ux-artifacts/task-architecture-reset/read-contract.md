# Contribution-context read feasibility

**Status: historical feasibility audit with a subsequently selected native read slice.** The owner authorized the working-context contract and two task specifications after the model cleanups. The implemented [working-context contract](../../architecture.md#consistent-working-context-read) and [selected tasks](../../ux-plan.md#history-and-assessment) now own its exact scope and limits. This does not select the rejected Alternative A composition or claim a mounted UI replacement.

The native slice uses explicit request recipes, distinct row pages, up to four routes/four steps, independently paged traces and a focus-plus-loaded-rows receipt union. It selects one deterministic path per identity rather than enumerating every path. Full receipt comparison is bounded separately; an unloaded comparison is explicitly unavailable. Existing saved Family/Chain definitions are unchanged. A richer durable recipe editor and mounted task adapter remain follow-up work.

The remainder records the **preimplementation audit and candidate requirements**, including constraints broader than this selected slice. Its future-tense gaps describe that historical source state; use the architecture contract for current behavior. The original Orbit study alone was insufficient evidence of cross-industry feasibility.

## What the fixture reads actually prove

The [isolated read audit](cross-industry-read-audit.json) was generated from three fresh seeds using the current service/repository APIs. Each read sequence checked that native head remained unchanged, then closed and removed its owned fixture. It used explicitly supplied native routes; it did not infer them from type names or permission definitions. The JSON records actual result outcomes, full comparison state, focused-input state and whether the row/definition/focus was declared. It is an audit of fixed fixtures, not a consistent new projection or human usability evidence.

| Fixture    | Family focus / rows                                               | Unique reached check identities | Receipts directly on checks | Unique result outputs reached by the explicit route         |
| ---------- | ----------------------------------------------------------------- | ------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Orbit      | DES-01 / five requirements, incoming `realized_by`                | 4                               | 3                           | 3, directly on EVAL-R01/02/03                               |
| Aster      | CMP-05 / three subsystem requirements, incoming `decomposes_into` | 2                               | 0                           | 2, through `verified_by → executed_as` to RUN-05/06         |
| Gatherline | WORK-03 / four stories, incoming `implemented_by`                 | 5                               | 0                           | 3, through `checked_by → exercised_as` to RUN-TECH-01/02/04 |

Shared checks and receipts appear in several rows; row appearances are not global unique counts. Aster's two results do not declare CMP-05 as an input, but they still exist and their outcomes remain relevant recorded context. Gatherline RUN-TECH-02 declares WORK-03 with a **current** focused comparison while its **full** comparison is changed because another declared input changed. A root-only badge would conceal that difference. RUN-TECH-01 is also changed but does not declare WORK-03. These cases contradict both direct-check-output lookup and focus-dependency-only filtering as generic discovery contracts.

## Explicit presentation scope

The candidate request needs a focus identity, one row relationship/direction/endpoint population, and explicitly selected context and result routes. Each ordered step identifies a native relationship, direction and endpoint type. A terminal output can be reached in one step, as in Orbit, or after an intermediate definition/run connection, as in Aster/Gatherline. Separate named routes retain separate purposes, including verification versus validation.

No relationship permission or workflow diagram automatically supplies this scope. No baseline is required to compare a receipt's declared inputs with current records. A baseline would support a different investigation. No new engineering-question object, policy, readiness calculation or inferred result association is needed.

Existing FamilyView/ChainView definitions remain readable unchanged. Any additional saved contribution recipe belongs to presentation metadata; its name is authored, its data reads are current, and it does not persist mutable page cursors, selections, scroll or review drafts. The candidate interaction contract owns how the user chooses and revisits the scope.

## Existing owners and required changes

| Owner                                            | Reuse                                                                                                                        | Change required if selected                                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `familyWorkspace`                                | Root/schema/current identity, explicit incoming/outgoing semantics, shared identity                                          | Do not reuse its partial incident census as complete branch discovery. Filter each recorded route step before paging/counting; retain exact path/link identity.                                   |
| Native indexed endpoint reads                    | Current relationship snapshots and endpoint guards                                                                           | Add explicit route-step pages/counts. Missing active endpoints fail integrity checks; no inferred empty branch.                                                                                   |
| Output-scoped evidence index                     | All immutable receipts whose output is a reached terminal identity                                                           | Add exact availability counts and bounded per-output summaries; the current evidence API has no exact total or snapshot envelope.                                                                 |
| Reverse receipt-dependency index                 | Explicit captured terminal input/link discovery                                                                              | Use for dependency counts/flags where helpful, not as a substitute for all output receipts. Intermediate native reachability is not a declaration. Receipt JSON remains capture authority.        |
| `compareCapturedInputs` and `comparisonToken`    | Scoped fields, historical/configuration captures, native/path drift, observation unknowns, independent changed/unknown facts | Compose full versus focused summaries through one comparison owner. Current review applicability and supersession ownership need a shared transaction helper rather than a copied interpretation. |
| Latest evidence and bounded supersession queries | Append-ordered latest reviews/observations and exact superseding counts with bounded IDs                                     | Preserve current applicability semantics and all immutable receipt identities. Do not attach an unbounded superseding-ID array to every row.                                                      |
| Typed service/local API/CLI boundaries           | Call-time input snapshots, validation, result decoding, public parity                                                        | Add a concrete projection through existing boundaries, not a generic query framework or client-side join of independently changing reads.                                                         |

## Response truth and pagination

One response runs in one repository transaction and returns its exact data scope plus native head, schema version and evidence sequence. Each row retains canonical identity and recorded membership connections. A shared definition/output/receipt has one identity even when displayed through several rows or paths.

Each route branch distinguishes:

- no first recorded connection after a complete read;
- an intermediate definition with no terminal connection;
- a terminal output with no immutable receipt;
- a terminal output with one or several exact receipts;
- unsupported scope, incomplete branch or failed read.

Receipt summaries retain immutable ID/output revision/outcome, availability counts, full declared-input comparison, separately scoped focus/row declaration facts, current review applicability and explicit supersession. Current input comparison means the **declared scope matches**, not necessarily identical native versions. Changed/unknown flags can overlap. A receipt outside the focus dependency scope remains an existing result. It is not a no-result state or evidence that the row criterion was captured.

Initial row, branch and receipt samples need separate continuations. Each continuation binds the whole recipe/filter, page kind and owning row/route/output, native head, schema version and evidence sequence. A continuation from another parent/scope rejects; a later native or evidence append conflicts and requires refresh. Do not merge response fragments from different contexts. Validate malformed envelopes before reporting stale context.

The existing receipt comparison token remains the write guard for judgment. It is not the board cursor: unrelated evidence appends can invalidate a read page while leaving an exact receipt's scoped judgment token unchanged. Returning to a board or another origin preserves the same review draft, while an explicit same-receipt open updates the active navigation frame.

Summary counts must state their population: whole filtered branch/output, loaded page, or board-wide distinct identities. No default receipt ordering selects technical validity. A “captured this focus” filter retains the unmatched count and a route to those records. Historical receipts remain discoverable through their indexed output identity/exact receipt ID even if the current native output has been removed; current route absence must not erase immutable history.

## Bounds and implementation gate

The existing Family default12/max20 membership-edge page is not automatically a distinct-row page. Its 200 incident-link budget cannot establish all selected branches. A new response needs distinct row, path/link, terminal-output, receipt-card and comparison-work bounds with exact total/continuation or explicit unavailable-summary states. The current Impact max25 receipts/200 declared inputs is a useful comparison-work precedent, not a selected budget for this feature.

Do not remove a bound to obtain a prettier board. A large captured result can remain counted and directly inspectable even if its summary cannot be computed in the initial page; say comparison is not loaded rather than call it unknown or absent. A SQL/read error stays an error. Response cardinality limits do not establish fixed bytes, latency or concurrency capacity.

Before implementation, settle these bounds and the concrete typed query/response with the selected interaction contract. Storage checks must compare every paged union with an isolated complete oracle and show endpoint/output/dependency indexes before LIMIT, without deserializing unrelated receipt payloads. The [QA checklist](read-contract-qa.md) owns the required cases. Then implement the complete create/connect/exact-review/return journey; the study's wired read states do not establish those capabilities.
