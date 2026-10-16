# Coherent studio design study: independent task review

Status: simulated customer/PM critique, October 13, 2026, initial study served on port 4350 around 20:25 UTC. This is a fictional excerpt prototype; no native application/database writes. It is not owner acceptance. Playwright CLI session `tracer-design-first-customer`, primarily 1440 × 1000, with a 1100 × 800 check.

## Assessment

The study establishes a better organizing idea than the current application: a stable Work scope, representations within that scope, a concise rail, and distinct current-item/captured-input states. The Work header is short enough to let the trace start near the top. Following DES-01 and EVAL-R02 is easy, with recognizable identities and a useful full-statement inspection state.

That does not yet settle the whole design. Docked studio works better for continuous relationship exploration; Focused studio works better for reading the capture comparison. Neither should be adopted unchanged. The current variant comparison also changes the default representation (Graph versus Table), which confounds the inspector-composition decision. Show the same starting representation and selected object in both variants before asking the owner to choose.

## Highest-priority challenges

1. **Evidence disappears when the reviewer must judge it.** Review receipt replaces the captured/current comparison with a small decision/rationale form. The engineer needs the observation and changed input visible while writing that rationale. One primary inspector object does not mean removing the evidence that the form is about. Keep the comparison and review decision together in a purposeful review state.

2. **The narrow dock is not an appropriate container for long comparisons.** The roughly 250px capture pane stacks the historical and current statements into tall paragraphs. Its content extends down while the adjacent graph has empty space. Focused capture's side-by-side statements are materially easier to compare. The task-specific contract should be contextual exploration with deliberate expansion for deeper comparison, rather than always docking every task.

3. **The table's inspector repeats information instead of adding meaning.** Focused Table shows the full selected requirement statement in a card and again in a large lower inspector. That repeated section pushes navigation below the fold. Table already provides reading space; its selection context should lead with useful actions, connected alternatives, evidence or secondary fields rather than repeat the same statement.

4. **Graph/Table do not represent the same visible scope.** Graph contains FIND-R02; Table has only Requirement/Design/Evaluation columns and a textual finding key. Selecting Finding in Graph then changing to Table retains Finding in the inspector, but the selected item is absent from the main representation. A customer starting in Table cannot inspect that finding directly. Either provide a Finding column/visible continuation or make the projection/omission explicit. This is a design contract issue, not spacing polish.

5. **The model remains too simplified to evaluate the owner's actual requirement.** A four-type generic Intent/Requirement/Design/Test diagram is useful for explaining the corrected two-input concept. It does not demonstrate the actual Orbit vocabulary, feedback or complex workflow configuration. Combining Test/evaluation also sidesteps the difference between test definition, run and resulting evidence. Present it as a concept sketch, and include one representative project-owned branch/feedback state before treating model design as resolved.

6. **Model geometry is visibly unfinished.** In both variants, the Requirement→Design label is crowded between oversized cards. Design→Test exits the right edge then bends back diagonally, resembling a return loop even though it is forward development. These problems repeat the owner's earlier broken-diagram concern and should be fixed before review. This is spatial communication of the model, not optional visual polish.

7. **Text configuration duplicates the same editable label.** The Text surface has a Design→evaluation label input in the main area and the same label input in the dock, plus the definitions textarea. A shared draft is good; two simultaneous controls for the same fact are redundant and confusing. Text should provide its own primary editor and remove the duplicate visual properties control.

## What the study does demonstrate

- Full-width capture clearly separates captured v1 from current v2 and states changed/unreviewed independently from the recorded result.
- Visual label editing carried to Text and Cancel returned to the model without native writes.
- Project home is concise and task-oriented rather than a large instructional tour. Its library is only a fixture shortcut, so actual item discovery/search remains untested.
- Configurations present pinned and current revisions clearly. The selected-members disclaimer is honest; a production design still needs configuration selection and exact-member browsing.
- Stable scope identity stays visible through selection. Current-item return is understandable.

## Recommendation for the next reviewable composition

Keep scope-first navigation and continuous exploration. Give inspection enough width for normal reading; expand to a focused comparison state when evidence warrants it, with an unmistakable return to the originating scope. Treat reviewing evidence as a composed comparison-plus-decision state. Give Table a complete continuation through finding, and remove selected-statement duplication. Show Model with representative project vocabulary and a readable feedback/branch state, not only four generic boxes.

Do not add more controls to compensate for these structural issues. Review the two journeys after these composition decisions are explicit. This study is a useful design conversation, not yet a polished application design or proof that dense real projects will work.
