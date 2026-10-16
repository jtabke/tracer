# Independent product/UX critique — selected Precision direction

## 1. Goals and needs understood

Tracer’s intended product outcome is a simple, local-first, domain-general environment for authoring engineering information and understanding many-to-many relationships through multiple interactive views over one identity.

The relevant task outcomes are:

- **New design:** author coherent intent, relate contributions, inspect parents/siblings/children/shared artifacts, and identify explainable gaps and appropriate next work (PN-02/03/04/09).
- **Sustaining:** begin with a proposed change, compare it with the established state, see potentially affected information and the reasons it was surfaced, preserve original intent/history, and distinguish established, possible, and unknown consequences (PN-05/07/08).
- **Semantic honesty:** approval, implementation mapping, realization, test mapping, and passing results are separate. An absent link does not prove absent code; a recorded link does not prove correct or complete realization.
- **Progressive rigor:** ordinary prose remains valid. Formal medical/aerospace work and lighter software work should share a coherent foundation without imposing regulated ceremony universally.
- **Interaction direction:** avoid walls of text, generic box-heavy screens, and one-record-at-a-time context. Preserve a comprehensible big picture while allowing focused detail.

### Evidence limitations

These goals are based on owner-reported evidence and hypotheses. `docs/user-needs.md:25` explicitly says there are **no OB findings yet**. UR-7 is an owner report about inadequate multi-item context, not representative evidence about all users or tools (`docs/user-needs.md:37,86`). The prototype is an authorized visual study, not a validated product concept (`docs/ux-plan.md:45,51`; prototype README line 40).

I therefore treat the selected Precision direction as a hypothesis to refine, not as proof of usability, usefulness, or wider journey fit.

---

## 2. Overall direction verdict

### Verdict

**Retain Precision as the visual and interaction baseline, but do not treat the current prototype as evidence that the underlying product model meets Tracer’s central user needs.**

It is a substantial improvement over the rejected wall-of-text direction: the workspace has a clear focal task, restrained hierarchy, recognizable selection, explicit actions, and credible information density. The dark cyan/teal/cream/charcoal palette feels intentional rather than cosmetically inherited from a legacy ALM tool.

The decisive weakness is not styling. The prototype currently makes **recording a relationship** feel more resolved than **understanding what that relationship means**. That is precisely where Tracer must be stronger than generic trace-link administration.

### Strongest case for the direction

- Coverage, selected requirement, and focused inspection coexist without showing every detail at once.
- Selection survives view switching.
- Requirement IDs and versions remain visible.
- Partial, outdated, unreviewed, and untraced states are represented rather than collapsed into a success color.
- Candidate selection is visibly a draft; Cancel, close, Escape, and Record are distinct.
- Fictional source and session-only behavior are plainly labeled.
- The relationships state demonstrates one shared artifact identity rather than rendering separate copies.
- The right-side focused interaction is a reasonable foundation for progressive complexity.

These are meaningful strengths for PN-03/04/09, even though they have not been user-validated.

### Strongest case against the direction

The principal interaction is framed as **“Find the right artifact”**, and the prominent gap count falls to zero as soon as any candidate is recorded. Yet the prototype does not show why the mapping is expected, whether the requirement is established or approved, which portion is realized, or whether implementation and evidence remain unresolved.

The result risks becoming a polished Jama-style link editor: better looking and more honest in its small print, but still centered on one selected record and one relationship rather than an explainable engineering context.

---

## 3. Task walkthrough critique

### A. Current linking/gap task

#### 1. Orient to the gap

In `precision.png`, REQ-02 is clearly selected, its full statement is visible in the inspector, and code and test mappings are separately counted. The grid simultaneously exposes REQ-01’s partial code mapping, its outdated test mapping, and REQ-03’s extent-unreviewed mapping. This is a good compact comparison.

However, the screen only says **“1 untraced code mapping.”** It does not explain:

- why REQ-02 is expected to have one;
- whether its intent is draft, established, or approved;
- whether the missing relation is a project expectation;
- whether existing-but-unlinked code is the likely situation.

The count is calculated solely from absence of code links (`app.js:117-119`). Thus the prototype identifies a structural absence, but not yet a meaningful gap under PN-04.

#### 2. Open the picker

The right-hand modal is visually focused and provides a pinned requirement title/ID/version. The captured source requirement also prevents selection changing underneath the eventual write.

