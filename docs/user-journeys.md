# Tracer user journeys and candidate stories

**Status:** candidate discovery stories, informed by product-owner statements and the source-grounding in [ux-plan.md](ux-plan.md); not observed workflow transcripts, selected UI designs or implementation approval.

Needs and evidence: [user-needs.md](user-needs.md). Concept comparison: [ux-plan.md](ux-plan.md). Turning a selected story into a specification and checks: [development-flow.md](development-flow.md).

## 1. How to use these stories

These describe intent, context and outcomes. They do not require pages named New Design, Change, Table or Evidence. A story is not a complete technical specification; acceptance examples below are candidates for discussion/prototype evaluation. Refine them with real artifacts before choosing a delivery slice.

One identity can appear in several contexts. Information can be missing, incomplete, shared, historical or unsupported by sufficient evidence. Do not make the happy path imply that engineering work is a simple linear checklist.

Working roles are author, connector and reviewer; one user may move among them. Compare documentation-heavy medical-device/aerospace and lighter software/technology work from the outset (UR-12–13), without treating industry as a fixed process category. Medical examples do not prescribe regulatory stages or a mandatory hierarchy. Shared intent and cross-team agreements matter in both; formal sign-off and documentation depth depend on the task. A lightweight review may occur in a design discussion or PR, not a separate approval ceremony. These are context hypotheses, not implemented integrations. Use the project's terminology and relationship semantics.

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

**User-reported example:** an electromechanical medical device delivers precise medication. A software change involving a motor limit may affect other parts, including mechanical design; the engineer needs to ensure the system-level requirements are still met. The key task is understanding the consequences of **one change across multiple parts**, not assuming several independent changes are already required.

**Later refinement (UR-11):** increase the allowable motor load and see an already-related requirement that all moves complete within X time. The time requirement may need reassessment or an explicit revision; it must not be automatically relaxed. This is a user-supplied illustrative relationship, not a confirmed design calculation. Whether X applies per move or to a sequence is unresolved.

**Known:** reference domain, cross-disciplinary context and the desired visibility of load/timing impact. **Unknown:** actual values, technical dependency semantics, software/mechanical implementation, established artifacts, evidence and decision workflow. No performance limits, clinical specifications or safety conclusions are invented here.

Candidate task sequence to investigate:

1. Identify the proposed change, its reason and the established state/version.
2. Locate the system-level medication-delivery requirements that may constrain it.
3. Identify relevant software, motor/drive, mechanical and interface information, explaining the relationships or engineering reasoning that make each a candidate for impact. These categories are prompts, not an established dependency model.
4. Assess each candidate: does information need revision, does design need investigation, should a verification activity be reconsidered, is no action justified, or is impact unknown?
5. Reassess the supporting evidence against the revised design. Changed implementation need not change the parent requirement; neither an existing link nor a previously passing result proves that the new design satisfies it.
6. Record actions, rationale and unresolved judgments while retaining the original design/evidence history.

**Useful outcome to test:** the engineer can see which related requirements/design parts may be affected, why they are brought into view, and which consequences are established, possible or unknown—without reconstructing the context manually. A list of graph neighbors or a distance-from-change score alone does not establish this outcome. The absence of a modeled relationship cannot establish no impact.

**Next research question:** how does the engineer identify and assess those parts today—existing trace relationships, design documents, calculations, testing or consultation with other engineers? Use a sanitized actual example to refine this sequence before selecting an interface.

### Software anchor — EventSculpt need → requirement → code → tests (UR-14)

**User-reported problem:** as the sibling `../eventsculpt` codebase grows, it is difficult to trace user needs through requirements to actual code and tests. Use it as a concrete lighter software case alongside formal engineering work, not a new product silo or an assumption that every EventSculpt task is low-risk. Payments, privacy and other sensitive workflows can require stronger controls.

**Repository evidence, read-only inspection:** at EventSculpt HEAD `b12ef872`, the inspected source files had no working-tree modifications. `docs/user_needs.md` contains stable actor-need IDs; `docs/product/README.md` routes capability ownership and explicitly distinguishes approved target behavior from shipped runtime. For a small discovery example:

| Layer               | Existing artifact / observed boundary                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User need           | `PLN-2` in `docs/user_needs.md`: browse/search Venue and Service Listings                                                                                                            |
| Target requirements | `docs/product/slices/discovery-configuration-event-plan.md` owns discovery behavior (`DISC-001` among its capability IDs); its header explicitly says it is not implemented/deployed |
| Runtime caller      | `apps/web/src/app/vendors/page.tsx` calls `isVendorDiscoveryMode` and `organizeVendorDiscovery` to choose and organize the discovery display                                         |
| Implementation      | `apps/web/src/app/vendors/discovery.ts` contains collection selection, discovery-mode and vendor-selection logic                                                                     |
| Tests               | `apps/web/src/app/vendors/__tests__/discovery.spec.ts` imports those helpers and tests category mapping, URL-mode selection and selection ordering                                   |

