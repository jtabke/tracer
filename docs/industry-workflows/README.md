# Product development across industries

Engineering industries share a product-development logic: establish intent, define and implement a product, gather evidence, assess changes and decide what can be released or operated. They differ in how they define requirements, control changes and demonstrate readiness. This section explains those differences so Tracer can support hierarchy, sibling responsibilities, shared dependencies and learning through successive builds.

**Status:** reference guidance from publicly documented practices, with explicitly illustrative trace models. Industry names do not select a mandatory schema, approval process or feature backlog. Rigor depends on intended use, failure consequences, applicable obligations and the maturity of the work.

## Workflow guides

Start with [Shared development logic and industry differences](common-development-model.md) for the cross-industry comparison, medical-device terminology crosswalk, and the three dimensions of failure consequences, change cost and independent demonstration. Iteration speed and assurance rigor are separate considerations: rapid experimentation can coexist with demanding evidence for a particular operational use.

| Context                          | Development emphasis                                                                                               | Read more                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Medical devices                  | Intended use, design inputs and outputs, risk controls, verification, validation and controlled changes            | [Medical devices](medical-devices.md)                                   |
| Software products                | Problem and solution discovery, incremental implementation, release and feedback                                   | [Software products](software-products.md)                               |
| Hardware and integrated products | Engineering tradeoffs, parallel physical/software work, prototype configurations and manufacturing readiness       | [Hardware and integrated products](hardware-and-integrated-products.md) |
| Automotive                       | Vehicle/system allocation, supplier and production quality, functional safety and mixed hardware/software releases | [Automotive](automotive.md)                                             |
| Aviation and spaceflight         | System allocation, interfaces, assurance, configuration and mission evidence                                       | [Aerospace](aerospace.md)                                               |
| Apple, Tesla and SpaceX          | Selected public examples of integrated design, testing and iteration                                               | [Company practices](company-practices.md)                               |

The comparison is a synthesis of the sources cited in each guide. It describes useful organizing patterns rather than one process followed by every organization. A software service can have demanding assurance obligations; a spacecraft prototype can have exploratory work alongside formal flight requirements.

## Several structures coexist

A development program can have a product breakdown, a physical assembly structure, a software architecture, a work backlog and a sequence of tested configurations. These structures answer different questions:

| Structure                          | Question                                                          | Illustrative relationship                    |
| ---------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Intent and requirements            | Why is this behavior needed, and how is responsibility allocated? | Need → requirement → subsystem allocation    |
| Physical and software architecture | What makes up the product, and what depends on what?              | Assembly → component; service → interface    |
| Decisions and experiments          | Why was this option chosen, and what changed our understanding?   | Hypothesis → experiment → finding → decision |
| Delivery work                      | What work implements a behavior or changes an artifact?           | Story → work item → code or drawing revision |
| Configuration and evidence         | What exact combination was evaluated, and what did it establish?  | Build configuration → evaluation → result    |
| Safety and assurance               | What failure matters, and which measures address it?              | Hazard → control → allocated requirement     |

Hierarchy supports decomposition and sibling comparison. Dependencies, interfaces and shared responsibility require additional connections. One motor can contribute to several functions; one synchronization module can support several features. A review or experiment result also has a relationship to the versions it considered.

## Questions to use when exploring Tracer

- Can an engineer follow a product goal down to the responsible hardware and software work?
- Can they compare siblings and see shared items without copying them?
- Can they distinguish a proposed concept, an implemented revision and an evaluated build?
- Can they see the scope and limitations of a result, including untested interfaces or conditions?
- Can they find the connected decisions and evidence that need review after a change?

These are exploration questions, not claims that the current application automatically answers them. Tracer's native links, revisions and receipts provide a foundation; schema permissions alone do not define completeness, approval or conformance.

## Existing examples and next example directions

The [seed walkthrough](../realistic-examples.md) owns runnable example content. Aster Home BP illustrates a medical design-and-development file; Gatherline illustrates a software app; Orbit R1 illustrates combined hardware/software development. All are fictional and include concepts, configuration annotations and explicit assessments.

Orbit connects cleaning targets, mechanical/electrical/software allocations, proposed and recorded build configurations, experiments and findings. Its descriptive manifests expose the distinction between storing a revision label and guaranteeing a pinned configuration. The [engineering workspace slice](../industry-workspace-slice.md) owns the capability audit and UI proposals. A flight-control actuator remains a possible aerospace example connecting interfaces, safety allocations and baseline evidence; no aerospace seed is delivered.

[Tracer's development flow](../development-flow.md) owns how this project selects and implements work. [User needs](../user-needs.md) owns the discovery evidence. [Checkpoint](../checkpoint.md) owns delivery progress and verification receipts.

## Further vision contexts

These candidate contexts preserve the domain breadth of [the product vision](../user-needs.md#scope-generality-and-limits); they are not delivered industry modes or compliance claims.

- **Manufacturing and quality:** connect product specifications, components/suppliers, process parameters, inspection criteria, nonconformances and corrective actions. Supplier/process change investigations can cross into design requirements and software. The [hardware guide](hardware-and-integrated-products.md) supplies related manufacturing context.
- **Research and experimentation:** connect questions/hypotheses, experiments, configurations, datasets/results and evidence-backed conclusions. Reproducibility and retained input context matter without requiring a requirements-management hierarchy; the offline research example exercises part of this.
- **Regulatory evidence:** connect applicable clauses, internal policies, controls, evidence and audit findings, keeping applicability, actual assessment and missing evidence explicit. Storing these records does not establish regulatory compliance.

Medical-device, software and aerospace examples and guides already cover other original reference contexts. All contexts may coexist in a project through the same typed entities and relationships; no artificial domain boundary or universal approval process is introduced.
