# Tracer user journeys and candidate stories

**Status:** candidate discovery stories based on owner reports and sourced/inspected artifacts; not observed user workflows or feature approval. See [needs/evidence](user-needs.md), [UX direction](ux-plan.md) and [specification/checks](development-flow.md).

## 1. How to use these stories

Refine intent, context and acceptance examples with real artifacts before choosing a slice. Stories do not prescribe pages or replace technical specifications. Preserve shared identity, incomplete information, history and uncertainty.

Author, connector and reviewer may be one person. Compare formal medical/aerospace and lighter software tasks (UR-12–13); use project terminology and task-appropriate rigor rather than mandatory industry stages.

## 2. Journey ND — establish a new design

**Trigger:** new product or capability; requirements/design information must be created for the first time.

**Starting material to collect:** a real brief, user needs, known constraints, draft requirements and any existing design/evidence. Who owns each artifact and what is already decided are unknown.

**Finished result:** coherent information across relevant levels, explainable relationships and known remaining work. This does not imply every requirement is approved, every gap is closed, or the product is ready for release.

| Step                | User's question                                                                     | Outcome                                                                    | Needs               |
| ------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Establish the model | What information belongs in this product development flow, and how should it trace? | A recognizable, editable development model, which can evolve as work grows | PN-01, PN-03, PN-09 |
| Orient              | What are we making, for whom, under which constraints?                              | Recognizable initial scope and terminology                                 | PN-01, PN-09        |
| Author              | What must the design accomplish?                                                    | Expressed intent with enough context to continue                           | PN-02               |
| Decompose/connect   | How is that intent addressed at lower levels?                                       | Related information without accidental duplication                         | PN-02, PN-03        |
| Inspect a family    | What do sibling requirements collectively cover?                                    | Understand overlap, missing obligations and shared children                | PN-03, PN-09        |
| Assess completeness | What remains unresolved, and why?                                                   | Actionable gaps under explicit project expectations                        | PN-04               |
| Act                 | Should I write, connect, allocate, investigate or review next?                      | A useful next action with retained context                                 | PN-02, PN-04, PN-09 |
| Evaluate/review     | What supports this conclusion and what is still uncertain?                          | Explained decision and preserved rationale                                 | PN-07, PN-08        |

### ND-01 — begin without an extensive setup detour

> As an author starting a design, I want to work with recognizable information so I can begin expressing the design instead of learning the tool's internal model.

**Needs:** PN-01, PN-02. **Basis:** vision plus hypothesis; preferred onboarding method unknown.

**Candidate acceptance:** users recognize the available information and what is missing; they can start one meaningful item without first constructing a complete project ontology. Existing data brought into the project is not silently lost or falsely represented as validated.

**Investigate:** write from scratch, paste/import or start from a template? Prototype these alternatives rather than implementing all three now.

### ND-02 — author in context and move between levels

> As an author, I want to inspect the relevant parent intent while writing a child requirement so I can explain how the child contributes without repeatedly reconstructing context.

**Needs:** PN-02, PN-03, PN-09. **Basis:** UR-1, UR-2, UR-4.

**Candidate acceptance:** free text is usable without compulsory formal syntax; an item can relate to an existing parent or remain explicitly unlinked; applicable field/relationship actions are reachable in the working context; changing scope does not silently lose the draft.

**Exceptions:** long statements, optional attributes, multiple parents, uncertain relationships and a parent that changed while drafting.

### ND-03 — inspect siblings and shared identity

> As an engineer reviewing decomposition, I want to see the other items contributing under the relevant parent so I can judge the family together rather than inspect isolated statements.

**Needs:** PN-03, PN-09. **Basis:** UR-1.

**Candidate acceptance:** the parent and relationship defining the family are explainable; shared children remain recognizable as the same underlying item; editing one identity does not create divergence among its appearances; users can return to the wider scope with drafts intact.

**Exceptions:** a child belongs to two parents, appears along several paths, or has different kinds of sibling relationships. Test whether the user wants immediate siblings or the whole branch; do not assume they are equivalent.

### ND-04 — resolve one meaningful completeness gap

