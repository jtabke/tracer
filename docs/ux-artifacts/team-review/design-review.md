# Design engineer review — visible controls and working hierarchy

**Status:** simulated design review and native browser verification, not customer validation or owner visual acceptance. Reviewed the isolated engineering example on `http://127.0.0.1:4343/` at 1440 × 1000 and 390 × 844. No existing project data was changed.

The main problem was interaction hierarchy: useful representations and the controls that define the working scope were concealed, while long repeated item text occupied the first screen. The project model now communicates the corrected engineering pattern: intent defines requirements, requirements inform the design, and tests evaluate a design using requirement acceptance criteria. That conceptual correction is more important than cosmetic styling.

Implemented changes:

- Table, Graph, Relationships, Coverage and Reading share one always-visible representation strip. Changing representation preserves the existing scope, selection and captured inspector owner.
- Family relationship and direction remain visible. Their selected values fit at narrow widths because the selectors stack below 560 px.
- Optional model-permitted scope shortcuts open automatically when the working area has enough room. Narrow layouts retain an explicitly named disclosure. This panel is permission guidance, not a claim that those item links exist.
- The general graph starting-item browser stays visible. History and comparison open automatically on a working area at least 900 px wide. The same controls stay mounted when the panel closes, retaining selections.
- The scope heading uses the stable item key and one line of title. Complete statements remain in the work and inspector. A full title tooltip supports desktop inspection.
- Mobile working-view navigation uses one visible row. At 390 px all four supporting views fit without a hidden menu, reducing navigation height by approximately 40 px.
- Trace depth uses a compact selector and a nearby explanation rather than a full-width form field.

The relationship diagram's edge labels were initially harder to read than the cards, and raw relationship chips competed with development-flow labels. These were reported to the model implementation owner for the next pass. Complex project-model diagrams still need task-based review after the simple engineering example; a clear four-node fixture alone does not establish that a dense integrated-product model is understandable.

Remaining design concerns are substantive. Current relationship cards and the inspector can repeat the selected statement. Dense connection metadata can read as a continuous sentence rather than a scan-friendly set of facts. Those need deliberate content hierarchy, not more hiding. The scope title truncation reduces repeated prose but does not by itself fix all duplication.

Verification: build and TypeScript checks passed. The 27 affected workspace, graph, realistic-example and family-trace browser tests passed, including narrow-width bounds, shared identity, selection, drafts, conflicts, stored history and saved views. Screenshot inspection confirmed the visible workspace controls and a 390 px document width without page overflow. The retained live server initially had an older backend and rejected the newly added graph-depth query; fresh test backends passed. The live preview must be restarted before presenting its trace-depth behavior as reviewed.

## Follow-up: controls must not displace the graph

The first always-visible graph-control pass created a measurable space regression: the canvas started at approximately 635 px in the 1440 px desktop view. Exposing each former disclosure as an independent vertical panel was insufficient design work. The revision combines starting-item controls and trace depth in one compact query row, puts native revision/comparison and the history scrubber in a second row, and combines canvas actions with the existing depth summary. Duplicate graph totals were removed; explanatory limits remain available in a small help disclosure. Pagination uses compact buttons with preserved accessible names and tooltips.

Native review of the current isolated Orbit preview on port 4344 shows the general canvas beginning at 365 px at 1440 × 1000, with all query and native-history controls visible. The graph occupies 580 px, and the selected root is visible without scrolling. The prior reference check of less than 300 px assumed concealed controls; its desktop condition now checks at most 400 px, placing the canvas within the first half of the test's 900 px viewport. This change follows actual screenshot inspection, not removal of a failing check without investigation.

Desktop family graph height is bounded to 360–500 px, fitting the selected root within the first viewport. At the first follow-up review its canvas was at 558.64 px with a 400 px height, ending at 958.64 px in a 1000 px viewport. Redundant margins around depth controls were subsequently reduced. The initial fixed SVG viewBox caused small labels when the shorter canvas scaled it down; actual viewport measurement is being handled by the graph implementation owner and remains necessary for readable 100% labels.

The follow-up build, TypeScript check, quality check and seven graph component tests passed. Twelve of thirteen affected browser tests passed, including both reference workbenches and historical/comparison guards. The remaining new trace-depth test could not see a selected receipt outcome because Recorded evaluations remained collapsed in the item inspector; that evidence-inspection issue was handed back to the graph/receipt owner.

## Evidence comparison: bounded implementation, composition unresolved

The verified input-comparison change presents known changed inputs before unknown and matching inputs. The selected input can take precedence when an exact receipt dependency is being inspected. Headers retain the captured item name, captured/current versions and input state; full changed declared field values are immediately visible. Matching inputs use compact rows with statement and capture details available on demand. Configuration pins, canonical dependency IDs, observations and full statements are preserved. The comparison does not determine applicability or alter the recorded outcome.

