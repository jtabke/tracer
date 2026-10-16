# Motor-change image concepts

**Status:** historical static, generated visual hypotheses; the owner found them insufficiently realistic/impactful (UR-8). None is a selected design, implemented feature, validated device model or complete concept sequence. They are not the current design direction.

Open [index.html](index.html) directly in a browser to browse the images locally; no server or MCP is required. The images are also shown in the generation conversation. Illustrated buttons are not interactive. Original tool outputs are retained; these named copies are the project artifacts.

## Same task, different entry points

Source: UR-6 and the [worked sustaining scenario](../../user-journeys.md). An engineer proposes a software motor-limit change in an electromechanical medication-delivery device, then investigates possible consequences across disciplines and system-level intent. No actual limit type, values, requirement text or dependency/evidence artifacts have been supplied.

| Concept                                        | Organizing hypothesis                                                                                     | Walkthrough question                                                                                           | Main risk to challenge                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [A — Change-first](a-change-first.png)         | Begin with a draft proposal and investigate the items that might need assessment.                         | Starting from your proposed software edit, where would you look to understand why mechanics needs attention?   | A prefilled investigation list can look like computed, complete impact even when its scope/reasons are only illustrative. |
| [B — System-first](b-system-first.png)         | Keep unchanged system intent visible while inspecting contributing implementation and evidence questions. | How would you investigate the software change without losing the system requirement you are trying to satisfy? | A visual network may imply validated dependencies or become hard to navigate at scale.                                    |
| [C — Comparison-first](c-comparison-first.png) | Inspect a proposed difference alongside unchanged information and unresolved questions.                   | What changed, what stayed unchanged, and what would you investigate before a decision?                         | Placeholder differences do not establish whether real long-form/quantitative comparisons would be useful.                 |

Common task: propose the change → identify what may need investigation and why → explain why the system requirement can stay unchanged → identify evidence questions without declaring evidence valid/invalid → capture a question for human assessment.

These entry-point experiments do not replace the broader working-set/document/spreadsheet alternatives in [ux-plan.md](../../ux-plan.md), prove new-design authoring fit, or complete failure/recovery sequences. Compare the concepts before blending them.

## Inspection and limitations

- A keeps proposal, reasons and a contextual question visible. Its generated proposal wording about a “different drive response” is illustrative filler, not user-supplied change intent.
- B visibly retains “Unchanged intent” and “Needs assessment”, but the generator added arrowheads and particular software/motor and mechanics/evidence connections. **Their existence and direction are not established.** Do not interpret them as a device model, arithmetic dependency or proof. An editable successor should clarify or replace them using actual artifacts.
- C aligns current/proposed rows and keeps evidence applicability unknown. “Existing” versus “Proposed” is a placeholder difference, not an actual motor-limit delta. “Unchanged” configuration/design is also illustrative—not a conclusion that those parts will remain unchanged after assessment.
- Text labels and control shapes are readable in the inspected outputs, but are pixels, not accessible controls or editable entities. Interaction, narrow-layout behavior, conflict/recovery, evidence semantics and user usability have not been tested by these images.
- All images include a concept/illustrative/not-assessment banner. No medical values, passing test results, automatic requirement rewriting or approval outcome are presented. No real artifacts were uploaded.

## Generation receipt

## Next

Do not refine these images as the default successor. Follow [ux-plan.md](../../ux-plan.md#7-immediate-next-step): source-grounded formal/lightweight workflows, collaborative task/information decisions, then rough editable layouts and interaction states. No new coded prototype, production implementation or MCP/container setup is authorized by this image exploration.