But in both `precision-picker.png` and `precision-inspected-picker.png`, the background workspace is blurred and the pinned context contains only the title and ID/version (`app.js:170`). The decisive clause—“without losing their current search text”—is no longer readable while comparing source.

That is especially consequential in `precision-inspected-picker.png`: the selected `filters.ts` fixture explicitly says preservation of search text is unassessed (`app.js:46`), while Record link remains available. Recording an extent-unreviewed mapping is semantically permissible, but the user lacks the most important target text when deciding whether even that mapping is appropriate.

#### 3. Search and inspect

The search/list interaction is understandable. Filenames and paths are visible, selection is distinct from recording, current toy mappings are shown, and source inspection is clearly fictional. The selected checkmark does not stand alone: the draft line says nothing has yet been recorded.

The phrase **“Find the right artifact”** overstates what filename search and a short snippet can establish (`index.html:76`). “Assess a candidate mapping” would better fit the actual epistemic state.

#### 4. Record or cancel

This is the strongest part of the interaction:

- Cancel, close, and Escape discard the draft.
- Record is explicit.
- The draft names the captured requirement, candidate, relationship kind, and unreviewed extent.
- The toast confirms the tab-only effect.
- Duplicate recording is blocked.
- The static receipt reports focus containment/return and keyboard checks.

These are good PN-08/09 foundations. The receipt is functional evidence only, not hands-on or user-acceptance evidence.

#### 5. Interpret the result

In `precision-relationships.png`, the result says **“0 untraced code mappings”** while REQ-02’s mapping remains **“Extent unreviewed”** and its test mapping remains absent. The inspector and footer retain caveats, but the highest-level progress signal now looks complete.

This is the central semantic failure of the slice: the interface truthfully preserves uncertainty locally but removes it from the prominent next-work summary.

### B. New-design and system-context suitability

The current coverage workspace is a plausible foundation for a bounded working set:

- requirement titles and mapping states are scannable;
- the full selected statement remains available;
- one shared artifact identity appears in Relationships;
- switching representations does not restart the task.

It does **not yet demonstrate** the owner’s desired system context:

- “Same intent / sibling context” is asserted without showing the parent or relationship that defines the family.
- The Relationships view is mainly a selected-record mapping summary.
- Parents, children, multiple parents, and relationship meanings are not represented.
- The two sibling cards show mapping counts, not how their obligations collectively cover the intent.
- There is no authoring or next-action path beyond adding a code link.

Most of these omissions are acceptable for the intentionally thin slice. The concern is that the screen named **Relationships** currently offers too little evidence that the direction can escape one-item-at-a-time trace administration. ND-03 specifically expects the parent and relationship defining the family to be explainable (`docs/user-journeys.md:59`).

### C. Sustaining-impact suitability

The current prototype does not exercise SC-01:

- no current/proposed comparison;
- no change reason;
- no baseline or historical evidence;
- no impact candidates;
- no relationship path or reason for attention;
- no established/possible/unknown classification;
- no unresolved consequence record.

This is **missing future journey coverage, not a defect in the authorized linking slice**. The visual direction could potentially support a proposed-delta inspector plus a bounded context pane, but the present selection provides no evidence that it will.

The source is appropriately free of automatic propagation. Nothing implies that changing one value rewrites another, which should be retained.

### D. Formal versus lightweight use

The shared interaction—select intent, inspect existing artifacts, record a qualified relationship—can work in both contexts.

Current limitations differ:

- **Formal context:** version, established baseline, mapping scope, previous evidence, and review rationale would need greater prominence.
- **Lightweight software context:** the “Requirements” framing and “Users shall” prose may feel more formal than an evolving specification/issue/PR workflow. Code symbol/path and current behavior may matter more than approval.
- Neither context needs a universal approval gate. The fixture should vary terminology and process depth while preserving identity and semantic distinctions.

---

## 4. Prioritized findings

### Finding P1 — The gap has no explainable expectation

**Story/evidence:** PN-04; ND-04; UR-15. The software acceptance example expects an approved requirement with implementation “not traced—likely outstanding,” while allowing existing-but-unlinked code (`docs/user-journeys.md:71`). Approval, implementation, and verification must remain distinct (`docs/user-needs.md:100`).

**Exact state:** Initial `precision.png`; `app.js:117-119`.

