# Development model audit and improvement plan

**2026-10-21. Audit complete; replacement model and migration are proposed.** The owner selected this audit and clarified that establishing a suitable development model is the first task when using Tracer. This plan owns the proposed reorganization; the [live register](../projects/tracer/README.md) owns work selection and delivery status.

**2026-10-23 follow-through:** the owner selected the discussed model with system subcomponents. The [current development model](development-model.md) records the adopted conventions. The live project now contains bounded REQ requirements, component allocations and VER plans; the original TR summaries remain as superseded records. The detailed audit below remains the dated basis for that change.

Tracer's development register is a useful preserved inventory, but it is not yet a coherent requirements baseline. Its links establish associations more reliably than they establish obligation, decomposition or evidence coverage. Improve the meaning and completion boundaries before expanding requirement-to-code mappings.

Model establishment is also a product task: help a project explain what it is developing, what its records mean, how they relate, and how it will judge progress. Saving a valid schema is only one part of that task. This does not require a comprehensive model before useful work can begin; start with enough structure to explain one real development example, then evolve it deliberately.

## Audit scope and evidence

The audit inspected all 93 active records and 169 links at native revision 5, schema version 1, together with needs, journeys, development guidance, model configuration contracts and onboarding guides. [The audit inventory](../projects/tracer/model-audit.json) captures counts, exact requirement versions/statements and proposed dispositions. A pre-audit SQLite backup preserves that state and its history. This is a semantic review of Tracer's own development project, not an implementation conformance audit or representative-user study.

The inventory contains five goals, nine needs, nine stories, seventeen requirements, nine work items, thirty-five sources, eight artifacts and one decision. Twelve requirements are labeled implemented; thirteen retain documentation-based verification, three are unverified, and one is verified for the internal register setup. Only TR-003 and TR-017 have direct implementation/check artifact links; TR-003's links cover a card-layout correction, not its whole navigation scope. Missing links mean untraced implementation, not necessarily missing implementation.

The underlying primitives are useful: stable identities, directed relationships, guarded writes, history and separate immutable receipts. Keep those, the source evidence and the separation between delivery, verification and validation. The main defects are in how we used the primitives.

## Findings

| Finding                                                | Evidence in the current project                                                                                                                                                   | Consequence and correction                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements use incompatible units of scope           | TR-001 combines configuration, records, links, persistence and account-free use; TR-011 describes command outcome recovery                                                        | Split at independently assessable obligations. Broad capabilities organize work; they do not receive a single verified badge.                                                      |
| Product behavior and our development process are mixed | TR-017 is the decision to use Tracer to develop Tracer                                                                                                                            | Preserve its setup history, then classify it as internal process/decision work. Product behavior demonstrated by that exercise belongs in independently justified requirements.    |
| Discovery tasks appear as requirement acceptance       | TR-013 asks to select a real quantitative artifact; TR-015 asks to select bulk operations                                                                                         | Keep these as discovery work and candidate outcomes until observable behavior is chosen. Do not mark unspecified product behavior not implemented as though its scope were agreed. |
| Scope and status disagree                              | TR-016 requires cross-client recovery but is partial based on browser-local recovery; TR-006 mixes bounded comparison acceptance with whole-project restoration in remaining work | Assess the stated obligation. Separate adjacent future behavior from unfinished acceptance; preserve unknown where the evidence cannot decide.                                     |
| Needs and stories are copied document sections         | PN statements embed basis, research questions and exclusions; story statements include headings and whole acceptance/exception sections                                           | Separate concise outcome/context from rationale, evidence and open questions. Keep scenarios optional rather than another mandatory approval tier.                                 |
| Decomposition is missing                               | The schema has addresses/supports_story, but no requirement refinement relation                                                                                                   | Define parent/child obligation semantics and explain shared contributions. Do not force a tree or infer decomposition from graph position.                                         |
| Evidence trace stops at associations                   | checked_by targets both test code and reports; all relationship fields are empty; broad TR-003 links describe only card layout                                                    | Record criterion coverage, article under test and exact result inputs. A test file, a plan and an executed result must be distinguishable.                                         |
| Structural checks cannot assess model quality          | The three policies ask only whether requirements have a need/source and work has a requirement                                                                                    | Keep structural checks, but add semantic review. A loosely related source or umbrella requirement can satisfy a count without making the model useful.                             |
| Development work must pretend to be product delivery   | advances only permits work_item → requirement; WORK-002 spans twelve requirements                                                                                                 | Allow discovery, model maintenance and verification work to target their actual subject. Split delivery work by a bounded result.                                                  |
| Provenance dominates the visible network               | 35 source records and 54 sourced_from links; every need links both its section and the shared vision source                                                                       | Keep provenance available, but use task-specific scopes. Inspect direct support separately from broad background context; avoid deleting history to declutter a view.              |
| The project lacks an authored development flow         | None of its seven relationship definitions declares workflow paths                                                                                                                | Explicitly author meaningful flow directions for this model. Do not expect the UI to infer purpose from permissions or link names.                                                 |
| Configuration guidance starts at mechanics             | Getting started selects and saves Engineering, then authors records; the custom-model guide teaches type/field/link editing                                                       | Add a short semantic exercise before bulk authoring: vocabulary, one real example, relationship meanings, evidence and change questions. A new wizard is not yet specified.        |