> As an engineer building a design, I want to know which obligation is unresolved and why so I can choose the next appropriate work.

**Needs:** PN-04, PN-03, PN-07. **Basis:** UR-4, UR-15; exact scope/policies are HY.

**Candidate acceptance:** a displayed gap has an explainable expectation and scope; the user can inspect existing candidates before creating duplicate information; an appropriate new connection resolves that structural gap without falsely declaring the design/evidence valid; other unresolved obligations remain visible.

**Software acceptance example (UR-15):** where the project marks a requirement approved, see whether an actual implementation artifact is linked. With no such link, show implementation as not traced and likely outstanding; offer the task choices of implementing it, linking existing code or investigating uncertainty. Do not force a new implementation when the code already exists. A link to a planned task/design is not an actual-code realization link; partial or outdated mappings retain their unresolved scope. Adding an appropriate link closes the trace gap, not automatically the implementation/verification judgment.

**Exceptions:** an item is intentionally not applicable, the expectation is unknown, existing implementation is unlinked, a link covers only part of the requirement or refers to older behavior, or old evidence uses different inputs. Represent uncertainty rather than inventing a complete/incomplete judgment.

## 3. Journey SC — assess and carry out a sustaining change

**Trigger:** an existing product needs a modification, correction, removal or changed specification.

**Starting material to collect:** the established requirement/design information, relationship context, relevant evidence, proposed reason and the existing change-review process.

**Finished result:** an understood change, associated decisions and known unresolved consequences. A stored change record is not by itself approval for manufacturing, deployment or regulatory release.

| Step          | User's question                                          | Outcome                                          | Needs               |
| ------------- | -------------------------------------------------------- | ------------------------------------------------ | ------------------- |
| Locate        | What exactly are we proposing to change, and why?        | Identified current state and intended scope      | PN-05, PN-09        |
| Propose       | What differs from the established design?                | Understandable before/after intent               | PN-05, PN-08        |
| Trace         | What might be affected, through which relationships?     | Explainable upstream/downstream candidates       | PN-03, PN-05        |
| Interpret     | Which consequences are established, possible or unknown? | Human judgment informed by modeled facts         | PN-05, PN-06, PN-07 |
| Resolve       | What must be revised, reallocated or reassessed?         | Explicit proposed actions, not automatic cascade | PN-02, PN-05, PN-06 |
| Review        | Does the evidence still support the intended decision?   | Scoped decision with rationale and uncertainty   | PN-07               |
| Commit/resume | What was saved, what remains, and where do I continue?   | Preserved history, drafts and working context    | PN-08, PN-09        |

### Worked anchor — one change, cross-system consequences (UR-6)

**User-reported example (UR-6):** changing a medication-delivery device's software/motor limit may affect mechanical design and system requirements. Investigate consequences of one change before assuming several changes are required.

**Refinement (UR-11):** increasing allowable motor load should expose the already-related maximum move-time requirement. Reassess or explicitly revise that requirement; never relax it automatically. Values, per-move versus sequence timing, dependency semantics, implementation, evidence and review process are unknown.

Candidate sequence:

1. Identify proposal, reason and established version.
2. Locate constraining system requirements and candidate software, drive, mechanical and interface consequences; explain each path or engineering reason.
3. Classify each candidate: revision, investigation, verification reassessment, justified no action or unknown.
4. Reassess evidence against the design while preserving parent intent unless explicitly revised.
5. Retain actions, rationale, uncertainty and original history.

Test whether engineers can explain established, possible and unknown consequences without rebuilding context manually. Graph neighbors alone do not prove impact; missing links do not prove its absence. Seek a sanitized actual example and learn whether current reasoning uses traces, documents, calculations, tests or consultation.

### Software anchor — EventSculpt need → requirement → code → tests (UR-14)

**User-reported problem:** growing `../eventsculpt` makes need → requirement → code → test tracing difficult. Use it as a contrasting software case; lighter process does not imply low risk, especially for payments/privacy.

