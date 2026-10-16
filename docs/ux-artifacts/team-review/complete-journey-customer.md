# Complete journeys study: engineering customer review

Status: independent simulated customer-role review, October 13, 2026. Initial build served on port 4352, inspected around 21:11–21:15 UTC with Playwright CLI `tracer-complete-customer`, 1440 × 1000. This is a fixture rehearsal, not human validation or owner acceptance. No native app/database writes. Preview drafts and search were exercised; only this isolated browser's preview storage was cleared to recover from blocked draft controls.

**Current follow-up:** The final revised study was independently rechecked around 21:26 UTC (parent-identified fragment hash `8f25a302346127209d3b7ff5189656a041056804586f5c0559c52d2192ca1a52`). All three create/connect journeys now completed in isolated preview storage. Initial blockers below are historical and resolved in these retested paths. See the final follow-up section for remaining design concerns; this does not establish owner acceptance.

## Task outcomes

| Task                                                                                               | Observed result                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aster: create missing Stop-switch component requirement in SYS-07 context, then explicitly connect | Blocked. Title/statement authoring and representation switching exposed draft/save/cancel failures before creation or connection could complete.                                                                         |
| Gatherline: define the missing privacy test under STORY-12 using existing WORK-10                  | Relevant parent/capability/decision/implementation context and test-scenario default were visible. Full creation was not validated because the same authoring controls were blocked in the Aster task.                   |
| Orbit: reuse EVAL-R04 for proposed DES-09 scope without changing its old capture                   | Existing-target search found the actual evaluation; choosing it did not open a candidate/connection preview, so recording/reuse and capture preservation could not be validated.                                         |
| Aster: review pressure-range change through actual protocol/run and return to scope                | Read path worked: PRS-02 → VER-01 → RUN-01 → captured result. Correct old/current range, exact build and changed/matching distinctions appeared. Review kept evidence present. Return affordance named the origin scope. |
| Model: understand actual project inputs/outputs                                                    | Medical verification focus uses actual vocabulary and correct requirement/design inputs. Full visual process/configuration journey is not present on this surface.                                                       |

## Critical functional blockers in the inspected build

1. **Draft statement/save failure.** I opened Create in scope from SYS-07, used the actual omitted seed CMP-06 statement and title, switched to Graph, then chose Create item. The statement became blank while the title remained, and validation required a title/statement. Refilling the statement and tabbing before Create still left the validation state and did not create the item.
2. **Cancel did not provide recovery.** Clicking Cancel and choosing another example left the authoring draft retained and warned to save or cancel first. Reload restored that blocked draft. I had to clear only my isolated preview browser storage to continue other tasks.
3. **Existing candidate could not be chosen.** DES-09 → Connect → evaluated_by → search EVAL-R04 successfully showed the actual evaluation. Clicking Choose EVAL-R04 left the search list and no selected candidate, source/target review or save action. The broader draft guard may have blocked an internal authoring step.

These were reported immediately to the parent/QA. They are historical findings for this build, not claims about a subsequently fixed build. They prevent declaring the complete create/connect journeys tested.

## Design findings before local polish

**Primary job is still under-specified on the first Aster screen.** “Stop-input allocation” opens SYS-07 beside parent PRS-07, valve CMP-05, state machine OUT-06 and protocol VER-06. That is useful engineering context. It does not explain that the rehearsal asks me to specify the missing Stop-switch allocation; the CMP-06 omission is mainly in the footer. A task-oriented scope title/question should make the starting job apparent without inventing an automatic completeness finding. Show a human-authored task prompt separately from actual record statements.

**Create context suggests a relationship that is not yet recorded.** The form says “Under SYS-07” or “Under STORY-12,” but the intended journey creates an item and then explicitly proposes a connection. Use “In context of…” until a named connection is reviewed. After successful creation, show the proposed source/relationship/target step, rather than let the customer mistake a newly created unlinked identity for a completed child allocation.