**Observed UI fact:** REQ-02 has zero mappings and the page reports “1 untraced code mapping.” No approval/established state or mapping expectation is shown.

**Inference:** A user can see absence but cannot explain why it is actionable or distinguish an applicable gap from a relationship the project never required.

**User consequence:** The count can become administrative link debt rather than meaningful next work.

**Severity/confidence:** **P1 / high confidence.**

**Smallest remedy:** Add a compact, fixture-specific reason beside the gap, such as “Current code realization expected for established REQ-02 v1; none recorded.” Use a lighter equivalent such as “agreed target” in a software variant rather than imposing “approval” universally.

**Tradeoff:** Adds metadata. Keep it local to the selected gap rather than creating a governance dashboard.

---

### Finding P1 — The exact target disappears during the highest-judgment step

**Story/evidence:** PN-03/04/09; ND-04. The approved statement/version and covered scope are information needed together (`docs/user-journeys.md:238`).

**Exact state:** `precision-picker.png` and `precision-inspected-picker.png`; `app.js:46,170`.

**Observed UI fact:** The modal retains only “Filter results · REQ-02 / v1.” The full statement is obscured by the backdrop. The inspected source says preservation of search text is unassessed.

**Inference:** Users must remember the critical clause while deciding whether the code is relevant. Filename similarity and a generic category-filter function can dominate judgment.

**User consequence:** An unrelated or partial artifact may be recorded against the entire requirement.

**Severity/confidence:** **P1 / high confidence.**

**Smallest remedy:** Pin the full target statement and version inside the picker, with long text collapsible after the first lines. Keep existing mapping context immediately below it.

**Tradeoff:** Reduces vertical space, especially on mobile. A collapsible target is preferable to making the source and target mutually exclusive.

---

### Finding P1 — Recording any link removes the headline gap while meaningful work remains

**Story/evidence:** PN-04/07; ND-04. Adding a link should close only the structural trace gap, not implementation or verification judgment. Partial/outdated scope must remain unresolved.

**Exact state:** `precision-relationships.png`; `app.js:117-119,212-216`.

**Observed UI fact:** After recording, the top summary reads “0 untraced code mappings.” The new relation is always stored as `Mapped` with `Extent unreviewed`, and the selected requirement still has no test mapping.

**Inference:** The prominent zero acts like a completion signal even though the local details remain cautious.

**User consequence:** Reviewers may stop at “all traced,” while mapping scope, implementation realization, tests, and results remain unresolved.

**Severity/confidence:** **P1 / high confidence.**

**Smallest remedy:** Keep separate summaries:

- `Code trace: recorded`
- `Mapping extent: unreviewed`
- `Test mapping: not traced`
- `Result evidence: not shown in this slice`

After recording, offer “Review covered scope” as the next action rather than a generic zero-gap state.

**Tradeoff:** More states increase cognitive load. Progressive disclosure and plain labels are preferable to a combined completeness score.

---

### Finding P1 — “Relationships” does not explain the family it labels

**Story/evidence:** PN-03/09; ND-03; UR-7. The parent and relationship defining a family should be explainable (`docs/user-journeys.md:59`).

**Exact state:** `precision-relationships.png`; relationship rendering at `app.js:102`.

**Observed UI fact:** The view labels two requirements “Same intent / sibling context” and lists a shared artifact, but it does not identify the parent intent as an entity, show the relationship type, or explain why these are siblings.

**Inference:** Users may read “sibling” as “other requirements in this scoped page,” not as a meaningful engineering relationship.

**User consequence:** The view supplies neighborhood rather than system understanding and risks preserving the one-item-at-a-time model under a different tab.

**Severity/confidence:** **P1 / high confidence for this fixture; scale implications remain hypothetical.**

**Smallest remedy:** Add one bounded family strip: named parent/intent, typed connection to the selected requirement, sibling contributions, and the shared artifact shown once with its mapping qualifiers. Do not add a full-project graph.

**Tradeoff:** More relationship labeling competes with compactness. Test whether a family strip or lane is clearer than edges.

---

### Finding P1 — Scope honesty disappears on narrower layouts

**Story/evidence:** PN-04/09 and the UX plan’s non-negotiable clear-scope requirement (`docs/ux-plan.md:144`).

**Exact state:** `mobile-picker.png`; scope text at `index.html:44`, hidden below 1050px by `style.css:1123-1124`.

