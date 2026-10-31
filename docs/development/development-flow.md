# Tracer development flow and design principles

**Status:** proposed working method; not a compliance procedure or feature/release authorization.

Use [needs](user-needs.md), [journeys](user-journeys.md), [UX direction](ux-plan.md) and [architecture](../architecture.md) to connect real tasks to testable behavior and usefulness.

## 1. The flow: a feedback loop, not a one-way document chain

Begin by establishing or checking the development model for the task: what information means, how it connects and how progress will be judged. Use one concrete example before authoring or importing many records. A valid schema establishes permitted data; a semantic review establishes whether that structure fits the work. Reuse a suitable model and revisit it when the work changes, rather than requiring a comprehensive up-front specification.

The owner selected this model-first direction on 2026-10-21 and the [Tracer development model](development-model.md) on 2026-10-23. The [audit](archive.md) explains its rationale. Current work selection stays in the [live register](register.md); requirements allocate to system components and verification plans identify acceptance checks separately from executed evidence.

**Context → needs → journeys → alternatives → selected slice/specification → implementation → verification → user validation → learning.**

Revisit decisions when evidence challenges them. Validate assumptions through tasks/prototypes before specifying the whole product; plan checks while defining behavior. Discovery and delivery inform each other.

Compare formal medical/aerospace and lighter software tasks from the outset. Rigor follows task, risk and obligations. [Industry guides](../guides/industry-workflows/README.md) supply reference contexts; they do not impose Tracer's process, schema or backlog.

## Standards applicability and conformance

**Selected documentation direction, 2026-10-24:** use established engineering standards to challenge Tracer's semantics and make future interoperability explicit. The [applicability inventory](specifications/standards-applicability.json) owns editions, source URLs, reviewed material, mapped requirements/plans, design questions and known gaps. It is a design review inventory, not a clause-complete compliance matrix or an approved integration backlog. The register owns delivery selection and verification status.

Distinguish design reference, future interchange/integration target, and an explicitly selected normative conformance profile. A standard appearing in the inventory creates no blanket product obligation. Process standards concern how a project/organization works; tool support is not proof that a customer's process conforms. Standards used as design references do not mandate Tracer's internal storage schema, universal record types or one engineering lifecycle.

Prioritize ISO/IEC/IEEE 29148:2018 for requirements-engineering questions, ReqIF 1.2 for future exchange compatibility, W3C Web Annotation for source/selector/state separation, and PROV-O for qualified usage/provenance. Public ISO summaries establish scope only: applicable clauses require review of authorized normative text before a clause-level assessment. The ISO catalogue currently identifies 29148:2018 as current and under revision; retain the selected edition and assess a successor deliberately rather than silently changing requirements. ReqIF remains a candidate exchange target; native recorded-project JSON export is neither ReqIF nor a claim of lossless cross-tool exchange.

For a selected conformance capability, record exact standard/edition, applicable normative provisions, supported profile/direction, exclusions and rationale, mapped Tracer criteria, candidate/version-specific checks and actual results. Report unsupported or lost semantics explicitly. Keep partial mapping and unknown coverage separate from conformity. Cross-tool exchange needs external fixtures/round trips as well as schema validity; reference passage/state semantics and native history/evaluations may require a declared extension or remain outside a chosen profile.

ISO/IEC/IEEE 15288/12207, ISO/IEC 25010 and NIST SSDF inform process, quality and secure-development reviews. OSLC and SysML remain future integration references. Industry-specific obligations are selected by intended use/customer context; example projects do not adopt them automatically. Use the inventory to identify relevant gaps during slice specification, without requiring implementation of every referenced standard before useful local work.

## 2. Practical stages and outputs

| Stage            | Useful output                                   | Advance when                                      |
| ---------------- | ----------------------------------------------- | ------------------------------------------------- |
| Understand work  | Concrete task/artifact and sourced needs        | Assumptions and unknowns are visible              |
| Frame outcomes   | Need, journey and success conditions            | User recognizes the outcome                       |
| Explore concepts | Alternative task sequences and assumption tests | Major value/usability risks are investigated      |
| Select a slice   | Complete bounded task, risks and exclusions     | Selection is deliberate; critical risks addressed |
| Specify          | Observable behavior and acceptance examples     | Semantics are precise enough to implement/check   |
| Implement        | End-to-end change within existing boundaries    | Invariants are preserved                          |
| Verify           | Candidate-specific automated/manual results     | Relevant checks pass                              |
| Validate         | Representative task observations                | Usefulness and remaining gaps are evidenced       |
| Deliver/learn    | Release decision, limits and follow-up          | Operational evidence and release authority exist  |

