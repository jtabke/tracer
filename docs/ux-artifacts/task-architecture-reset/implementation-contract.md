# Alternative A prospective interaction contract

**Status: historical prospective contract; presentation rejected by the owner.** This document records the capability and data distinctions explored for Alternative A, not an approved composition or implementation. It does not supersede current production contracts or authorize product-source change. The browser-memory studies prove particular mechanics, not visual usefulness, native persistence or guards. Reuse established native semantics without carrying the rejected question-led page structure into replacement design.

This proposal is grounded in the [complete-task contract](../studio-design-first/complete-task-contract.md), the earlier [studio implementation contract](../studio-design-first/implementation-contract.md), the [native architecture](../../architecture.md), and the Aster, Gatherline and Orbit fixtures. Those sources preserve actual authoring, connection, evidence, history and recovery semantics. Fixture tasks and proxy review remain simulated evidence.

## Selection challenge

**The literal Orbit board does not generalize.** Orbit's `evaluated_by` endpoint is itself a receipt output. Aster and Gatherline instead connect a requirement/story or contribution to a definition and then to a run that owns the receipt. Looking up receipts on the first linked definition would incorrectly report existing evidence as absent.

| Context          | A valid explicit scope                                                                                              | Result route that must remain project-authored                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orbit            | `DES-01 ← realized_by — requirement` rows                                                                           | `requirement → evaluated_by → evaluation`; the evaluation is the receipt output                                                                                 |
| Aster            | `PRS-02 → decomposes_into → subsystem requirement` rows, or `CMP-05 ← decomposes_into — subsystem requirement` rows | `verified_by → verification protocol → executed_as → verification run`; `validated_by` is a different authored purpose and must not be merged into verification |
| Gatherline       | `STORY-03 → implemented_by → work` rows, or `WORK-03 ← implemented_by — story` rows                                 | `checked_by → test scenario → exercised_as → test run`; a work record or invented artifact path is not imported code or proof of implementation                 |
| Ordinary project | A neutral item and one selected native relationship/direction                                                       | No result route until the user chooses one from the actual model                                                                                                |

Alternative A is viable only as a **scope-first contribution context**, not as a fixed obligation/design/evaluation template. Rows may be requirements, stories, components, contracts, providers, consumers or any other project type. The interface uses readable project type and relationship names and never relabels every row as an obligation or every link as a contribution.

If a bounded explicit result route, real create/connect stages and the state distinctions below cannot be delivered, Alternative A should be rejected for production rather than reduced to the Orbit study.

## Saved contribution context

A contribution context is presentation metadata, not an engineering record, completeness policy or change assessment. Its persisted definition retains only:

- a user-authored name; an unsaved context uses a neutral title such as “Related work for PRS-02,” never an invented change question;
- one focus identity;
- one row relationship, direction and endpoint type;
- zero or more explicitly selected context routes, each naming exact relationship types, endpoint types and directions;
- zero or more optional named ordered result routes from each row to terminal receipt-output identities;
- Compare or Map as the initial lens.

The saved definition and the mounted session have different owners:

| Persisted contribution definition                                                                      | Mounted in-session navigation                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, `focusId`, row relationship/type/direction, explicit context and result routes, and initial lens | Native/schema/evidence revisions currently read; selected row; loaded pages and cursors; lens changes; horizontal/vertical scroll; visible trigger; open receipt and its active return frame; retained item, connection and review drafts |

Reopening a saved contribution context starts deterministically at its focus with the initial lens, no selected row and fresh bounded reads. It does not restore page cursors, scroll, an open receipt or dirty drafts from an earlier session. A currently mounted context can preserve those ephemeral states while the user performs a task or visits a catalogue.

Incoming scope remains incoming. For example, `SYS-07 → decomposes_into → CMP-05` must not be redrawn or described as CMP-05 creating a child. Development-flow layout may read left to right, but precise copy and the connection proposal show the stored source, relationship and target.

Routes use current schema relationships and the user's presentation choices. They do not require a new engineering-question record or model-policy feature. Model workflow metadata may help a user understand available paths, but it never becomes a mandatory/default result route. The interface does not infer verification from a type name, choose a shortest path, merge `verified_by` with `validated_by`, or derive relevance from an industry preset. A route invalidated by a later schema change remains visible as unsupported and editable; it is never silently replaced.