**Repository evidence, read-only inspection:** at EventSculpt HEAD `b12ef872`, the inspected source files had no working-tree modifications. `docs/user_needs.md` contains stable actor-need IDs; `docs/product/README.md` routes capability ownership and explicitly distinguishes approved target behavior from shipped runtime. For a small discovery example:

| Layer               | Existing artifact / observed boundary                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User need           | `PLN-2` in `docs/user_needs.md`: browse/search Venue and Service Listings                                                                                                            |
| Target requirements | `docs/product/slices/discovery-configuration-event-plan.md` owns discovery behavior (`DISC-001` among its capability IDs); its header explicitly says it is not implemented/deployed |
| Runtime caller      | `apps/web/src/app/vendors/page.tsx` calls `isVendorDiscoveryMode` and `organizeVendorDiscovery` to choose and organize the discovery display                                         |
| Implementation      | `apps/web/src/app/vendors/discovery.ts` contains collection selection, discovery-mode and vendor-selection logic                                                                     |
| Tests               | `apps/web/src/app/vendors/__tests__/discovery.spec.ts` imports those helpers and tests category mapping, URL-mode selection and selection ordering                                   |

Caller → helper → test links are visible in source. Need/specification → implementation is a candidate mapping, not demonstrated conformance. No tests were run or passing/deployed state inferred; repository inspection is not user-task observation.

**Walkthrough:** start from a need to inspect specification, current implementation and tests, or from changed code to inspect affected intent/checks. Distinguish current behavior, approved target behavior, proposals and unknown mappings.

**Implementation coverage (UR-15):** approved intent without a realization link means implementation is untraced and likely outstanding; existing code may only need linking. Distinguish existing, planned, partial and obsolete mappings. Code links, test links, executed results and need satisfaction remain separate facts. These are candidate semantics, not selected labels or persisted states.

**Open questions:** file/symbol/behavior reference granularity, durability through changes and human confirmation. Markdown, code and tests retain their source ownership; expect many-to-many mappings. Import, Git/CI integration and inference remain unselected.

This anchor exercises PN-02/03/04/05/07/09 through existing ND/SC stories.

### SC-01 — see impact before accepting a change

> As an engineer proposing a modification, I want to compare it with the established state and inspect explainable consequences so I can review the proposal before changing the authoritative design.

**Needs:** PN-05, PN-03, PN-08. **Basis:** UR-4, UR-6, UR-11; specific staging mechanisms are HY.

**Candidate acceptance:** proposed versus committed information is distinguishable; impact candidates show the paths/reasons that make them relevant; browsing does not write changes; connection alone is not presented as proof that the connected item must change; unmodeled consequences remain explicitly possible.

**Exceptions:** cyclic or dense networks, shared children, changed schema, missing/deleted items and incomplete source knowledge. A bounded result must explain its scope, not imply a complete impact census.

### SC-02 — reason about removal

> As an engineer considering removing information, I want to see what relies on it so I can decide how to address those obligations without losing the established history.

**Needs:** PN-05, PN-03, PN-08. **Basis:** UR-4.

**Candidate acceptance:** removing, filtering out, disconnecting and superseding are distinguishable; references and unresolved obligations are explained; no silent cascade; established history remains inspectable; users know whether anything was committed.

**Investigate:** actual review/approval authority and the semantics of retirement versus deletion. Do not introduce automatic cascade or organizational approval merely because it would simplify a mockup.

### SC-03 — reassess evidence without rewriting its past

> As a reviewer, I want to inspect changed inputs and the original evidence so I can record why the evidence does or does not support the decision now.

**Needs:** PN-07, PN-05, PN-08. **Basis:** vision/existing evidence model; detailed reviewer task is HY.

**Candidate acceptance:** coverage, freshness, uncertainty and review decision remain separate; original snapshots/rationale remain accessible; the comparison used while drafting is identifiable; a relevant intervening change requires an explicit new assessment rather than silent token adoption; acceptance does not erase drift.

**Exceptions:** missing observations, unrelated edits, relevant later changes, superseded evidence and conflicting reviewer assumptions. Local provenance labels are not authenticated approval authority.

## 4. Cross-cutting story Q-01 — quantitative meaning without overconstraint