For UX: task → information hierarchy → layout alternatives → interaction states → components → visual evaluation. Compare realistic task states at representative widths and preserve native contracts. See [design principles](ux-plan.md#design-principles).

Use one short specification or issue per slice, linking need/story IDs and evidence. Documentation depth should match uncertainty, risk and coordination needs.

## 3. Needs, stories and specifications are different

- **Need:** problem/outcome that survives UI changes.
- **Story:** user intent in a concrete context.
- **Specification:** selected observable behavior, semantics, constraints and failures.
- **Design:** how the implementation realizes that behavior.
- **Verification:** evidence of conformance to the specification.
- **Validation:** evidence of usefulness for intended users/context.

A story template is not research, a page list is not a journey, and test counts are not usability evidence.

### Thin-slice specification outline

Record:

1. Need/story evidence, user, task and outcome.
2. Scope, exclusions, inputs and end-to-end interaction.
3. Observable behavior, exceptions and precise data/evidence semantics.
4. Performance, accessibility, safety/security, compatibility and draft/history constraints.
5. Implementation boundaries, risks and unresolved decisions.
6. Verification and realistic user-validation plans, defined before coding.
7. Completion evidence, limitations and follow-up.

Quantitative thresholds need task evidence or an explicit engineering budget. Synthetic fixtures are not real-user workloads.

### Example trace, not an approved feature specification

`PN-04 meaningful gaps → ND-04 resolve a gap → selected spec → implementation → checks → observed task result`.

For a chosen source/link/target expectation, a structural gap could mean no qualifying active connection. Specify applicability, filters, paging and failures; test off-page links. Separately validate whether the gap helps users choose next work. A connection does not prove verification. Maintain trace through existing links/IDs rather than building internal administration tooling.

## 4. Verification and validation: both, throughout

Pair specification checks with task evidence:

| Verification                                   | Validation                                 |
| ---------------------------------------------- | ------------------------------------------ |
| Shared-child edit updates one identity         | User recognizes shared identity            |
| Coverage includes off-page links               | Gap represents unfinished work             |
| Stale comparison cannot silently adopt a token | Reviewer understands the change            |
| Quantitative rule respects units/assumptions   | Rule reflects actual engineering reasoning |
| Keyboard/focus behavior is correct             | Task works with users' access needs        |

Use unit, integration, browser, accessibility, security, performance or inspection checks as relevant. Observe completion, comprehension, assistance, errors and recovery. Distinguish implementation defects from concept failures. NASA's verification/validation distinction is useful; its governance is not adopted.

## 5. Small readiness/completion decisions

- **Ready to implement:** selected task/concept, bounded scope, sufficient evidence, failure handling, checks and validation plan. Experiment on risky unknowns.
- **Implemented/verified:** agreed behavior passes checks; candidate and limits are reviewable.
- **Validated:** representative task evidence supports a stated use/context. Owner walkthroughs remain provisional.
- **Release-ready:** appropriate usefulness, correctness and operational evidence, resolved critical dependencies and explicit authority.

After sustaining changes, reassess affected specs, checks and scenarios. Retain passing evidence where its coverage remains applicable.

### Foundation changes and efficient growth

**Owner-selected direction, 2026-10-25:** build on the [primitive contracts](../architecture.md) and the executable repository contract. Each foundation slice must identify the engineering task or concrete failure it improves, retain stable identity/history and scoped evidence semantics, and include success, rejection and recovery checks at the owning boundary. A failed transaction must leave both recorded state and the next transaction usable. Domain/application modules stay portable; platform scheduling, files, databases and transport remain behind their existing boundaries.

Use measured task workloads to choose indexing, pagination, batching or another adapter. Record bounds and partial/unknown results explicitly. Preserve shared human/agent commands and queries as deployment grows. A new provider must satisfy the same identity, atomicity, concurrency, history and evidence contracts before support is claimed. Improve maintainability through focused ownership changes backed by regression evidence; keep quality thresholds and dependency gates intact. Record future delivery selection in the register rather than turning architectural possibilities into an automatic implementation queue.

## 6. Foundational reading and deliberate synthesis

This selection draws on author/publisher material, not complete-book review or proven Tracer results. Use reading to resolve decisions alongside task studies.

| Source                                  | Application                                                |
| --------------------------------------- | ---------------------------------------------------------- |
| Norman, _The Design of Everyday Things_ | Conceptual models, discoverability and feedback            |
| Cooper et al., _About Face_             | Goal-directed tasks; evidence-based roles                  |
| Torres, _Continuous Discovery Habits_   | Outcomes, opportunities, alternatives and assumption tests |
| Brooks, _The Mythical Man-Month_        | Coherent interaction model                                 |
| Parnas, module decomposition paper      | Hide changeable decisions behind boundaries                |
| Martin, _Clean Code/Architecture/Agile_ | Implementation discipline and separation of concerns       |
| Thomas/Hunt, _The Pragmatic Programmer_ | Adaptable, understandable changes and feedback             |
| Forsgren/Humble/Kim, _Accelerate_       | Small changes, reliable delivery and feedback              |

SVPG's value/usability/feasibility/viability questions complement these ideas. None substitutes for task evidence or mandates a team structure.

### Our provisional synthesis

Organize around engineering intent; retain one coherent identity/scope model across views; expose complexity when useful; provide direct actions with visible consequences and recovery; expect change; choose by task evidence; build and learn in small slices. Test these commitments across ND/SC journeys, domains and access needs.

### Reading priority

Start with Norman/Cooper/Torres for current UX uncertainty. Use Brooks/Parnas/Martin for coherent implementation boundaries and _Accelerate_ for delivery improvement. Resolve conflicting advice through task, risk and evidence.

## 7. Reference material and its scope

- [GOV.UK: user research in discovery](https://www.gov.uk/service-manual/user-research/user-research-in-discovery).
- [GOV.UK: how alpha works](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works).
- [NASA: fundamentals of systems engineering](https://www.nasa.gov/reference/2-0-fundamentals-of-systems-engineering/).
- [Don Norman: _The Design of Everyday Things_](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/) and [conceptual models/feedback discussion](https://jnd.org/opportunities-and-challenges-for-touch-and-gesture-based-systems/).
- [Wiley: _About Face_, fourth edition](https://newsroom.wiley.com/press-releases/press-release-details/2014/About-Face-The-Essentials-of-Interaction-Design-4th-Edition/default.aspx).
- [Teresa Torres: opportunity solution trees](https://www.producttalk.org/opportunity-solution-trees/).
- [Brooks: publisher sample](https://www.informit.com/content/images/9780201835953/samplepages/0201835959.pdf).
- [Parnas: original paper DOI](https://doi.org/10.1145/361598.361623).
- [Pearson: _Clean Architecture_](https://www.pearson.com/en-us/subject-catalog/p/clean-architecture-a-craftsmans-guide-to-software-structure-and-design/P200000009528/9780134494166), [_Clean Agile_](https://www.pearson.com/en-us/subject-catalog/p/clean-agile-back-to-basics/P200000009530/9780135781869), and [InformIT: _Clean Code_, second edition](https://www.informit.com/store/clean-code-a-handbook-of-agile-software-craftsmanship-9780135398579).
- [Pragmatic Bookshelf: _The Pragmatic Programmer_, twentieth-anniversary edition](https://pragprog.com/titles/tpp20/).
- [IT Revolution: _Accelerate_ capabilities](https://itrevolution.com/articles/24-key-capabilities-to-drive-improvement-in-software-delivery/).
- [SVPG: four product risks](https://www.svpg.com/four-big-risks/).

## 8. Current implementation and next decisions

[Architecture](../architecture.md) owns implemented contracts, [UX planning](ux-plan.md) owns interface decisions and [checkpoint](../checkpoint.md) owns progress/check results. Scope future work from concrete tasks, evidence and the current owner request; candidate stories and historical concepts are not an approved backlog. Use [Contributing](../../CONTRIBUTING.md) for repository checks.

## Validation milestones

**Vision-derived proof obligations, not a delivery schedule or feature authorization.** Choose work using owner priorities, evidence and the checkpoint.

| Milestone                      | Evidence needed                                                                                                                                                                             | Current limit                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless core                  | Users/agents can define custom types, create/edit/link arbitrary records, query/traverse them and inspect history without a GUI; demonstrate substantially different domains                | SQLite, shared commands and examples exist; broader user validation remains separate                                                                      |
| Shared interactive work        | Complete a real author/connect/gap task through appropriate representations with direct manipulation, consistent refresh and limited context switching                                      | One selected UI exists; historical harness interactions are not all delivered product workflows                                                           |
| Reproducible change management | Reconstruct exact baselines, explain semantic differences and inspect deterministic text comparisons; review and apply changes safely                                                       | Native baselines/scoped comparisons and recorded-project JSON export exist; whole-project diff/restoration and general proposal review remain future work |
| Backend and team portability   | Run the same operation/failure/concurrency suite against SQLite and PostgreSQL, then demonstrate authenticated permitted work from concurrent clients without rewriting domain/UI semantics | PostgreSQL and organizational server proof are outstanding; do not defer proof until after claiming multiuser readiness                                   |
| Extended interfaces            | Demonstrate a useful document, agent/MCP, hosted-source integration or review workflow over existing contracts                                                                              | Select only when its task value is evidenced; no plugin/enterprise feature-parity program is implied                                                      |

Keep tradeoffs in architecture, tasks in journeys, interface decisions in the UX plan and execution evidence in the checkpoint. Test different workflows through the same core.