The board may claim complete absence only from a complete bounded response. Otherwise it says what is loaded, exposes continuation, and keeps off-page, unsupported and failed states distinct. The existing Family read cannot establish this result: it pages at 20 membership edges, deduplicates member identities, and shares at most 200 untyped incident links across loaded members. Production A therefore needs a consistent filtered projection over recorded row/context/result routes, with branch counts/pages, terminal-output availability and bounded receipt summaries. Its continuation must guard the native head/schema and the independent evidence append clock. Those read guards remain distinct from the exact receipt comparison token used for judgment. The server/repository shape is owned by the accompanying technical audit; the client must not join incidental or partial pages and label them complete.

## Read, author and connect

The board opens with the focus statement, selected row meaning, bounds and native direction. Zero, one and many rows use the same structure:

- **Zero rows after a complete read:** say “No recorded `[relationship]` connections in this scope” and offer valid create/connect actions. Do not call the project empty.
- **No chosen row relationship:** retain the focus item and ask the user to choose a relationship/direction. Do not display a result absence.
- **Partial or failed read:** retain known rows and selection, disclose the boundary or failure, pause affected writes, and offer retry/continuation.
- **One or many rows:** preserve full statements, shared identity and repeated paths without implying one-to-one ownership.

Primary actions use project terms derived from the actual endpoint types: for example, **Create subsystem requirement**, **Connect existing test scenario**, or the generic **Create related item** when several types are valid. “Define check” is acceptable only when it is the readable name of a configured native route. “Record result” appears only after an actual terminal output identity is selected; creating a definition or link does not imply execution.

Action ownership follows the identity that supplies its context. The focus header owns the primary row actions: **Create `[row type]`** and **Connect existing `[row type]`** create or select a row and then propose the configured row connection. A row owns actions for the next explicit context or result-route target, such as **Create verification protocol** or **Connect existing test scenario**. It does not create another primary row. For an incoming scope, the focus-header proposal preserves the stored direction: `new row → [relationship] → focus`. The button label, task heading and connection review all name that direction; an incoming relationship is never presented as the focus creating a child.

Create/edit is a primary task stage rather than a form below the rows. It keeps the focus statement and sibling identities as read-only context, uses the captured native schema, and has one Save/Cancel owner. A rejected object/schema conflict retains the attempted fields and captured base. A failed read pauses saving. An unknown write outcome retains the exact command, requires authoritative reconciliation and never retries automatically.

Creation and connection remain two deliberate saves:

1. Create the new identity with its native fields.
2. Show “Saved without connections,” then review an exact source → relationship → target proposal or leave it unlinked.

Leaving a saved item unlinked finishes the authoring task. The saved identity and all native fields remain accessible for optional later connection, while independent create/connect work can begin in the same or another scope. A saved record is not a dirty draft and must not require connection, deletion or discard to release the task owner. Resuming a connection names and restores its captured origin explicitly; it never silently changes another scope's Create action into a resume action. Only incompatible editable drafts require deliberate discard. Study session identities are not allocated project keys.

The relation stage lists only compatible native endpoint options, prioritizes the configured scope route without auto-selecting a different meaning, and shows required relationship fields. For inverse scopes it proposes the correct stored direction. Existing-candidate search covers the whole project with type, key/content search and pagination; candidate selection reveals the full statement and incident context before **Record connection**. Choosing a candidate is not saving. Duplicate/version guards remain authoritative.

Each editable task has one mounted owner and one retained draft: the item stage owns item fields, the connection stage owns the exact link proposal and the receipt-review stage owns judgment and rationale. Board, Map, Find and catalogue representations link back to those owners rather than copying their draft state. A conflict retains the attempted values and captured base in that same owner. A paused or failed read keeps the draft visible but disables the affected save until authoritative reconciliation. Switching to an incompatible item, link or receipt draft requires deliberate discard.

Entering an item or connection task moves focus to its new task heading. Returning to the board restores the exact focus, selected row, lens, horizontal/vertical position and originating visible control. A paused item or link draft has an explicit **Return to draft** entry. If refresh or paging removed the originating row or control, return to the context heading, explain that the origin is no longer in the current read, and retain the draft and selection identity for reconciliation.

## Result route and row states