**Observed UI fact:** Desktop shows “REQ-01—03 · scoped view.” Mobile does not. The gap count remains visible and reads globally.

**Inference:** On narrower screens, users may interpret the count as project-wide rather than applying to a three-requirement fixture.

**User consequence:** A bounded absence can be mistaken for a complete implementation census.

**Severity/confidence:** **P1 / high confidence.**

**Smallest remedy:** Preserve scope in the toolbar or count itself: “1 of 3 requirements in Service discovery has no recorded code mapping.” Allow the longer explanation to wrap.

**Tradeoff:** Uses scarce mobile space, but scope is more important than retaining decorative subtitle space.

---

### Finding P2 — The page overstates what is actually in view

**Story/evidence:** PN-07 and the critical distinction between mappings and evidence.

**Exact state:** All desktop screenshots; `index.html:42`.

**Observed UI fact:** The page says “Keep intent, implementation and evidence in view,” but displays requirement text, code mappings, and test mappings. It displays neither implementation realization nor test-result evidence.

**Inference:** The subtitle weakens otherwise careful caveats by naming desired outcomes as present facts.

**User consequence:** Test mapping may be interpreted as evidence, or code mapping as implementation.

**Severity/confidence:** **P2 / high confidence.**

**Smallest remedy:** Change it to “Keep intent and recorded code/test mappings in view,” or introduce clearly separate implementation and result evidence states later.

**Tradeoff:** Less aspirational copy, substantially greater semantic precision.

---

### Finding P2 — Precision’s density crosses into fragile readability

**Exact state:** All screenshots, especially `mobile-picker.png`. Several metadata styles are fixed at 8–10px (`style.css:449,740,842,1155`).

**Observed UI fact:** Scope labels, result headings, mapping notes, session text, and source labels are visibly very small. The receipt reports contrast sampling, but contrast does not establish readable sizing.

**Inference:** Dense formal review and prolonged use may make qualifiers—the most semantically important content—harder to read than titles and counts.

**User consequence:** Users may scan prominent numbers and miss “outdated,” “extent unreviewed,” or session-only caveats.

**Severity/confidence:** **P2 / medium-high confidence pending browser zoom and user testing.**

**Smallest remedy:** Raise semantic metadata to a more readable base size and reclaim space from oversized page/inspector headings. Verify at browser zoom and narrow widths.

**Tradeoff:** Slightly less information per viewport; likely worthwhile because qualifiers carry the safety meaning.

---

## 5. What to retain

1. **Precision only.** Do not reopen the obsolete A/B decision.
2. The dark palette and restrained cyan accent.
3. The stable three-part structure: bounded working set, selected-item inspector, focused candidate picker.
4. Requirement identity/version in every relevant state.
5. Reversible Coverage/Relationships switching with retained selection.
6. Partial, outdated, not-traced, and extent-unreviewed language.
7. Shared artifacts rendered as one identity.
8. Explicit draft, Record, Cancel, close, Escape, focus return, and duplicate protection.
9. Fictional-source labeling and session-only notice/reset.
10. The right-hand picker direction—after restoring enough target context to support judgment.
11. Absence of automatic propagation, inferred conformance, and mandatory approval ceremony.

---

## 6. Bounded next-slice alternatives

### Alternative A — Truthful gap resolution **(recommended next)**

Refine only the existing REQ-02 flow:

- state why this mapping is expected;
- pin the complete statement/version in the picker;
- record the candidate as extent unknown/unreviewed;
- preserve a visible “review covered scope” next step;
- keep test mapping and actual result separate.

#### Acceptance tests

- Before linking, a participant can explain: “No code mapping is recorded; code may still exist.”
- While inspecting a candidate, the exact target clause remains visible or reachable without closing the picker.
- After recording, the participant can explain that only a trace relation was added.
- The UI still shows unresolved mapping extent and missing test/result questions.
- A formal variant may say approved/baselined; a lightweight variant may say agreed target. Neither introduces a universal approval gate.
- Cancel/Escape leaves counts unchanged and returns focus and context.

This is the best next slice because it repairs the semantic core before adding more surfaces.

### Alternative B — Explain one requirement family

Extend Relationships with one parent/intent, three sibling contributions, and one artifact shared by two requirements. Include a multiple-parent case without building a full graph.

