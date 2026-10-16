# Tracer development flow and design principles

**Status:** a proposed lightweight working method, not a compliance procedure, chosen UI architecture or authorization to implement/release features.

The purpose is to connect real work to deliberate design, testable behavior and evidence of usefulness. Use this alongside [user needs](user-needs.md), [journeys/stories](user-journeys.md), [UX exploration](ux-plan.md) and the existing [architecture](architecture.md).

## 1. The flow: a feedback loop, not a one-way document chain

**Users/context → needs → journeys → alternative solutions → selected thin-slice specification → implementation → verification → user validation → learning.**

Return to earlier decisions whenever evidence challenges them. Validation begins with task understanding and prototypes; verification planning begins while specifying behavior. Do not write a complete product specification before testing the central assumptions, and do not treat running code as proof of product fit.

Discovery asks whether a solution is useful, understandable, feasible and sustainable. Delivery produces a reliable implementation of the selected solution. These activities inform one another; they are not separate products or rigid team silos.

For Tracer, medical-device engineering is a familiar reference, not the default process model. Compare documentation-heavy medical-device/aerospace and lighter software/technology tasks from the outset; rigor varies by team, task, risk and applicable obligations rather than industry alone. Shared engineering context comes first, with appropriate process depth rather than mandatory approval ceremony. This guidance does not assert that Tracer is a medical device or that a generic software process meets regulated obligations.

The [industry workflow guides](industry-workflows/README.md) provide sourced reference contexts for medical devices, software, hardware and integrated products, automotive, and aerospace, including selected public company practices. Their [shared development model](industry-workflows/common-development-model.md) compares terminology, failure consequences, change costs and demonstration obligations. They explain the engineering artifacts and coordination behind possible Tracer examples. This document continues to own Tracer's development process; reference workflows do not impose a project schema or authorize features.

## 2. Practical stages and outputs

| Stage             | Main question                                                   | Smallest useful output                                               | Evidence needed to advance                                                           |
| ----------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Understand work   | Who is doing what, under which constraints, and why?            | A concrete task/artifact and observed or user-reported needs         | Sources and assumptions are distinguishable; important unknowns identified           |
| Frame outcomes    | What problem should the product solve?                          | A need and end-to-end journey with success conditions                | Outcome is recognizable to the user and not phrased as a favorite screen             |
| Explore concepts  | What are genuinely different ways to help?                      | Competing low-fidelity task sequences and assumption tests           | Major value/usability questions investigated, not just polished mockups              |
| Select a slice    | What complete task should we deliver first?                     | One bounded scope with alternatives considered, risks and exclusions | Intentional selection; critical safety/comprehension issues addressed                |
| Specify behavior  | Exactly what must the chosen solution do?                       | A thin functional/interaction spec with acceptance examples          | Ambiguous semantics resolved sufficiently for implementation and checks              |
| Implement         | How can we deliver that behavior safely?                        | End-to-end change through existing application boundaries            | Focused code, preserved invariants, no speculative framework expansion               |
| Verify            | Does this candidate satisfy the specification?                  | Automated/manual check results bound to the candidate                | Relevant functional, integration, safety and accessibility checks pass               |
| Validate          | Does it help representative users accomplish the intended task? | Task observations and outcome evidence in realistic context          | Understandable, useful behavior; remaining gaps explicitly recorded                  |
| Deliver and learn | Is it ready for its intended use, and what happens next?        | Release decision, known limits and follow-up observations            | Appropriate operational checks and explicit release authority; no exaggerated claims |

For current UX discovery, use the collaborative sequence owned by [ux-plan.md](ux-plan.md): task → information hierarchy → rough layout alternatives → interaction states → component selection → visual treatment/testing. Discuss meaningful decisions with the owner instead of delivering a complete UI in one shot. Source realistic workflows independently, understand why the coordination exists, and label illustrative adaptations separately from observed work.

For UI changes, visual composition and information hierarchy are part of the behavior, not cosmetic enrichment after functional work. Before product implementation, show materially different overview and task-state alternatives at representative sizes and obtain the owner's direction. Preserve proven data/command invariants rather than treating existing screens or implementation cost as constraints on design. A reviewer may reject the whole composition; repeating local fixes after concept rejection is not iteration toward acceptance. Do not replace a requested visual relationship map with a text register solely because it is easier to implement or test. Separate technical verification, simulated critique and owner visual acceptance in completion claims; use [the current UX direction](ux-plan.md#current-direction--visual-reset-after-owner-rejection) for this project.

