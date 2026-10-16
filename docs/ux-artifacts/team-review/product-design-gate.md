# Project studio design gate

Status: independent AI product-manager/UX critique, October 13, 2026. This is simulated design review, not customer research, owner acceptance or implementation approval. No native application code was changed for this review.

## Verdict

**The design is not settled. Keep native UI implementation paused.** The current study is useful for reviewing a scoped engineering investigation and the placement of its inspector. It does not yet establish a complete application design. Passing interaction checks or improving its spacing would not close that gap.

The strongest candidate principle is a stable working scope with representations and inspection states around it. This follows the vision's one canonical model and multiple useful interfaces. It should remain a hypothesis under review, rather than a justification for retaining the existing routes or components.

## Evidence inspected

- the product vision in `docs/user-needs.md`, especially UN-001–005; owner needs UR-17–22 in `docs/user-needs.md`; the candidate new-design and sustaining-change journeys in `docs/user-journeys.md`; the current direction in `docs/ux-plan.md`.
- [Studio product design recommendation](studio-product-design.md), which is explicitly a recommendation, not approval.
- Local interactive study at `http://127.0.0.1:4350/`, using the independent `tracer-design-gate-pm` Playwright CLI session. Reviewed both variants at 1440 × 1000, plus the focused variant at 390 × 844.
- Interactions: initial requirement scope → evaluation selection → captured design comparison → receipt review; Project, Evaluations and Configurations destinations; Model → Configure Visual/Text entry. This review inspected the proposed states, not native persistence or backend correctness.

## What the study does establish

The initial scope stays REQ-R03 while the selection changes. Current item statements have one readable contextual location instead of a duplicated read card and editor. The graph, scope title and inspector perform different jobs: topology, origin and selected content. Repeating a short key in those contexts is useful orientation, not automatically redundant information.

The captured comparison gets a full-width reading surface with captured v1 and current v2 side by side. A visible return action names the original requirement scope. This is a stronger proposal than fitting a long before/after comparison into a narrow item panel. Captured configuration, changed inputs and review status are separately named; none is presented as release approval.

The model diagram correctly supplies requirement criteria and the design under test as separate inputs. Its starter excerpt is explicitly distinguished from the actual Orbit trace. Visual and Text are presented as authoring modes over one draft rather than separate models. These are meaningful conceptual improvements.

## Decisions that remain unresolved

| Design question                                            | Current evidence                                                                                                | What is needed before implementation                                                                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What is the application's primary daily job?               | The study leads with one sustaining-change investigation. Authoring and connecting are mainly absent.           | Review one new-design journey and one sustaining-change journey together. Establish which activities are frequent and where each starts and finishes.                                                                                |
| How does a user find or start work?                        | Project contains one prepared working-scope card. Work opens one prepared excerpt.                              | Show an existing project with several scopes and recognizable library/search entry, plus an empty project and a first meaningful item. Recent-work concepts must be labeled if not backed by state.                                  |
| Which destinations and representations deserve prominence? | Five project destinations are consistent; Work exposes Graph and Table only.                                    | Decide the home of All items and the useful advanced representations. Show frequent scope/view controls visibly without rebuilding the old catalogue of unrelated tabs. Do not infer navigation from existing technical projections. |
| How do authoring and connecting retain context?            | An Edit item entry exists, but the reviewed composition does not demonstrate a complete create/connect journey. | Show editing a long sibling requirement, connecting an existing shared design, and returning with the original scope intact. Establish one content authority and one Save/Cancel pair per draft.                                     |
| What does the full model look like?                        | Four starter types and a small criteria branch explain the basic concept.                                       | Show the real project vocabulary with multiple branches and an explicit feedback path, then select a type/connection. A starter chain cannot validate the full model or its configuration experience.                                |
| What constitutes evidence review?                          | A comparison and review form are inspectable; other four inputs are disclosed as a collapsed group.             | Show result identity/outcome as the primary review object, all changed/missing/unknown input states prominently, and matching inputs compactly. Explain whether the judgment concerns one input or the whole captured result.        |
| How do configurations scale?                               | One build shows two selected pinned members with current drift.                                                 | Show configuration selection and complete/bounded membership context, then the exact capture → evaluation transition. Creation may remain a separate task, but its entry and resulting state need a design.                          |
| What happens on interruption or narrow screens?            | Narrow layout stacks navigation and a tall graph; the selected statement sits below the initial viewport.       | Deliberately design the narrow selected-item state and return to context. Show dirty-draft navigation, conflict/failure, loading and empty states. Absence of overflow is insufficient usability evidence.                           |

These are design gaps, not authorization to implement every candidate story or a new workflow engine.

## Docked versus focused

Docked is the stronger **desktop investigation candidate**: a selected statement and connected items remain visible while following the graph. Its narrow inspector wraps long prose heavily, and the illustrated five-node graph cannot establish dense-trace legibility.

Focused offers more width to statements and connected-item reading. At 1440 × 1000, however, this information follows a substantial graph and increases vertical travel. At 390 × 844 the first viewport contains navigation and topology but no selected-item statement or selected-item action. That tradeoff needs an intentional reading/inspection state, not smaller text or further graph controls.

These variants differ chiefly in inspector placement. They should be described as a test of that decision, not two alternative whole-application designs. Neither earns implementation approval from this comparison. A possible adaptive combination also requires review; it is not automatically the winning design.

## Visual hierarchy and information authority

1. **Project:** prioritize recognizable ways to resume or start work. A sparse prepared card is a task entry demonstration, not a finished home design. Counts and example teaching are secondary to work entry.
2. **Work:** scope identity and representation sit above one dominant work surface. Selection identifies the current object; it does not quietly replace the origin. Search, scope choice, create and connect must have intentional positions, rather than being added later wherever space remains.
3. **Evidence:** result identity, recorded outcome, captured configuration and present applicability are distinct facts. Before/after geometry should expose actual changes; copy must state the observation and rationale. Do not use a color or drift badge to imply invalid evidence.
4. **Model:** geometry communicates branches, inputs, outputs and feedback. Labels name the exact authored flow. The selected definition explains native semantics without making the user reconstruct meaning from a dispersed register. Actual item traces remain a different question.
5. **Configuration:** pinned-versus-current columns communicate immutable capture and subsequent drift. Related evaluation context should not replace or alter membership meaning.

Each fact needs a primary home. An item can appear in graph, table and contextual reading because those surfaces serve different jobs; two simultaneous editors or repeated full statements would create competing authority. Raw IDs and provenance are suitable disclosures. Frequently used representations and critical changed/unknown inputs are not.

## Recommended design gate

Produce a coherent, inspectable storyboard/prototype covering the two anchor journeys and the unresolved states above. Use realistic medical and hardware/software records; include a shared design, siblings, multiple trace levels, a real feedback path and a captured/current mismatch. Explicitly label excerpts and hypothetical capabilities.

Have the independent roles critique that artifact against user outcomes, rather than ask them to polish whichever component currently exists. Then present the consequential composition choices to the owner for direction. Technical QA can establish that the study behaves as specified. Simulated customer critique can reveal plausible friction. Neither substitutes for the owner's visual/task acceptance or observed human research.

Only after the composition and interaction contract are selected should native implementation begin. Local polish can follow that decision; it cannot make the decision for us.