The five UN goals and nine PN needs are not inherently excessive. The distinction is defensible if goals express product direction and needs express outcomes in a working context. The UN naming is historical; retain IDs and make roles clear instead of introducing another numbering migration.

## Proposed organization

Use a small semantic contract for each kind of information. A type is justified when it has a distinct meaning or lifecycle, not merely because it appears in a document heading.

| Concept                           | What it means                                                          | Minimum useful content                                                                               |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Goal                              | Product direction                                                      | Outcome, scope and source; no inherited implementation percentage                                    |
| User need                         | Outcome a person needs in a context                                    | Actor/context, outcome, rationale, evidence and open questions separately                            |
| Scenario                          | Concrete task that tests understanding or usefulness                   | Trigger, starting information, steps/outcome, exceptions and linked needs; retain existing story IDs |
| Requirement                       | Selected or proposed observable behavior or constraint                 | Statement, applicability, stable acceptance criterion IDs, exclusions, rationale and source          |
| Design or implementation artifact | How behavior is realized                                               | Role, identity/path, exact version/hash and contribution scope                                       |
| Verification plan                 | How specified behavior will be checked against a design/implementation | Criteria, method, article under test, inputs/setup and expected result                               |
| Result and assessment             | What happened and what it supports now                                 | Native immutable receipt with exact inputs/output; separate freshness and scoped judgment            |
| Work item                         | A bounded change, investigation, audit or verification activity        | Kind, subject, intended result, selection, completion evidence and next action                       |
| Source or decision                | Why we believe or choose something                                     | Captured support or chosen alternative, rationale, scope and unresolved assumptions                  |

Use existing artifact kinds for designs, implementations, verification plans and reports in the pilot, adding only the needed fields. Results remain native receipts; do not create a second mutable pass/fail database. If distinct artifact lifecycles later justify separate types, demonstrate that with the pilot first. Capability areas can initially be grouping metadata, without new mandatory hierarchy records. Risks and allocations may need explicit records in other projects; they are not mandatory additions to every Tracer project.

For needs, retain PN-01 through PN-09 provisionally. Clarify their boundaries: PN-01 establishing useful work; PN-02 authoring intent; PN-03 understanding relationship meaning; PN-04 identifying obligations; PN-05 reasoning about proposed changes; PN-06 quantitative meaning; PN-07 judging evidence; PN-08 saved-state trust/recovery; PN-09 orientation while navigating. PN-03 and PN-09 can overlap without being identical; PN-05 addresses engineering consequences while PN-08 addresses state integrity. Investigate overlap through scenarios before merging records.

## Relationship meanings

These are proposed project semantics, not new hard-coded Tracer rules:

- `addresses`: requirement or scenario → need. Explain the specific contribution; a link does not establish satisfaction.
- `refines`: child requirement → parent requirement. State which parent obligation it develops. Permit shared children; reject cycles within this declared decomposition relation, while allowing other legitimate feedback relationships.
- `implemented_by`: requirement → design/implementation artifact. Capture which criteria it realizes and whether the mapping is complete, partial or uncertain.
- `checked_by`: requirement → verification-plan artifact. Identify the criteria evaluated. Plans separately identify the design/implementation they evaluate; criteria and article under test are distinct inputs.
- `advances`: work → its actual subject, including a need, requirement, scenario or decision as appropriate. Work completion does not automatically change the subject's verification status.
- `sourced_from`: a claim → supporting source. Use source scope/rationale to distinguish direct support from background. `supersedes`: replacement → prior record, retaining old identity and history.