This is not a requirement to create nine standalone reports. Reuse a short specification/issue for a selected slice, link stable need/story IDs and record the evidence. Documentation depth should match uncertainty, risk and coordination needs. Formal governance may require more, but that must be established separately.

## 3. Needs, stories and specifications are different

- **Need:** the problem/outcome, such as understanding unresolved design obligations. It should survive a change of UI concept.
- **Story/scenario:** the user's intent in context, such as resolving one missing verification relationship without losing the working branch.
- **Specification:** chosen observable behavior, exact semantics, constraints, failure handling and applicable interaction design.
- **Design:** how the software and interaction will realize that behavior; it can change while preserving the outcome/specification.
- **Verification:** evidence that the implemented candidate meets the specification.
- **Validation:** evidence that it solves the intended problem for the intended users/context.

A sentence beginning “As a user…” is not automatically a researched need or a sufficient specification. A list of pages is not a journey. Test counts are not usability evidence.

### Thin-slice specification outline

Once a concept/story has been selected, use one short document or existing issue containing:

1. Need/story references and evidence; intended user, task and outcome.
2. Scope, boundaries and explicit non-goals.
3. Input/context and the expected end-to-end interaction.
4. Observable functional behavior and acceptance examples, including exceptions.
5. Precise data/relationship/coverage/evidence semantics where relevant.
6. Constraints: performance workload, accessibility, safety/security, compatibility and preservation of drafts/history.
7. Implementation approach using existing boundaries; unresolved risks/decisions.
8. Verification checks and a realistic user-validation plan, chosen before coding.
9. Completion evidence, known gaps and follow-up learning.

Use quantitative thresholds when justified by task/environment evidence or an explicit engineering budget. Do not fabricate benchmark targets or treat a synthetic fixture as a real user's workload. Scope constraints may be practical project decisions but must be labeled as such.

### Example trace, not an approved feature specification

`PN-04 meaningful gaps → ND-04 resolve a gap → selected slice/spec → implementation → checks → observed task result`.

A candidate specification might state: under a chosen source/relationship/target expectation, an active source is a structural gap when no qualifying active target connection exists. Specify applicability, filters, pagination scope and failure behavior; test off-page connections. Validate separately whether this definition helps the engineer choose the right next action. It cannot assert correct verification simply because a connection exists.

Maintain this trace using links/IDs in existing documents or issues. Do not build a new traceability administration system merely to manage our own development.

## 4. Verification and validation: both, throughout

NASA distinguishes product verification as proof of compliance with requirements and validation as accomplishing the intended purpose in the intended environment. It also describes validation during development, not only at delivery. Borrow the distinction, not NASA's project governance.

For Tracer:

| Verification question                                                                  | Validation question                                                           |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Does a shared-child edit update the single underlying identity?                        | Can the engineer recognize that the repeated child is shared, not duplicated? |
| Does a coverage query include qualifying links beyond the current page?                | Does the gap definition actually represent unfinished work in this project?   |
| Does a stale comparison block silently adopting a new review token?                    | Can the reviewer understand what changed and make an informed assessment?     |
| Does an explicit quantitative rule calculate correctly with defined units/assumptions? | Is that model appropriate to the actual engineering reasoning?                |
| Are keyboard interactions and focus behavior technically correct?                      | Can users complete the task with their access needs and working environment?  |

Verification can include unit, integration, browser, security, accessibility, performance, analysis and manual inspection checks as appropriate. User validation includes observed task performance, comprehension, assistance/errors and recovery. Separate functional defects from concept failures; changing the concept may be the correct repair.

A useful V-model idea is to pair lower-level specifications with verification and higher-level user intent with validation. It does not require freezing every requirement upfront or deferring user feedback until the end.

## 5. Small readiness/completion decisions

**Ready enough to implement:** selected task and concept, explicit scope, adequate evidence, understandable behavior, safety/failure cases, checks and a validation plan. Unknowns can remain if bounded and noncritical; solve risky unknowns with targeted experiments rather than pretend certainty.

**Implemented and verified:** code meets its agreed behavior and checks, with a reviewable candidate and documented limitations. This is not automatically user-validated or release-ready.

**Validated for a stated task/context:** representative task evidence supports usefulness/comprehension; who participated and what was tested are stated. A product-owner walkthrough is provisional evidence, not population-wide validation.

**Ready for release:** appropriate usefulness, correctness and operational evidence, with no unresolved critical dependencies and explicit owner authority. Delivery work does not automatically authorize a release, deployment or regulated sign-off.

After a sustaining change, reconsider affected specs, checks and user scenarios; retain unchanged passing evidence when its coverage remains applicable. Discovery remains active instead of treating the first design decision as permanent.