**The working inspector is hard to reach.** In the default table composition, five rows of full statements consume most of the initial viewport and the inspector starts below them. Clicking Create opens its form below the working representation, without bringing authoring clearly into view. Parent context is useful; a form disappearing beneath it is not. Decide a deliberate read→author composition, keeping parent/siblings as context while giving the draft a visible primary area. Avoid solving this only by an automatic scroll into the same tall layout.

**Expanded scope needs purposeful relationship structure.** PRS-02 at depth 2 returns 43 items / 89 connections, reaching DHF, risk and configuration hubs. Trace groups items by type with full paragraphs and concatenated incident-link strings. It is a type-column register, not an evident requirement→subsystem→design→protocol→run route. The customer has to browse a wide collection before understanding the range change. Let a working scope specify relevant relationship paths or an explicit review-subject set, with broader references still available. Do not force a fixed medical tree, silently hide shared work or call shortest connectivity a full engineering trace.

**Five view buttons are visible but their distinct jobs need definition.** Graph, Table, Trace, Reading and Matrix are useful possible representations. The design needs to make their differences concrete—particularly Table versus type columns called Trace—rather than ask the user to discover the correct representation by trial. Keep the selected scope/identity contract across them.

**Captured result semantics are substantially clearer.** RUN-01 comparison shows captured PRS-02 v1 at 15–35 °C versus current v2 at 10–40 °C, baseline build, one changed input and matching inputs. Review now keeps comparison visible instead of replacing it with a bare decision form. However six full-width input rows precede the actual changed statement, putting the key before/after comparison low in the viewport. A compact input selector beside the comparison, or changed input first with matching inputs summarized, would put the engineering question first.

**The Model surface is a focused definition read, not the requested visual workflow.** Actual medical types and two-input verification semantics are correct. Three columns of cards with input/output headings show no connected paths, overview/loops or Configure entry. Since the separate full-process/editor study owns that exploration, provide an explicit route to it or clearly label this as the focused read state. Do not claim this alone resolves the full Model/Configure journey.

## Next acceptance walkthrough after blockers are fixed

- Complete CMP-06 creation, then explicitly review the named SYS-07 connection. Confirm CMP-05 remains a shared existing identity and the new item is not assumed tested by its mere presence.
- Complete a privacy test scenario, with candidate search before authoring, explicit STORY-12/WORK-10 scope, no executed outcome and a return to the unchanged origin.
- Select and inspect EVAL-R04, record only a proposed DES-09 scope link, and demonstrate that the old captured build/input set remains unchanged.
- Exercise error recovery, Cancel and representation switching with actual drafts—not merely empty forms.
- Read the expanded change trace and reach its changed capture without losing the engineering question among document/reference hubs.
- Show an explicit transition from focused Model inspection into the full visual process/configuration study.

The rehearsal contains much better real engineering material than the earlier prepared five-item example. Complete task validation remains blocked in the inspected build; attractive screenshots or visible buttons must not substitute for successful authoring and review.

## Final revised-study follow-up

This follow-up supersedes the initial task-outcome table for the retested paths. I started from clean storage in my isolated customer session and made only local preview records/connections.

**Aster completed.** I first attempted the existing human key CMP-05. The study rejected creation, retained the entered title/statement and allowed Cancel. I then authored the real omitted CMP-06 Stop-switch requirement, returned to the SYS-07 scope, switched to Graph, returned to the draft and confirmed its content remained. Creation saved the identity and opened an explicit SYS-07 v1 `decomposes_into` CMP-06 v1 proposal. Recording its scope returned to work with the new connection; CMP-05 remained separate existing context. No verification or successful run was inferred.

The human-key check is a study authoring convenience to avoid accidental duplicate records, not a claim that native human labels are canonical identity or universally unique. An intermediate build allowed two distinct identities both labelled TEST-01; final study recovery was tested against CMP-05 and created no second record.