Five focused component tests and fourteen relevant browser tests passed, covering declared field scope, removed values, simultaneous known change and unknown state, focused-input ordering, external scoped-source drift, immutable captured revisions, retained reviews and all three example receipt contexts. Build and TypeScript checks passed. These establish the local behavior, not the adequacy of the surrounding page or inspector design.

**The owner has now directed us to settle the design before further optimization. Further production changes are stopped.** The following is a design contract proposal for review, not an approved implementation specification.

### Whole-workflow critique

Stacking is acceptable for subordinate technical records; it is inadequate as the primary model for moving between current item authoring and captured evidence investigation. They answer different questions. A current entity editor asks what the design says now. A receipt comparison asks what was evaluated, what has changed since capture, and whether somebody has assessed applicability. Putting those contexts one below another forces the engineer to discover the boundary and reconstruct which version each section describes.

The present Evaluations entry screen spends most of the first desktop viewport on four large result cards and action buttons. Selecting a result opens comparison farther down the same page. Sorting its inputs improves that comparison after the user reaches it, but does not make the main-page hierarchy correct. On narrow screens, the result inventory precedes the actual review task by even more scrolling. A useful first screen should expose either the result-selection task or the selected review task deliberately, rather than both competing in one long stack.

The item inspector also contains title, statement, properties, current technical identity, connection creation, recorded evaluations, configurations and history. The full selected statement already appears in parts of the working surface. Opening an evaluation inside that stack can place the reason for inspection below unchanged current-item content. The new comparison component cannot fix that by itself.

### Proposed inspector contract

1. A stable inspector header states the selected item and current native version once. The working scope and graph/table remain visible outside the inspector.
2. A visible mode choice separates **Item**, **Evidence**, and **History**. An ordinary item selection opens Item. An explicit receipt dependency selection opens Evidence for that exact receipt and input. This is a proposal to compare, not permission to implement three new controllers.
3. Evidence begins with the recorded outcome, captured configuration where applicable, and the explicitly selected input. Captured v1 and Current v2 labels accompany the compared values. Matching/current status never implies that the outcome passed or remains applicable.
4. Actual changed fields are primary content. Unknown source or dependency state is equally visible. Other inputs follow in compact rows. Raw IDs and capture provenance remain available on demand.
5. Current-item editing is an explicit action in Item mode. Switching inspector mode must retain its original captured draft and guards. A comparison display must not silently substitute captured content into the current editor, or update a captured input from a current item.
6. Review writing has one existing command owner and one pinned comparison context. A compact inspector may provide read-only investigation plus an explicit route to the full review surface; adding a second review form is not implied.

The visible modes are a candidate interaction model, not a blanket instruction to put all controls in tabs. Owner evaluation should compare them with a focused comparison surface that expands from the inspector while retaining the working scope.

### Main-page alternatives to compare before coding

| Composition                               | First-screen purpose                                            | Value                                                                                                            | Tradeoff to evaluate                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Result list beside comparison             | Choose a recorded outcome while reading the selected comparison | Selection and consequence remain together; a compact inventory does not displace changed values                  | Long statements and narrow inspector widths may require a wider review surface                               |
| Focused comparison with contextual return | Investigate one selected receipt and its relevant input         | Gives captured/current values the full reading width; preserves an explicit return to the original working scope | Must demonstrate that returning restores scope, selection, camera and drafts rather than reconstructing them |

Do not combine both alternatives into another page containing every pattern. Compare the same Orbit task in each: open the baseline energy result, understand DES-01 v1 → v2, identify the other captured inputs, then return to the design scope without changing the recorded result or losing a draft.

### What is visual, and what remains copy

| Information                         | Representation                                             | Necessary copy                                                                                        |
| ----------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Which item is selected              | One persistent item header and visible selection treatment | Stable key, human title and native version                                                            |
| Why an input matters to a result    | Named directed relationship context or a short path        | Relationship meaning and whether the path is captured; do not label current names as historical facts |
| What changed                        | Captured/current field comparison with local emphasis      | Full values, field name, captured/current versions; avoid truncating the decision-making content      |
| What is unknown                     | Distinct state treatment beside the relevant input         | The source/dependency limitation; unknown is not failure                                              |
| What was evaluated                  | Captured configuration context associated with the outcome | Configuration/build name and exact pins on demand                                                     |
| Whether evidence remains applicable | Separate review context                                    | Recorded decision, rationale and comparison basis; a diagram cannot establish applicability           |
| Raw provenance                      | Secondary disclosure                                       | IDs, hashes, observation records, revision/changeset and schema details                               |

### Design acceptance before another implementation pass

The owner should be able to explain, from the selected first screen, what was evaluated, which input is being inspected, what changed, what is unknown, and whether applicability has been assessed. They should see the meaningful comparison without opening a raw record or scrolling past unchanged item fields. Full statements must remain readable at desktop and narrow sizes. A draft/current/captured-mode transition must be demonstrated explicitly. Technical checks and AI critique support those decisions; they do not replace owner acceptance of the composition.