## 6. Foundational reading and deliberate synthesis

The goal is not to reproduce one author's methodology or speculate about what Steve Jobs would read. Study complementary ideas, identify their context, form a coherent product point of view and test it against actual work.

This initial selection uses author/publisher material and primary guidance linked below; it is **not a claim that the complete books have been read or their advice independently validated for Tracer**. Further reading should target unresolved decisions rather than become a prerequisite for all progress.

| Source / authors                                                                | Principle worth investigating                                                   | Tracer application / limit                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Don Norman, _The Design of Everyday Things_                                     | Understandable conceptual models, discoverability, signifiers and feedback      | Users should understand selection, scope, available actions and consequences. A clean-looking screen alone does not accomplish this.                                                  |
| Alan Cooper, Robert Reimann, David Cronin and Christopher Noessel, _About Face_ | Goal-directed interaction design                                                | Design for authoring/change/review scenarios, not a tab inventory. Roles/personas must come from evidence, not fiction.                                                               |
| Teresa Torres, _Continuous Discovery Habits_                                    | Connect desired outcomes, user opportunities, alternatives and assumption tests | Keep needs separate from solutions and compare concepts. A framework diagram is not discovery evidence.                                                                               |
| Frederick Brooks, _The Mythical Man-Month_                                      | Conceptual integrity                                                            | Choose a coherent interaction model rather than accumulate unrelated pages. Coherence does not justify ignoring contradictory user evidence.                                          |
| David Parnas, “On the Criteria To Be Used in Decomposing Systems into Modules”  | Hide changeable decisions behind appropriate module boundaries                  | Preserve the canonical engine while UI concepts evolve. Do not translate the principle into needless abstractions.                                                                    |
| Robert C. Martin, _Clean Code_, _Clean Architecture_, _Clean Agile_             | Code/design discipline, separation of concerns and iterative development        | Useful for reliable implementation and evolvable boundaries; not a substitute for deciding the right product. Evaluate specific prescriptions rather than applying them mechanically. |
| David Thomas and Andrew Hunt, _The Pragmatic Programmer_                        | Practical, adaptable software craftsmanship                                     | Favor feedback and changes that remain understandable/reversible. Pragmatism does not mean skipping safety or correctness.                                                            |
| Nicole Forsgren, Jez Humble and Gene Kim, _Accelerate_                          | Delivery capabilities, feedback and empirical delivery-performance research     | Small changes and automated checks help learning/reliability. Delivery metrics do not establish UX quality; reported relationships are not proof of effects in this project.          |

Marty Cagan's value/usability/feasibility/viability risk framing is another useful question set: will users choose it, can they use it, can we build it, and can it work within product/operational constraints? Test those questions; do not assume a particular company/team structure is mandatory.

### Our provisional synthesis

1. **Organize around engineering intent, not data-model terminology or inherited tabs.**
2. **Make one coherent working model legible across levels and representations.** Same identity, scope and safety; different contextual exposure of actions.
3. **Make complexity explicit only when it helps.** Ordinary prose is valid; quantitative structure, schema detail and dense network context are optional depth.
4. **Provide direct action with visible consequences and recovery.** Simplicity is not hiding uncertainty, scope or save state.
5. **Treat change as normal.** Parent/child relationships and evidence are not frozen; proposed changes need explainable consequences and retained judgment.
6. **Choose by task evidence, not polish, author reputation, implemented code or popularity.**
7. **Build small, check deliberately, learn early.** Passing specifications and usefulness are separate claims, both important.

These are design hypotheses and engineering commitments, not a proof of the “best UX.” Test them in the ND/SC journeys, including a contrasting domain and accessibility needs. Conflicting advice should be resolved by the task, risk and evidence—not by counting how many books endorse it.

### Reading priority

For the current uncertainty, begin with Norman/Cooper and Torres: mental models, actual work, goal-directed interaction and discovery. Use Brooks/Parnas/Martin when selecting a coherent design and implementing it without locking the engine to a UI. Use _Accelerate_ for delivery improvement, not as a feature-prioritization or page-design guide. Deep reading and synthesis can proceed alongside a bounded real-task study.

## 7. Reference material and its scope