The caller → helper → test connections above are visible in source. The need/specification → current implementation mapping is only a candidate to assess, not an established trace link or claim of conformance to target behavior. No tests were run and no passing result, complete coverage or deployed state was inferred. This is inspected repository material, not an observed user task or proof of the reported friction.

**Candidate walkthrough:** start from a need and see its related requirement/specification, current implementation and relevant tests; or start from changed code and see the intended behaviors and tests that may need attention. Distinguish current behavior, approved-but-unimplemented target behavior, proposed changes and unknown links. Expose missing/uncertain mappings without equating absent links with absent implementation or a passing helper test with satisfaction of the entire need.

**Implementation coverage refinement (UR-15):** approved intent and implemented behavior are separate. Tag/link the realizing artifact, such as current code, to the requirement it addresses. With no implementation link, the expected useful signal is “implementation not traced—likely outstanding,” not a silent approved/complete status. The code may exist but be unlinked; mapping it is useful work too. Existing, planned, partial and obsolete artifact mappings must be distinguishable. A code link does not itself prove complete realization, a test link does not mean a test ran, and a passing result does not automatically establish the full user outcome. These are candidate semantics, not chosen UI labels or new persisted states.

**Design questions:** what is the useful code reference granularity (file, symbol or behavior boundary), how do references survive changes, and which links require human confirmation? Existing Markdown and code/test artifacts should remain their owners rather than be copied into competing Tracer documents. Many-to-many relationships are expected. Automatic discovery/import, Git/issue/CI integration and coverage inference are not selected features or authorized implementation.

This anchor exercises PN-02/03/04/05/07/09 and existing ND/SC stories; it does not add a tenth story or select a layout. Include it in the formal/lightweight comparison before UI decisions.

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

These are variants of the existing stories, not three selected screens, new story IDs or observed team studies. Source guidance and the inspected EventSculpt artifacts ground the tasks; proposed changes, missing links and team handoffs below are illustrative unless explicitly noted. Roles describe work boundaries, not known EventSculpt staffing. Formality is contextual rather than industry-fixed. Integration/adoption testing is deferred while the owner and assistant work through UX decisions.

#### 1. Establish a new design — agree what to build and connect contributions

**Purpose/trigger:** turn a user outcome into coherent engineering work before different contributors make incompatible assumptions.

- **Formal reference:** FDA's portable-device teaching example starts with a carrying need, then considers weight/dimensions and fit in the user's equipment. Use the underlying intent, design constraints, enclosure/design output and intended fit/use checks; do not invent device values or claim a manufacturer study.
- **Software reference:** EventSculpt's existing `PLN-2` discovery need. Illustrative design task: define a new browsing capability and relate the intended behavior to UI/query work and tests. Existing target specification versus runtime ownership remains explicit; this does not claim the capability is implemented.
- **Walkthrough:** start with the need → author/refine the behavior or constraint → see neighboring contributions → connect an existing design/code/test artifact or identify missing work. Requirement prose and optional quantitative meaning remain valid without a mandatory decomposition grammar.
- **Working roles/handoff:** product/requirements author expresses intent; design/software contributors describe how it is realized; verification/test contributors identify appropriate checks. They can be one person or several.
- **Information needed together:** user intent, the statement being authored, related/sibling contributions, proposed responsibility and remaining unknowns. Full artifact detail need not be visible simultaneously.
- **Coordination failure to prevent:** each contributor builds a plausible local solution but their combined work omits or contradicts the user outcome.
- **Useful outcome:** coherent intent and contributions with clear next work, not merely a populated hierarchy. Primary stories: ND-02/03/04.

#### 2. Change a shared interface — see both sides and retained system intent

**Purpose/trigger:** a local contract change may break a separately owned consumer while leaving the shared system goal unchanged.

- **Formal reference:** NASA interface-management guidance. Illustrative hardware/software task: change the units/encoding of a controller's motion command. Bring the command contract, receiving firmware, actuator/calibration assumptions, system performance requirement and interface checks into the same task. No actual device dependency or performance calculation is claimed.
- **Software reference:** EventSculpt's vendor page actually calls `isVendorDiscoveryMode` and `organizeVendorDiscovery`. Illustrative task: add a browse-filter parameter and inspect its effects on URL mode selection, query behavior, rendering and relevant tests. The proposed filter is not a current approved EventSculpt requirement or implementation assignment.
- **Walkthrough:** inspect the existing contract → propose the delta → see the producers/consumers linked to it and why → identify which mappings, implementations or checks need action and which effects remain unknown. Do not automatically rewrite consumers or relax the system requirement.
- **Working roles/handoff:** interface owner consults the producers/consumers and test owners; any required agreement belongs to the project's own process, not a universal approval gate.
- **Information needed together:** current/proposed contract, shared intent, both sides of the interface, relationship meanings, relevant checks and omissions from the displayed scope.
- **Coordination failure to prevent:** a change is locally correct but another subsystem/consumer still uses the earlier contract.
- **Useful outcome:** visible candidate consequences and explicit next actions without manually rebuilding the dependency context. Primary story: SC-01, with Q-01 only where quantitative semantics are established.