Each result route is an ordered native route whose terminal identity is the receipt output. Intermediate definitions and terminal outputs remain separate records, and separately named routes such as verification and validation remain separate. For every reached output, show all exact receipts and their immutable outcomes; never choose the newest, current, passing or reviewed receipt as authoritative.

| Recorded state                               | Required presentation and action                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No result route configured                   | “No result route is configured for this context.” Offer route settings; make no claim about project evidence.                                                                                                                                                                               |
| Saved route unsupported by the current model | Name the broken step and retain the saved recipe. Offer edit/remove; do not fall back to a guessed route.                                                                                                                                                                                   |
| No first route link after a complete read    | “No recorded `[relationship]` from this row.” Offer a compatible create/connect action.                                                                                                                                                                                                     |
| Definition reached, no terminal output link  | Name the definition and say no recorded terminal `[relationship]` exists. This is not “no receipt.”                                                                                                                                                                                         |
| Terminal output exists, no receipt           | Show the output record and “No immutable receipt recorded for this output.” Do not treat fields on the output as a captured receipt.                                                                                                                                                        |
| One receipt                                  | Show exact identity/time, immutable outcome, complete input-state counts, review state, supersession state and whether the focus and row were declared inputs.                                                                                                                              |
| Multiple receipts                            | Show the count and every exact receipt through paging. Preserve separate outcomes, captures and judgments; require explicit selection.                                                                                                                                                      |
| Receipt is superseded                        | Keep it inspectable and label the exact superseding count/identities. Supersession is explicit lineage, not an inference that a later timestamp is better.                                                                                                                                  |
| Receipt excludes the focus or row            | Keep it as unmatched context: “Result exists; `[focus/row]` was not a declared input.” Never hide it and produce an apparent no-result state.                                                                                                                                               |
| Input current                                | Say the declared input state matches within its recorded comparison scope. Display recorded/current versions or observation hashes separately; matching scoped content does not require identical native revisions. This does not make the outcome pass or establish technical sufficiency. |
| Input changed                                | Name the exact differing recorded fact—selected field, relationship/path, historical or configuration pin, or observed-content hash—and show versions/hashes when available. The immutable outcome has not changed.                                                                         |
| Input unknown or changed-and-unknown         | Retain captured content, name unavailable current facts and show both known change and uncertainty. Do not synthesize empty content.                                                                                                                                                        |
| Outcome records failure                      | Lead with that immutable outcome; show freshness and review separately. Current inputs do not turn a failed outcome into success.                                                                                                                                                           |
| Route or receipt read fails                  | Retain last-known same-identity content with a non-current notice, pause judgment and offer retry. Failure is not absence.                                                                                                                                                                  |
| Page or per-row connection set is incomplete | Show loaded/total or continuation information and suppress complete-absence language until the bounded read completes.                                                                                                                                                                      |

Status fields and full project-owned fields remain inspectable. A Gatherline `planned` or `partial` work record must not be promoted to current implementation merely because `implemented_by` exists. Medical verification and validation remain separate routes even when both eventually have receipts.

## Exact receipt judgment and return

Opening a receipt replaces the board with the canonical full receipt-review stage; there is no inline row-level or bulk judgment. The stage presents, in order:

1. exact result identity, immutable outcome and optional captured configuration;
2. changed/unknown/matching totals and explicit supersession/review state;
3. the selected captured-versus-current difference;
4. the complete compact declared-input list;
5. an explicit **Review receipt** action and then an initially unselected decision plus required rationale.

The notice separately states whether the originating focus and row are declared inputs. A receipt can still be reviewed as exact unmatched context, but the review applies to that disclosed receipt comparison, not to the board, relationship, definition or product.

Use the existing guarded review behavior: pin the receipt/comparison token; block submission after relevant drift until the reviewer explicitly adopts the refreshed comparison; retain rationale on conflict or failed refresh; block “evidence still applicable” while current facts are unknown; and prevent switching receipt identities while a dirty review draft is owned elsewhere. Recording a review appends judgment without changing the receipt or outcome.

There is one review owner per exact receipt identity in the mounted session. Opening the same receipt from another row, contribution context or catalogue reuses its retained draft instead of creating a second one. The stage discloses the draft's earlier origin when useful and updates only the ephemeral active return frame to the most recent launch point. Opening a different receipt while the current review is dirty remains blocked until the user records or deliberately discards it. Returning only pauses the dirty draft and retains that block.