Goals and scenarios can explain context without sitting on every trace path. A refined requirement may reach a need through its parent; the pilot must explicitly account for that in coverage review rather than assume the current direct-link policy supports inherited coverage. Add direct need links only for a real additional contribution. Author workflow labels separately from these native directions, and show feedback where it is meaningful.

## Status and completion rules

Keep specification maturity, selection, delivery, verification and user validation independent. Proposed definitions are draft, ready or superseded; selection remains a separate decision. Delivery includes unknown/unassessed so imported or remapped claims do not become invented certainty. Verification records not checked, passing, failing, mixed or inconclusive evidence for a named criterion set and candidate. Freshness is a separate comparison of exact declared inputs, not another synonym for failed. These are proposed project conventions; current schema strings do not enforce them.

Each acceptance criterion has a stable local label such as AC-1. A result names the requirement version, criteria covered, implementation candidate, method and outcome. Updating acceptance requires reconsidering applicability, not rewriting the old result. Unrelated edits need not invalidate evidence whose declared inputs remain applicable. Conflicting or incomplete results stay visible and require a reasoned assessment.

Report delivery and verification at the smallest useful obligation. Capability summaries show assessed/unknown children and remaining obligations, with the denominator and scope stated. Do not average arbitrary requirement counts into product readiness. Validation applies to a need/scenario in a stated user context and may use several requirements together; green checks do not validate a need. Release decisions remain separate.

## First pilot in Tracer

Start with **model establishment**, because it is both the owner's clarified product priority and the failure exposed by our own register. Use PN-01/PN-03, ND-01 and the broad TR-001 as inputs. Owner direction supports investigating this workflow; it does not prescribe a wizard, scoring algorithm or mandatory requirements taxonomy.

Proposed need wording for review: “When beginning or adapting a development project, I need a shared, understandable model of its information and relationships so we can organize work and judge progress consistently.” Keep source/evidence and uncertainty outside that statement.

Exercise the existing Configure model and recorded-item views with one Tracer feature, one incomplete trace, a shared contribution and a changed requirement. Suggested behavioral obligations to specify in the pilot are:

| Draft obligation                       | Acceptance example to refine                                                                                                                                 | Verification and validation                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Explain type and relationship meanings | For each type/link in the example, the author can inspect its purpose, permitted direction and a concrete example without confusing definitions with records | Inspect configured semantics and representative records; observe whether a user explains them correctly           |
| Inspect one development trace          | Starting from a need, find an applicable requirement, its design/implementation, the intended check and any executed result; missing stages remain explicit  | Check canonical identities, scope and missing states; observe whether the trace answers what remains to do        |
| Evolve the model safely                | An incompatible definition change reports affected constraints and preserves the current model/data; a compatible confirmed save can be reopened             | Exercise existing validation, conflict and persistence contracts; test whether the author understands the outcome |

These are draft scopes, not assertions of current delivery. The first two still need interaction/acceptance refinement before implementation. A manual documented walkthrough is sufficient for the first pilot; use it to identify actual product gaps.

Use **PN-09/TR-003** as a second, smaller stress test of granularity: selection retained across supported views; existing positions retained during branch expansion; and graph-card text contained at supported zoom/detail states are separate behavioral obligations. WORK-009's result can support the last obligation after exact scope/version review; it must not establish the others. This checks whether the proposed model handles a real completed correction without exaggerating its evidence.

## Disposition of the current requirements

All dispositions below are proposals. Preserve old IDs and their history; do not silently rewrite old acceptance to fit current code.