> As an engineer changing an important specification, I want to understand where the value comes from and where it is used so I can assess the consequences without forcing every requirement into a formal model.

**Needs:** PN-06, PN-02, PN-05. **Basis:** UR-5; representation and computation are HY.

**Toy scenario:** an overall timing limit is 100 ms, with explicitly declared 60 ms and 40 ms allocations. Propose changing the total to 80 ms. These are not medical specifications. Any arithmetic requires explicit combination and overhead assumptions.

**Candidate acceptance examples:**

- Free-text-only requirements remain authorable and reviewable.
- If a value is deliberately shared, its confirmed consumers are identifiable; an unrelated identical number is not automatically coupled.
- An explicitly modeled calculation may report a result/violation under its declared assumptions, with units and explanation.
- A parent limit change exposes the allocation question but does not silently proportionally scale or rewrite children.
- A child allocation change can raise a feasibility question for the parent without rewriting the parent's intent.
- Missing derivation knowledge is not represented as a satisfied constraint or no impact.
- Declared constraints, possible engineering impact and review decisions are distinguishable.

**Alternatives to test:** ordinary prose with annotated values, optional named typed values, linked value references, and human-authored derivation explanations. A general formula language or extraction engine is not assumed.

**Additional cases:** inconsistent units, rounding, tolerances, ranges, conditions, repeated values, independent choices and removal of a referenced value. Replace the toy example with one real artifact before specifying storage or arithmetic behavior.

## 5. Cross-cutting story R-01 — resume and recover safely

> As an engineer interrupted during work, I want to retain my proposal and orientation so I can resume or reconcile it without losing information or overwriting someone else's change.

**Needs:** PN-08, PN-09. **Basis:** vision; preferred saving/recovery model is HY.

**Candidate acceptance:** context/selection and save status are understandable; switching level or representation does not silently discard drafts; a failed read cannot authorize editing stale information as if current; object/schema conflicts preserve the attempt; historical inspection does not masquerade as editing current state.

**Investigate:** autosave versus explicit save, reopening after shutdown, undo, and what should be retained across sessions. Prototype and actual repository safety capabilities may differ; label unsupported recovery behavior honestly.

## 6. Prioritization and open evidence

### Discussion set — three task walkthroughs, before layout

These variants use sourced guidance and inspected EventSculpt artifacts. Proposed changes, missing links and handoffs are illustrative; roles do not describe known staffing. They are discussion tasks, not selected screens or observed studies. Formality depends on context.

#### 1. Establish a new design — agree what to build and connect contributions

**Purpose:** prevent plausible local contributions from collectively omitting or contradicting the user outcome.

- **Formal reference:** FDA's portable-device teaching example connects carrying intent to weight/dimensions, enclosure output and fit/use checks; no device values or manufacturer study are supplied.
- **Software reference:** EventSculpt `PLN-2`; illustrative new browsing behavior connected to UI/query work and tests. Target and runtime ownership remain distinct.
- **Task:** refine intent → inspect neighboring contributions → connect existing design/code/tests or identify missing work. Keep prose and optional quantitative meaning usable.
- **Context/handoff:** author, implementer and test contributor need intent, current statement, sibling work, responsibility and unknowns. One person may fill every role.
- **Outcome:** coherent contributions and next work. Stories: ND-02/03/04.

#### 2. Change a shared interface — see both sides and retained system intent

**Purpose:** prevent a locally correct contract change from breaking a consumer that still uses the earlier contract.

- **Formal reference:** NASA interface management; illustrative controller command units/encoding change involving firmware, calibration, system requirements and interface checks.
- **Software reference:** actual EventSculpt vendor helper calls; illustrative browse-filter change affecting URL mode, query, rendering and tests. This is not an approved EventSculpt assignment.
- **Task:** inspect contract → propose delta → examine producers/consumers and relationship reasons → identify actions/unknowns without automatic consumer edits or relaxed system requirements.
- **Context/handoff:** interface owner, consumers/producers and test contributors need current/proposed contract, shared intent, both endpoints, checks and scope omissions. Agreement follows project policy.
- **Outcome:** explainable candidate consequences and next actions. Story: SC-01; Q-01 only with established quantitative semantics.

