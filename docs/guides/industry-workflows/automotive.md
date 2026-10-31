# Automotive product development

[Product development across industries](README.md)

Automotive development connects vehicle behavior, component engineering, suppliers and the production process. A physical configuration and its software can evolve at different rates, while evidence must remain clear about which combination and conditions were evaluated.

## Product quality and production planning

AIAG describes Advanced Product Quality Planning (APQP) as an automotive approach to planning a product from concept through launch. Its Quality Core Tools include APQP, Control Plan, Production Part Approval Process (PPAP), Failure Mode and Effects Analysis (FMEA), Measurement System Analysis (MSA) and Statistical Process Control (SPC). These provide related ways to plan quality and demonstrate control of a product and process. Specific use depends on the program and customer requirements. [AIAG Quality Core Tools](https://www.aiag.org/expertise-areas/quality/quality-core-tools).

AIAG's current APQP material includes change management, risk mitigation and gated management; its Control Plan is a separate manual. These are industry references, not proof of how a particular automaker organizes all its work. [AIAG APQP and Control Plan materials](https://go.aiag.org/apqp-cp).

For an illustrative program, the workflow can be organized as follows:

| Work                         | Example records                                                                    | Main coordination question                                   |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Define the vehicle           | Range, performance, durability, packaging and cost targets                         | What must the vehicle accomplish?                            |
| Allocate engineering         | Battery, motor, structure, electronics and software requirements                   | Which systems contribute to each target?                     |
| Develop and evaluate designs | Prototype configurations, analyses and design evaluation results                   | What behavior has been established?                          |
| Develop production           | Supplier records, process failure analysis, control plans and manufacturing trials | Can the intended process make acceptable parts consistently? |
| Prepare release and support  | Configuration, unresolved findings, acceptance records and field observations      | What evidence applies to the delivered product?              |

This table is an illustrative synthesis. Labels such as design validation (DV) and production validation (PV) need the program's definitions and acceptance criteria; they do not specify one universal test set.

## Functional safety

ISO 26262 addresses road-vehicle functional safety. Its series includes concept and safety-management work, development at system/hardware/software levels, supporting processes, and production/operation activities. Configuration management and change control are among the supporting concerns. This safety scope should remain distinct from general product quality and manufacturing capability. [ISO 26262 overview](https://www.iso.org/publication/PUB200262.html).

## Hardware and software change example

In an illustrative battery-pack program, a change to the permitted discharge current can connect to cells, conductors, connectors, thermal behavior, sensing, control software and vehicle performance. The same target may have several sibling allocations and shared interfaces.

A result might apply to a particular cell revision, pack assembly, cooling configuration and software build. Changing the software limit leaves a question about whether that earlier result covers the new condition. Changing a conductor may also require examination of assembly and inspection work. Remote software delivery changes how a revision reaches the product; it does not by itself establish that the revision is acceptable.

## Tesla as a public company example

The [company practices guide](company-practices.md#tesla) describes Tesla's published crash-data and system-validation examples. Those sources do not establish that Tesla follows every conventional APQP document or stage identically. Automotive industry practices and a particular company's implementation should remain separately attributed.

This automotive guide supplies another reference context for Tracer discovery. No automotive seed, safety-case evaluator or production approval workflow is implemented by the guide.