**Gatherline completed.** I created one TEST-PREVIEW-11 planned privacy scenario from STORY-12, with no run/outcome. The explicit `checked_by` link from STORY-12 was recorded after giving its scope. I selected existing WORK-10, found the newly created scenario and linked the same identity via `checked_by`. The result covered story criteria and implementation-under-test context without duplicating the test. The inspector explicitly said a definition is not an executed result. An empty connection scope was rejected; filling it allowed recording and preserved the candidate.

**Orbit completed.** DES-09 → Connect → evaluated_by → search EVAL-R04 → Choose opened the actual existing evaluation and connection proposal. I recorded a proposed planning-scope extension, explicitly excluding any claim of option-B execution. Inspect captured result still showed baseline BUILD-R01 and the same five declared inputs: REQ-R06, IF-01, DES-04, DES-05, BUILD-R01. It explicitly stated “DES-09 is not a declared input of this result.” The old result and capture were not replaced by the new ordinary link.

**Revised composition is materially better.** Authoring has primary content with parent/sibling context beside it, compact type/key and short metadata fields, and one Create/Cancel area. Parent context now says In context of and explains separate connection review. Link endpoints show plain versions without capture/write-guard jargon. Changed-result comparison has a compact input selector beside the before/after statements, so the actual changed range is readable immediately. Trace now presents a meaningful forward relationship recipe across allocation, shared outputs, protocols and runs, with alternate criteria recipe available. Repeated relationship-note paragraphs no longer dominate the columns. Engineering/All/Custom connection choices disclose that the view is a chosen scope rather than all possible context.

### Remaining concerns for design review

- **Review-draft return behavior:** After entering RUN-01 review rationale, Return to PRS-02 scope left the captured comparison/review form in place without a visible explanation. Cancelling the review then returning worked. This differs from the useful authoring pause/Return to draft behavior. Either support a paused review while inspecting context or make this restriction clear; an apparently available return action should not silently do nothing.
- **Recipe counts:** The five-column recipe shows nine selected identities, while the footer reports 53 loaded neighborhood items / 92 connections. The explanatory sentence mentions the wider graph, but shown recipe counts should be explicitly separated from loaded neighborhood counts. This is interpretation of scope, not merely wording polish.
- **Trace extent selection:** Engineering trace is a helpful default, but its project-specific relationship set and forward recipes are authored choices. They cannot imply exhaustive effect/coverage. The composition should keep branch alternatives and custom scope visible without adding a stack of controls to every ordinary read task.
- **Search before creation:** The create task now clearly separates identity and connection. The overall design still needs a deliberate way to inspect existing candidates before starting a new item, beyond requiring the engineer to remember Find items and leave authoring. The current draft pause makes that possible, but the primary creation journey should make reuse intentional.
- **Model integration remains a separate decision:** The focused actual-type read and the companion full process/configuration study are documented separate explorations. The complete product design must settle their transition before claiming the Model/Configure journey is integrated.

These are remaining composition/interaction questions, not a request to resume an endless local-polish loop. The revised study is now a useful coherent artifact for owner task/design judgment. Successful simulated task paths validate those interactions, not the beauty, completeness or market fit of the whole application.

### Two targeted follow-ups verified

Rechecked only the subsequent review-return and recipe-count changes around 21:29 UTC, in parent-identified hash `169f39f3b57c9d910002382f047fa2e827476a5d8ba2a938cbc8480717af4770`.

- A RUN-01 review with `Acknowledge changed inputs` selected and an entered rationale now pauses when Return to PRS-02 scope is activated. The working scope appears with a retained-draft notice. Return to draft restores the same RUN-01/BUILD-MED-A capture, decision and exact rationale. Cancel followed by scope return also works. No review was saved.
- Trace now explicitly says `9 trace items shown from 53 loaded items`, while the separate footer retains the wider neighborhood's 53 items / 92 connections. The recipe/loaded-scope distinction is clear.

These two concerns are resolved in the targeted retest. Remaining design questions are purposeful scope/recipe choice, existing-candidate discovery before authoring, and the full Model/configuration transition; none is owner acceptance of the composition.