#### 3. Find what approved intent still lacks — implementation and test coverage

**Purpose:** prevent “approved” being mistaken for done, generic links hiding partial realization or unlinked code causing duplicate work.

- **Formal reference:** FDA design input/output and V&V distinctions; illustrative approved carrying/fit requirement without linked current enclosure output or fit check. These are not observed gaps in the teaching example.
- **Software reference:** EventSculpt's approved discovery target is explicitly unimplemented/undeployed alongside current discovery code/tests. Assess one target statement; nearby code does not prove conformance. No coverage audit has established a particular missing mapping.
- **Task:** inspect exact requirement/version → inspect implementation/checks or absence → link existing artifacts with scope or retain outstanding work → identify test/result questions. Include planned, partial and existing-but-unlinked cases.
- **Context/handoff:** requirement owner, implementer and reviewer need current/planned references, covered scope, tests/results, uncertainty and next actions. A PR discussion or controlled review may suit the project.
- **Outcome:** act on the right trace gap without equating missing links with missing code or passing tests with full satisfaction. Stories: ND-04, SC-03; basis UR-14–15.

**Historical recommendation:** walkthrough 3 informed the [first visual comparison](ux-artifacts/implementation-gap-layouts/README.md); 1 and 2 checked authoring and change impact. The owner recognized the journeys and requested incremental UI options. Current selection belongs in [UX planning](ux-plan.md), rather than this earlier discussion sequence.

Sources: [FDA QMSR training](https://www.fda.gov/media/189041/download), [NASA interface management](https://www.nasa.gov/reference/6-3-interface-management/) and the inspected EventSculpt references above. These citations ground the examples, not claims of observed user behavior.

Compare alternatives on the same task, then select one complete slice with failure states and exclusions. Check formal/lightweight contexts before fixing layout. Record participants/context, sanitized artifacts, observations, assistance/errors, interpretation and questions against stable need/story IDs. Representative task observations remain outstanding; current implementation and selected interactions are recorded separately in [checkpoint](checkpoint.md) and [UX planning](ux-plan.md).

## Vision scenarios and remaining proof

**VI-1 candidates, not observed users or approved features.** These retain the breadth of the original vision alongside the detailed ND/SC journeys above.

- **Individual engineer:** begin locally with recognizable types, bring existing spreadsheet work into the project and connect intent to tests without server/authentication setup. Fresh-project modeling and create-only CSV import with mapping, key-based links, error preview and atomic commit are implemented; workbook import and existing-record reconciliation remain candidates.
- **Next-work discovery (UR-62):** separate statement/allocation/plan gaps, changed evidence and unresolved reviews now have complete bounded queues with direct existing edit/review actions. Counts are not readiness; linked follow-up work and representative-user validation remain separate.
- **Engineering change assessment:** inspect a changed requirement's connected designs/components/tests, capture a reproducible baseline and compare against an earlier release. Scoped native/evidence investigation and deterministic whole-project JSON export with exact history/evidence provenance exist; selected-baseline review packages, complete diff/restoration and human usefulness still need proof.
- **Research team:** model research questions, hypotheses, experiments, configurations, datasets/results and conclusions; trace a conclusion to recorded supporting evidence and compare configurations without forcing requirements terminology. Offline research receipts demonstrate part of this; full team collaboration is not delivered.
- **Agent-assisted engineering:** discover schemas, find missing relationships, propose a guarded batch with a readable semantic diff and let a human review/selectively apply when project policy requires. Authorized direct changes may also be useful. Current CLI/API and atomic writes are foundations; general proposal review and MCP are future work.
- **Organization:** use shared PostgreSQL-backed information through multiple interfaces with authenticated permissions, consistent validation, concurrent edits and shared history. This remains an architecture-validation scenario, not a deployment capability or capacity claim.

For each scenario, observe task completion, comprehension, recovery and setup/maintenance burden. A working technical demonstration is necessary evidence of behavior, not representative-user validation.