- [GOV.UK: user research in discovery](https://www.gov.uk/service-manual/user-research/user-research-in-discovery): likely users, current work, frustrations and needs before solution planning.
- [GOV.UK: how alpha works](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works): alternative prototypes, risky assumptions and disposable experiments. Its governance/timelines are context-specific, not Tracer requirements.
- [NASA: fundamentals of systems engineering](https://www.nasa.gov/reference/2-0-fundamentals-of-systems-engineering/): iterative/recursive development and distinct verification/validation objectives. No NASA process mandate adopted.
- [Don Norman: _The Design of Everyday Things_](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/) and [conceptual models/feedback discussion](https://jnd.org/opportunities-and-challenges-for-touch-and-gesture-based-systems/).
- [Wiley: _About Face_, fourth edition](https://newsroom.wiley.com/press-releases/press-release-details/2014/About-Face-The-Essentials-of-Interaction-Design-4th-Edition/default.aspx): publisher description of Goal-Directed Design.
- [Teresa Torres: opportunity solution trees](https://www.producttalk.org/opportunity-solution-trees/): author explanation of outcomes, opportunities, solutions and tests.
- [Brooks: publisher sample](https://www.informit.com/content/images/9780201835953/samplepages/0201835959.pdf): conceptual integrity.
- [Parnas: original paper DOI](https://doi.org/10.1145/361598.361623): module decomposition/information hiding.
- [Pearson: _Clean Architecture_](https://www.pearson.com/en-us/subject-catalog/p/clean-architecture-a-craftsmans-guide-to-software-structure-and-design/P200000009528/9780134494166), [_Clean Agile_](https://www.pearson.com/en-us/subject-catalog/p/clean-agile-back-to-basics/P200000009530/9780135781869), and [InformIT: _Clean Code_, second edition](https://www.informit.com/store/clean-code-a-handbook-of-agile-software-craftsmanship-9780135398579).
- [Pragmatic Bookshelf: _The Pragmatic Programmer_, twentieth-anniversary edition](https://pragprog.com/titles/tpp20/).
- [IT Revolution: _Accelerate_ capabilities](https://itrevolution.com/articles/24-key-capabilities-to-drive-improvement-in-software-delivery/).
- [SVPG: four product risks](https://www.svpg.com/four-big-risks/).

## 8. Current implementation and next decisions

Tracer has one shared map-led browser workspace over its headless core, with separate native example databases. The [UX plan](ux-plan.md) owns the selected interface direction; [architecture](architecture.md) describes implemented boundaries, and the [checkpoint](checkpoint.md) records verification and remaining limitations. Earlier concept proposals and rejected Studio compositions remain historical evidence, not alternate product interfaces.

Prepare the source preview for GitHub using the repository checks and file-review guidance in [Contributing](../CONTRIBUTING.md). Continue product evaluation through concrete tasks in both example projects. Automated correctness checks do not establish usefulness or replace representative user feedback. Scope future feature work from those findings and the owner's current request rather than treating every candidate story as approved.

## Validation milestones

**Vision-derived proof obligations, not a fixed phase schedule or automatic feature authorization.** The initial brief proposed core → interactive views → change management → backend/team validation → extended interfaces. Current delivery is incremental and not ordered by that historical list. Select the next task using current owner priorities, user evidence and the checkpoint; preserve these acceptance questions when choosing scope.

| Milestone                      | Evidence needed                                                                                                                                                                             | Current limit                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Headless core                  | Users/agents can define custom types, create/edit/link arbitrary records, query/traverse them and inspect history without a GUI; demonstrate substantially different domains                | SQLite, shared commands and examples exist; broader user validation remains separate                                    |
| Shared interactive work        | Complete a real author/connect/gap task through appropriate representations with direct manipulation, consistent refresh and limited context switching                                      | One selected UI exists; historical harness interactions are not all delivered product workflows                         |
| Reproducible change management | Reconstruct exact baselines, explain semantic differences and inspect deterministic text comparisons; review and apply changes safely                                                       | Native baselines/scoped comparisons exist; full export/diff/restoration and general proposal review remain future work  |
| Backend and team portability   | Run the same operation/failure/concurrency suite against SQLite and PostgreSQL, then demonstrate authenticated permitted work from concurrent clients without rewriting domain/UI semantics | PostgreSQL and organizational server proof are outstanding; do not defer proof until after claiming multiuser readiness |
| Extended interfaces            | Demonstrate a useful document, agent/MCP, hosted-source integration or review workflow over existing contracts                                                                              | Select only when its task value is evidenced; no plugin/enterprise feature-parity program is implied                    |

The engineering deliverables are reviewable architecture decisions, working core and interaction slices, reproducible history/change examples and eventual adapter-parity evidence. Keep important irreversible tradeoffs and technology rationale in architecture, concrete tasks in journeys, interface decisions in the UX plan and execution receipts in the checkpoint. Test the product against genuinely different workflows rather than manufacturing separate domain implementations.