| Current record                  | Proposed treatment                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-001 Local configurable model | Decompose into model establishment, schema semantics, record/link authoring and persistence obligations; start with the pilot                   |
| TR-002 Guarded authoring        | Separate confirmed save, conflict handling, no-op edits and draft retention; retain shared invariants through explicit links                    |
| TR-003 Connected navigation     | Separate navigation/identity, context preservation and presentation constraints; map the scoped card correction                                 |
| TR-004 Work queues              | Specify common completeness/failure semantics and each queue's applicability; avoid one badge for five distinct obligations                     |
| TR-005 Evidence reassessment    | Separate immutable result, input comparison and judgment semantics; keep their interaction acceptance                                           |
| TR-006 History and comparison   | Separate history, baseline reconstruction, comparison and proposed-change investigation; restoration stays a separately selected future scope   |
| TR-007 CSV import               | Retain as a capability grouping; specify mapping, identity resolution, validation, concurrency and atomic commit criteria                       |
| TR-008 Export                   | Retain bounded export behavior; split deterministic content, read-only preparation and external-content boundaries where independently assessed |
| TR-009 Engineering starter      | Separate first-save/reopen behavior from the usefulness hypothesis; keep optional templates and policies explicit                               |
| TR-010 Headless access          | Identify service/CLI/HTTP parity and applicable differences; do not treat interfaces as three independent products                              |
| TR-011 Outcome recovery         | Retain as a comparatively bounded requirement; make recovery and changed-payload criteria explicit                                              |
| TR-012 HTTP compatibility       | Separate discovery information from client write-gating behavior and stale-response handling                                                    |
| TR-013 Quantitative meaning     | Move discovery acceptance into WORK-005; retain a candidate outcome until semantics are selected                                                |
| TR-014 Team portability         | Separate backend equivalence, concurrent operation and authenticated authority; all remain candidate scope                                      |
| TR-015 Bulk authoring           | Move operation selection into WORK-007; specify behavior only after selecting a bounded task                                                    |
| TR-016 Portable recovery        | Separate local recovery from cross-client portability; reassess the latter from unknown rather than transferring local completion               |
| TR-017 Internal register        | Preserve historical setup evidence; move ongoing usage to the internal decision/work context, outside product-requirement rollups               |

## Execution plan and exit criteria

1. **Audit and plan — this slice.** Preserve the original register, record findings and owner direction, and make the next work explicit. Done when the inventory is reproducible, every current requirement has a disposition, and the plan is linked from normal development entry points.
2. **Model establishment pilot — proposed next slice.** Produce a concise type/relationship dictionary, representative records, exact draft acceptance and a named trace walkthrough. Include a missing result, partial implementation, shared child and changed criterion. Done when the owner can explain what each record/link means and what is known, unknown and next. An owner review establishes project-model suitability, not representative-user validation of Tracer.
3. **Rehearse migration on a backup.** Add schema fields/relationships compatibly before changing records; inspect actual retyping support rather than assuming it. Use new identities plus explicit supersession when scope/type changes cannot preserve meaning. Keep old records and source captures, and record an old-to-new mapping for every affected item. Done when history/receipts remain readable, the migration can resume deliberately after a conflict, and the proposed active trace passes integrity and semantic checks.
4. **Migrate the selected project slice.** Apply version-guarded changes, update live work/coverage policies and authored workflow paths, export and back up. No automatic copying of implemented/verified status to newly split requirements. Done when mapped evidence supports each asserted status or the status explicitly remains unassessed; affected views and headless queries agree.
5. **Use the model for delivery and verification.** Replace WORK-002's broad audit with bounded requirement audits. Define criteria and check plans before code, attach exact candidate/result evidence, and record remaining obligations. Done for each slice when someone can answer why it exists, what behavior was selected, what changed, what was checked and what still needs learning without reconstructing chat history.
6. **Improve Tracer's model-establishment experience.** Use pilot friction to specify guidance or UI changes, compare a lightweight software task with a more formal engineering task, and run an unfamiliar-user walkthrough. Done when users can establish/explain a suitable initial model and distinguish a missing link, missing implementation and missing/past result without facilitator reinterpretation. Product UI implementation is a later bounded slice, not part of this audit.

Migration checks cover stable identities or explicit replacements, no dangling links, allowed endpoint types, complete disposition mapping, preserved source/history/receipt access, no accidental acceptance/status promotion, no cycles in declared refinement, and deterministic export plus backup/reopen equivalence. Semantic review separately checks necessity, scope, overlap, meaningful relationship direction and whether the model answers the project's development questions. Passing structural checks alone cannot pass this review.

For everyday development, begin by checking whether the current model fits the task. Reuse it when it does; revise only the affected concepts when it does not. Select a bounded obligation, plan its evidence, deliver/check it, then update the register and reconsider affected assumptions. Model establishment is a recurring foundation, not a one-time setup ceremony.