**Return to `[context name]`** restores the active return frame's exact focus, row, lens, horizontal/vertical position and visible trigger. Focus first moves to the restored trigger. If refresh or paging removed that trigger, focus moves to the context heading and a notice explains that the prior origin is no longer visible. If the review draft is paused, the board shows **Return to review draft**; it does not pretend the draft was saved or discarded. A receipt opened from Evaluations returns to that catalogue through the same mounted review owner and the same fallback rule.

## New and empty projects

- With no model, Project routes to model setup; the board invents no generic requirement hierarchy.
- With a model and no items, global Find says the project is empty and offers **New item**. “No matches” under a filter remains different from an empty project.
- With a first item and no relationship, the neutral item context offers Edit, Connect existing and Create related item based on actual model permissions. Saving a context is optional.
- Prepared examples may offer named contribution contexts. Ordinary projects receive no automatic medical/software route, readiness rule or rhetorical change framing.

This preserves a credible first-child path and allows a saved context to organize ordinary new-design authoring independently of any change.

## Find, queries and catalogues

Alternative A does not remove supported ways to find or inspect information:

- **Find** opens the bounded Work library with cross-page key/content search, type filter, truthful counts and pagination. Board scope and drafts remain mounted with a named return.
- **Change scope / Queries** exposes current Family, Trace, Graph and Matrix questions. Advanced queries preserve their authored bounds, native directions and historical revision locks. Map is a lens over the retained contribution context; it is not a substitute for arbitrary graph/trace queries.
- **Evaluations** remains the complete receipt catalogue, including results outside the board route, unmatched receipts and exact historical receipts whose output has since been removed from the current native graph. Direct exact-ID access resolves through immutable evidence identity rather than requiring a current output. Any broader receipt search is a new indexed, bounded query with explicit stable metadata filters, counts and pagination; the present subject/sequence evidence page is insufficient, and implementation must not scan or deserialize unrelated captures. The catalogue opens the same canonical review owner.
- **Configurations** retains exact native captures and pins. Ordinary manifest/membership links do not become evidence dependencies.
- **Model** remains the authority for types, fields and endpoint permissions. Authored workflow metadata remains explanatory and does not auto-configure result routes.

Contextual candidate search stays inside create/connect. Global Find is available before authoring so users can deliberately reuse an existing record instead of creating a duplicate.

## Existing saved-view compatibility

Existing `family` and `chain` saved views remain valid, versioned and open with their present query and layout semantics. They are not rewritten when opened and are not silently interpreted as result routes.

If Alternative A is selected, saving a contribution context uses an additive presentation definition. **Save as contribution context** may copy a compatible focus/row scope from an existing family view, but the user must name any result route and save a new view. The original family/chain view remains unchanged. Stale model references show the existing saved recipe and a repair path; they are never deleted or coerced to a current relationship.

Saved-context creates, updates and deletion retain current schema/version guards, name uniqueness, unknown-outcome reconciliation and the rule that presentation metadata creates no engineering history.

## Verification gate if selected

Before production acceptance, exercise real writes and reloads in isolated fixtures:

1. Aster: zero/one/many child allocation, inverse shared `CMP-05` scope, explicit verification-run route, and a separate validation route.
2. Gatherline: existing/new work and test candidates, planned/partial status visibility, scenario-to-run route, and a run with no receipt.
3. Ordinary empty project: no model, no items, first item, unlinked created item and first recorded connection.
4. Evidence: no route, broken route, no link, no terminal output, output/no receipt, multiple, superseded, unmatched, unknown, failed outcome, failed read and paged results.
5. Guarded review: direct open, same receipt from two origins reusing one draft and the latest active return frame, dirty different-receipt blocking, stale token adoption, rejected/unknown write recovery, exact board/catalogue return and heading fallback after the origin disappears.
6. Saved context: persisted route recipe reloads at the root with its initial lens and fresh reads; selection, cursors, scroll, open receipt and dirty drafts do not reappear after a new session.
7. Historical access: an exact immutable receipt remains reachable and reviewable after its native output is removed from the current graph.
8. Compatibility: every existing family layout and chain view still opens without mutation; explicit conversion creates a separate context.

Technical checks and proxy review do not select the composition. Owner selection of Alternative A remains required before implementation.