#### Acceptance tests

- A participant can identify what makes the items siblings.
- They can explain the relationship type and direction.
- They recognize the shared artifact as one identity, not duplicated code.
- Selecting a sibling retains the working scope and can return to the original item.
- A second parent does not visually turn the data into a false tree.

This is the strongest bounded test of the owner’s big-picture need.

### Alternative C — One sustaining-change context panel

Use one current/proposed statement and three candidate consequences, each labeled with its reason and epistemic status: established, possible, or unknown.

#### Acceptance tests

- Original and proposed intent are simultaneously distinguishable.
- Each surfaced item explains why it is present.
- A recorded relationship does not imply the connected item must change.
- Absence from the displayed scope does not claim “no impact.”
- No dependent text/value is automatically rewritten.
- Leaving the panel preserves the established fixture and clearly identifies the proposal as uncommitted.

Do this after Alternative A unless actual user evidence makes sustaining the more urgent risk.

The proposed slash menu should not precede these experiments. It would improve command access without resolving why a relationship is appropriate or what remains unknown.

---

## 7. Realistic user-task validation plan

### Participants and contexts

Target a small formative round of approximately 4–6 people where feasible:

- frequent author/connectors and at least one reviewer/consumer;
- representation from documentation-heavy medical/aerospace or comparable systems work;
- representation from lighter software/product work;
- varying task risk rather than assuming industry determines rigor.

These are recruitment criteria, not validated personas. If only the owner is available, label the result a provisional walkthrough.

### Materials

Use sanitized artifacts from participants’ real work where possible:

- one established statement/version with missing or uncertain implementation mapping;
- candidate design/code artifacts including one plausible but partial match;
- a test specification/link and, separately, an actual result;
- one shared or multi-parent example.

Do not import repositories or require integrations for this study.

### Tasks

1. Explain the selected intent and displayed scope.
2. Decide whether “not traced” means no implementation exists.
3. Inspect candidates and record, reject, or defer a mapping.
4. Explain what changed after recording and what remains unresolved.
5. Switch representations and identify the family/shared identity.
6. For a later sustaining concept, assess one proposed change and classify candidate consequences.

Use equivalent formal and lightweight variants and counterbalance ordering.

### Observation criteria

Record:

- unprompted task completion and moderator assistance;
- whether participants mistake approval for implementation;
- whether they mistake a code link for full realization;
- whether they mistake a test mapping for a passing result;
- whether they understand scope and omissions;
- whether exact target clauses remain available during source assessment;
- hesitation, backtracking, and accidental records;
- ability to resume after Cancel, view switching, and interruption;
- keyboard-only use, focus visibility, browser zoom, and narrow-layout orientation.

A repeated critical semantic misunderstanding should trigger iteration even if participants complete the click path. Preference for the palette or speed alone is not validation.

Document resulting observations as OB evidence only after recording context, artifact, task, assistance/errors, and interpretation.

---

## 8. Uncertainties and inspection limits

- I inspected the pixels of all requested images: `precision.png`, `precision-picker.png`, `precision-relationships.png`, `precision-inspected-picker.png`, and `mobile-picker.png`.
- I read the working-tree `index.html`, `app.js`, relevant `style.css`, prototype README, source needs/journeys/UX plan, and vision sections 1–3.
- I do **not** have browser or shell access and did not perform hands-on interaction.
- I did not run tests. Existing functional checks were not independently reproduced and do not establish usability.
- The freeze manifest was readable, but I could not independently recalculate hashes. It does not list `mobile-picker.png`, so that screenshot’s freeze provenance is not attested by the supplied manifest.
- The screenshots cover only three fictional requirements and three candidates. Density, search behavior, and context retention at realistic scale remain untested.
- No findings here should be promoted to observed user behavior. Consequences labeled as inference or hypothesis require task validation.

## Review

- **Correct:** Precision is a coherent visual improvement; selection, drafts, cancellation, version labels, mapping qualifiers, session boundaries, shared identity, and reversible view switching are implemented clearly.
- **Findings:** Five P1 semantic/context issues and two P2 language/readability issues are documented above.
- **Merge verdict:** **BLOCK as evidence that the product direction meets wider Tracer needs. OK to retain as a disposable selected visual prototype.** Fix Alternative A’s target-context and gap-semantics issues before using this slice for meaningful task validation.