#### 3. Find what approved intent still lacks — implementation and test coverage

**Purpose/trigger:** work looks settled because a requirement is approved, but its realization or verification is incomplete or not traced.

- **Formal reference:** FDA's distinction between design inputs/outputs and verification/validation. Illustrative gap: a carrying/fit requirement is agreed, but there is no linked current enclosure output or fit check. The missing links are a scenario for discussion, not gaps observed in the FDA teaching example.
- **Software reference:** EventSculpt has an approved discovery target specification explicitly marked not implemented/deployed, alongside current discovery code/tests. Start from one bounded target statement; do not treat nearby runtime code as conformance to the target. A particular unlinked/partial mapping is a provisional task condition, not a completed repository coverage audit.
- **Walkthrough:** choose the requirement → see its related implementation and checks, or their absence → inspect candidate existing code/design → link the appropriate artifact with its covered scope, or retain outstanding implementation work → identify remaining test/result questions. A link to a planned task is not current realization. Existing-but-unlinked and partial implementation are deliberate cases.
- **Working roles/handoff:** requirement owner and implementer resolve what the code/design actually addresses; test/review contributors assess appropriate evidence. A PR discussion may suffice in a lightweight context; applicable controlled review remains possible.
- **Information needed together:** exact approved statement/version, current versus planned artifact references, scope/partial coverage, tests versus actual results, uncertainties and next actions. Approval, implementation and verification are separate dimensions.
- **Coordination failure to prevent:** approved is mistaken for done; a generic artifact link hides a missing part; unlinked existing code causes duplicate implementation.
- **Useful outcome:** see likely outstanding work and act on the right gap without claiming that absence of a link proves absence of code or that a passing test proves the full need. Primary stories: ND-04 and SC-03; basis UR-14–15.

**Recommendation, not selection:** begin with walkthrough 3 because it directly exercises the owner's current approved-but-unimplemented concern and has concrete EventSculpt source material. Walkthroughs 1 and 2 remain checks on whether the eventual interaction supports authoring and change impact, not scope to implement simultaneously. The owner subsequently recognizes these as real journeys and asks for several options at each UI step. The [first visual comparison](ux-artifacts/implementation-gap-layouts/README.md) uses walkthrough 3 as its starting case; next discuss the information arrangement and choose/reject a working structure. This is not a selected final delivery journey or user-validation study. Seek sanitized actual artifacts and observations alongside this provisional set. Sources: [FDA QMSR training](https://www.fda.gov/media/189041/download), [NASA interface management](https://www.nasa.gov/reference/6-3-interface-management/) and the read-only EventSculpt source references in the software anchor above. Follow the collaborative sequence in [ux-plan.md](ux-plan.md), not a one-shot concept delivery.

Compare alternatives against the same agreed task, including ND-03/04 and SC-01 plus Q-01 where appropriate. Choose one primary delivery journey based on task evidence and owner priorities—not because one view is implemented.

Do not attempt to deliver every story together. A first slice must complete one meaningful task, including its relevant failure states, and declare what it does not solve. Check the shared task model against formal and lightweight contexts before fixing a layout; later validation must state the particular users/context covered rather than claim universal fit.

For each study, record participant/context, sanitized artifact, scenario, observations, assistance/errors, interpretation and remaining questions. Link observations back to need/story IDs. No task observations or final concept selection have been completed yet.

## Vision scenarios and remaining proof

**VI-1 candidates, not observed users or approved features.** These retain the breadth of the original vision alongside the detailed ND/SC journeys above.

- **Individual engineer:** begin locally with recognizable types, bring existing spreadsheet work into the project and connect intent to tests without server/authentication setup. Fresh-project modeling is implemented; spreadsheet import and its reconciliation UX remain a candidate.
- **Engineering change assessment:** inspect a changed requirement's connected designs/components/tests, capture a reproducible baseline and compare against an earlier release. Scoped native/evidence investigation exists; complete baseline export/diff/restoration and human usefulness still need proof.
- **Research team:** model research questions, hypotheses, experiments, configurations, datasets/results and conclusions; trace a conclusion to recorded supporting evidence and compare configurations without forcing requirements terminology. Offline research receipts demonstrate part of this; full team collaboration is not delivered.
- **Agent-assisted engineering:** discover schemas, find missing relationships, propose a guarded batch with a readable semantic diff and let a human review/selectively apply when project policy requires. Authorized direct changes may also be useful. Current CLI/API and atomic writes are foundations; general proposal review and MCP are future work.
- **Organization:** use shared PostgreSQL-backed information through multiple interfaces with authenticated permissions, consistent validation, concurrent edits and shared history. This remains an architecture-validation scenario, not a deployment capability or capacity claim.

For each scenario, observe task completion, comprehension, recovery and setup/maintenance burden. A working technical demonstration is necessary evidence of behavior, not representative-user validation.
