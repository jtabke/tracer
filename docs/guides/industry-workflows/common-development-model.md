# Shared development logic and industry differences

[Product development across industries](README.md)

The working synthesis for Tracer is that engineering disciplines share a development logic: establish intent, define a product, implement it, gather evidence, assess changes and decide what can be released or operated. The differences lie in what counts as a requirement, when a design becomes controlled, and what evidence is sufficient for a particular use.

Medical-device experience provides a useful vocabulary for comparison. That vocabulary should help explain other workflows while preserving their terminology and obligations. The [medical](medical-devices.md), [software](software-products.md), [integrated-product](hardware-and-integrated-products.md), [automotive](automotive.md) and [aerospace](aerospace.md) guides provide the supporting references and context.

## Representative comparison

This table summarizes the linked guides. It is a conceptual comparison, not a claim that every organization uses the same internal lifecycle.

| Context             | How work is defined                                                                               | Evidence relevant to readiness                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Medical devices     | Intended use, user needs, product inputs, design allocations and risk controls                    | Verification, intended-use validation, risk evaluation and applicable clinical or usability evidence |
| Commercial aviation | Aircraft functions, system/equipment allocations, interfaces and assurance objectives             | Implementation verification and evidence for the applicable certification basis                      |
| Space programs      | Mission objectives, operational concepts, technical allocations, interfaces and constraints       | Analyses, ground/integrated/flight evaluations and evidence for a particular mission or use          |
| Automotive          | Vehicle targets, system/component allocations, manufacturing requirements and safety-related work | Design and production evaluations, supplier/process evidence and relevant safety assurance           |
| Consumer hardware   | Product attributes, module specifications, integrated designs and build objectives                | Performance, reliability, manufacturing capability and release configuration evidence                |
| Software products   | Customer problems, goals, hypotheses, features, issues and acceptance conditions                  | Implementation checks, rollout evidence, user observations and outcome measurements                  |

The company examples illustrate combinations of these practices. [Apple, Tesla and SpaceX](company-practices.md) are not interchangeable representatives of one process. Their publicly described activities also do not establish a ranking of rigor or effectiveness.

## Translating familiar concepts

These are functional analogies. Similar labels may have different meanings, scopes and approval conditions.

| Familiar medical-device concept | Related aerospace concepts                                          | Related consumer technology or automotive concepts                             |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| User needs and intended use     | Stakeholder expectations, mission objectives, concept of operations | Customer problems, product goals, vehicle targets                              |
| Product requirements or PRS     | System requirements and specifications                              | Product requirements document, product targets, system specification           |
| Subsystem requirements          | Allocated system/equipment requirements                             | Module or component specifications, service responsibilities                   |
| Design inputs                   | Requirements and interface definitions in a controlled baseline     | Engineering specifications, interfaces and acceptance conditions               |
| Design outputs                  | Design definition and implementation artifacts                      | CAD, drawings, bill of materials, electronics, firmware and source code        |
| Risk analysis                   | Safety and failure analyses                                         | Design/process failure analysis, hazards and other product risks               |
| Verification traces             | Requirement-to-method/result connections                            | Design evaluations, test links and scoped implementation evidence              |
| Intended-use validation         | Operational or mission validation                                   | User studies, vehicle-level evaluations and field observations                 |
| Design transfer                 | Production/readiness and acceptance activities                      | Production trials, part approval and ramp readiness                            |
| Change control                  | Configuration management and baseline changes                       | Engineering changes, controlled production changes and software change reviews |

A product requirements document can be an evolving coordination document, as [Atlassian describes](https://www.atlassian.com/agile/product-management/requirements). Its existence does not establish the same controls as a formal design-input baseline. Likewise, a hardware DVT build is a development stage; it does not map exactly onto medical-device design verification. See the [hardware phase guide](hardware-and-integrated-products.md#prototype-and-manufacturing-progression) for the build context.

Risk-analysis techniques and approval records also retain their own scope. A software pull request records a proposed code change and its review; additional connections are needed to understand a product-level configuration or an assurance decision.

## Three dimensions for comparison

These dimensions are a conceptual lens for Tracer discovery, not measured company scores or a substitute for applicable requirements.

| Dimension                      | Questions to ask                                                                                           | Consequence for the records worth keeping                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Consequences of failure        | What can be harmed or lost? Under which operating conditions?                                              | Preserve hazards, assumptions, limits and the evidence supporting safeguards.     |
| Cost and difficulty of change  | Can a correction be deployed remotely? Does it require tooling, rework, replacement or another evaluation? | Preserve dependencies, released configurations and production/operational impact. |
| Demonstration to other parties | Who must accept the result: the team, a customer, an independent reviewer or a certification authority?    | Preserve applicable obligations, agreed criteria, review scope and dispositions.  |

These dimensions can differ within one product. A vehicle's mechanical tooling, embedded control software and companion app may have different change costs and release conditions. The label “software” alone does not make a correction inexpensive or low consequence.

Iteration speed is a separate consideration. In the [Starbase interview](https://everydayastronaut.com/starbase-tour-and-interview-with-elon-musk/), Musk describes different failure tolerances for experimental Starship work and crewed Dragon. A test article's acceptance conditions need to be understood in relation to its objective and intended operation.

## Requirements experiments and controlled commitments

An uncertain product idea can be recorded as a hypothesis and evaluated through an experiment. A candidate requirement may change when that evidence changes. GitLab's [validation and build tracks](https://handbook.gitlab.com/handbook/product-development/how-we-work/product-development-flow/) provide a public example of uncertainty being investigated alongside delivery.

A controlled requirement, contractual obligation or safety limit needs its own authority and change conditions. It should retain the rationale, source, status and versions relevant to any evaluation. A hypothesis, a proposed requirement and an approved commitment can be linked while remaining distinct records. An experiment result also needs enough scope to explain what it established and what remains unknown.

The practical distinction is when uncertainty must be resolved and when a definition becomes controlled. Iteration can continue after that point through an appropriate change process.

## The shared question for Tracer

**What do we currently believe about this product, what evidence supports that belief, and what needs reconsideration because something changed?**

For exploration, that question can be broken into six connected tasks:

- **Intent:** understand the problem and the expected outcome.
- **Definition:** identify the behavior, constraints and current decisions.
- **Implementation:** identify the designs, components and code contributing to it.
- **Evidence:** examine tests, analyses, experiments and operational observations with their scope.
- **Change:** find connected assumptions, interfaces and prior evaluations that need review.
- **Release:** identify the evidence applicable to the exact configuration being delivered or operated.

This is a cross-industry discovery model, not a prescribed schema or a claim that Tracer computes product truth or release readiness. Native relationships and revisions can preserve context; receipts can preserve evaluated inputs. Technical validity and sufficiency still require a scoped judgment. [Delivered example walkthroughs](../realistic-examples.md) make some of these tasks concrete.
