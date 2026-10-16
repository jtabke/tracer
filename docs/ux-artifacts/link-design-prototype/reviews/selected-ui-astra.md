# Precision UI — independent product/UX critique

## 1. Goals and evidence understood

Tracer should help engineers **understand and act on connected intent**, not merely accumulate trace links.

The goals I am assessing are:

- **New design:** author coherent information; understand parents, siblings, children and shared contributions; identify explainable gaps and appropriate next work.
- **Sustaining:** start with a proposed change; see relevant affected information and reasons; retain original intent; distinguish established consequences, possible impact and unknowns.
- **Across both:** one identity across useful representations, ordinary free text, many-to-many relationships, understandable scope/history, and rigor appropriate to the task—not mandatory regulated ceremony.

The critical distinctions are non-negotiable: approval is not implementation; implementation mapping is not verified realization; a test mapping is not a passing result; missing links do not prove missing code.

**Evidence limits:** PN needs and UR statements are product-owner input, not representative-user validation. The stories and much of the proposed interaction model remain hypotheses. There are no observed user studies. EventSculpt source inspection grounds examples, not conformance claims.

This review concerns the **working-tree Precision prototype**, not HEAD or historical Contextual. Its three-requirement, three-candidate, tab-memory boundary is legitimate. Missing authoring, impact analysis or persistence is not automatically a defect in this study.

I inspected all five requested PNGs, the prototype source, its complete README, the required needs/journeys documents, relevant UX direction and development principles, and the supplied functional receipt. I did **not** operate a browser or run tests.

---

## 2. Overall direction verdict

**Retain Precision as the visual and interaction baseline. Do not yet endorse its current working model as the broader Tracer UX.**

### Strongest case for it

Precision establishes a reasonably coherent small workspace:

- One selection is visible in the table and inspector.
- The full selected requirement has a clear reading area.
- Mapping qualifiers distinguish partial, outdated and unreviewed information.
- Candidate selection, source inspection and recording are separate actions.
- Coverage and Relationships use the same session identities.
- The palette and restrained typography provide hierarchy without decorating every fact as a large card.

This is a useful foundation for testing a task. It does not require reopening the A/B decision.

### Strongest case against it

**The interface is currently organized around recording links more strongly than around resolving engineering uncertainty.**

The primary action is “Link artifact.” The prominent progress signal counts requirements with no code mapping. Existing mapping details are largely inert. At the decision point, the exact requirement disappears behind a modal. Relationships rearranges the selected record and neighboring summaries, but does not yet let someone reason about several contributions together.

That combination risks reproducing the owner’s one-record-at-a-time complaint in a cleaner shell: better typography, but still considerable mental reconstruction.

This is not a demand for a full graph. The missing quality is **useful simultaneous context and an intelligible next decision**, not more nodes.

---

## 3. Task walkthrough critique

### A. Current task: investigate and record an implementation mapping

#### Orient

In `precision.png`, REQ-02 is clearly selected. Its statement includes the important constraint “without losing their current search text.” “Not traced” is preferable to “not implemented.”

However, “Find suitable services” describes the product intent, while “Keep intent, implementation and evidence in view” describes a broad aspiration. Neither makes the immediate engineering task especially explicit. The task emerges from the table, count and action rather than from a concise explanation of why this requirement needs attention.

The fixture also does not display an approval fact. Therefore, it exercises **untraced intent**, but does not yet test the specific UR-15 misunderstanding that _approved means done_. That is an evidence limitation, not a reason to invent an approval workflow.

#### Find a candidate

The visible action is discoverable. The picker makes search, selection and confirmation distinct. Filename/path search is sufficient for three known toy candidates.

It does not test discovery when the engineer knows a behavior but not its filename. The search implementation only searches names and paths (`app.js:127–139`). That is acceptable here; it should not be counted as evidence for real repository findability.

#### Judge relevance

This is the weakest step.

In both desktop picker screenshots, the dialog retains only “Filter results · REQ-02 / v1.” The exact obligation is no longer readable. The candidate may plausibly filter categories without preserving search text—the distinction the fixture deliberately asks the user to notice.

The source previews are commendably honest. They explicitly say relevance or preservation is unassessed. But the user must compare those caveats against a requirement remembered from the previous state.

#### Record and understand the result

Recording is explicit and produces an extent-unreviewed mapping, not a success verdict. Selection and view context are retained.

Afterward, the prominent zero-untraced signal can overshadow the substantive remaining work. The interface is technically honest, but does more to communicate **“a link now exists”** than **“here is what still needs investigation.”**

#### Correct a mistake

Cancel and Escape support safe pre-record exploration. After recording, there is no individual removal or undo; reset clears all session additions. This weakens the experiment’s recovery path.

### B. New design and system-context suitability

The table can provide a useful bounded overview. The shared `discovery.ts` identity and sibling summaries are promising starting points.

But the current Relationships state does not support judging a family together:

- Siblings show titles and mapping counts, not enough intent to compare obligations.
- The common intent is a heading, not an inspectable relationship with a reason.
- The shared artifact is a summary, not an entry point into its distinct contributions.
- Selecting another requirement replaces the only full statement.

This is a **direction risk**, not a missing-feature defect. The current task deliberately excludes authoring. Nevertheless, “we added Relationships” should not be interpreted as evidence that PN-03 or ND-03 is satisfied.

For new design, the next useful context experiment would be a small comparison of contributions—not an unfiltered system graph or another wall of statements.

### C. Sustaining-change suitability

The shared identity and outdated-mapping language are useful prerequisites. They do not yet constitute an impact model.

There is no proposed delta, before/after comparison, reasoned affected set, retained system constraint, or distinction between established effects and candidate consequences. That is appropriate to this thin slice.

The main direction warning is that **relationship adjacency must not become a substitute for impact explanation**. A future “affected” list needs to explain why an item deserves attention. It must also retain the possibility of unmodeled consequences and leave the original requirement unchanged unless explicitly revised.

A controlled hardware/interface review may need baseline and evidence detail; a software contributor may need a concise explanation suitable for a PR discussion. Both need truthful reasoning. Neither inherently needs a mandatory approval stage.

---

## 4. Prioritized findings

For source references below, **P** means `docs/ux-artifacts/link-design-prototype/`.

Severity follows release significance: **P1** should be fixed before this interaction is promoted into product use; **P2** is a reportable study concern. No P0 issue is established.

### F1 — P1: The mapping decision hides the exact obligation being mapped

**Needs/stories:** PN-02, PN-04, PN-07, PN-09; ND-04. Basis: UR-14–15.

**Exact states:** `precision-picker.png`, `precision-inspected-picker.png`, and `mobile-picker.png`.

**Observed UI/source fact:** The picker shows title, ID and version, but not the full statement. The desktop backdrop blurs the workspace, and the right-hand picker covers the inspector. Source confirms that picker context contains only `${r.title} · ${r.id} / v${r.version}` (`P/app.js:163–175`); backdrop blur is intentional (`P/style.css:653–669`).

**Consequence — inference:** The engineer must remember the search-preservation clause while evaluating a category-filter helper. A superficially related candidate is easier to accept without noticing the uncovered behavior.

**Confidence:** High in the missing context; medium-high in the usability consequence, pending task observation.

**Smallest remedy:** Include the exact requirement text and version inside the picker, adjacent to candidate inspection. Do not make the user close the picker to reread it.

**Tradeoff:** Some additional height, especially on mobile. Reclaim space from the generic picker heading or other chrome before shrinking the statement. This need not become a multi-pane redesign.

---

### F2 — P2: Structural progress is more prominent than remaining engineering work

**Needs/stories:** PN-04, PN-07; ND-04, SC-03. Basis: UR-15.

**Exact states:** initial `precision.png`; post-record `precision-relationships.png`.

**Observed UI/source fact:** The initial summary is “1 untraced code mapping.” After recording an unreviewed link it becomes zero. The calculation counts requirements with zero code links (`P/app.js:114–122`). Partial, unreviewed and outdated states remain elsewhere, but there is no corresponding next-work summary.

**Important distinction:** The zero is not mathematically false. Nor does the UI explicitly declare implementation complete. The issue is the **relative emphasis** of the only progress-like summary.

**Consequence — inference:** Users may optimize for removing zero-link rows rather than investigating partial realization or stale mappings. After completing the prototype’s main action, the next engineering decision is less apparent than the completed mechanical action.

**Confidence:** High in the hierarchy and behavior; medium in predicted interpretation.

**Smallest remedy:** Name the metric precisely—for example, “Requirements without code mappings”—and keep a concise local remainder visible after recording: “Mapping recorded; extent still unreviewed. No test mapping recorded.” Explain the task’s expectation without presenting it as a universal rule.

**Tradeoff:** More status information can create clutter. Prefer one contextual remainder over a dashboard of completeness badges. Do not combine approval, realization, tests and results into a single score.

---

### F3 — P2: Reviewing an existing mapping routes through an add-link workflow

**Needs/stories:** PN-03, PN-07, PN-09; ND-04, SC-03.

**Exact states:** mapping cells in `precision.png`; recorded mapping and shared artifact in `precision-relationships.png`.

**Observed UI/source fact:** Existing filenames in the grid and inspector are non-interactive spans. The shared-artifact summary is also non-interactive. Candidate inspection is available through “Link artifact,” followed by finding/selecting the existing artifact; duplicates then disable recording (`P/app.js:84–112, 121–161`).

**Consequence — inference:** “What does this existing mapping mean?” requires entering an action framed as creating another mapping. This is especially awkward for the partial and outdated information the study deliberately foregrounds.

**Confidence:** High.

**Smallest remedy:** Make an existing **code mapping** open read-only inspection directly, showing the same identity and its requirement-specific qualifier. Keep “Link another artifact” separate. Unsupported test inspection can remain explicitly outside this slice.

**Tradeoff:** Interactive filenames need consistent keyboard affordances and a distinction between inspecting an artifact and inspecting its relationship. No external editor or repository integration is required.

---

### F4 — P2: Post-record recovery is all-or-nothing

**Needs/stories:** PN-08, PN-09; R-01. Basis: safe direct manipulation in the vision and development principles.

**Exact state:** after recording one or more session links.

**Observed source fact:** Recording appends to `state.links`; the available recovery operation empties that entire array. The toast offers information, not undo (`P/app.js:209–233`). Initial fixture links and session links are otherwise not individually removable through the UI.

**Consequence — inference:** Correcting one mistaken experiment requires discarding unrelated session work and reconstructing it. This discourages exploratory comparison even in a disposable prototype.

**Confidence:** High.

**Smallest remedy:** Offer “Undo last link” or removal of one session-added mapping. Preserve fixture data, other additions, selection and view.

**Tradeoff:** A small amount of additional session-state handling. This is not a request for persistent history, cascading deletion or a production undo architecture.

---

### F5 — P2: Semantically important information is visually subordinate to available space

**Needs/stories:** PN-04, PN-07, PN-09; ND-04, R-01. Basis: UR-9.

**Exact states:** `precision.png` and `precision-relationships.png`.

**Observed pixels/source fact:** Mapping extent, stale-version explanation, shared-identity detail and session-loss notice use small secondary text. Relevant rules set much of it to 9–10px (`P/style.css:406–445, 541–553, 631–637`). Meanwhile, the workspace contains substantial deliberately reserved vertical space; the footer has a 100px top margin at the shown desktop width (`P/style.css:438–449`).

**Consequence — inference:** The facts that determine whether an engineering conclusion is justified are less scannable than the task title and counts. Good sampled contrast does not resolve this information-hierarchy problem.

**Confidence:** High in visual hierarchy; medium in accessibility and task impact. I am not claiming a measured readability failure.

**Smallest remedy:** Promote the selected item’s unresolved scope and version qualifier into ordinary task text. Increase the readability of critical secondary information before adding more information density. Reduce fixed empty spacing where it forces consequential information into miniature type.

**Tradeoff:** Slightly less airy composition. Retain the restrained palette and hierarchy; do not solve this by turning every qualifier into a bright badge.

---

## 5. Direction risks and what to retain

### Direction risks—not defects owed by this thin slice

1. **Relationships currently changes arrangement more than reasoning power.**

   `P/app.js:98–112` defines siblings as the other fixture requirements and renders one fixed shared-artifact summary. That is fine for this known toy scope, but not evidence that arbitrary family relationships or shared contributions are understandable.

2. **The study does not test approved-versus-implemented comprehension.**

   Approval is not modeled or shown. A future task fixture can establish agreed intent in context without making approval mandatory for every project.

3. **Scale is untested at the interaction-model level.**

   Mapping cells append filenames and qualifiers; sibling lists include all other fixture requirements. Three short items do not establish scanability with long statements, many mappings or similar artifact names. Do not respond with infrastructure yet—test a modest, realistic denser fixture first.

4. **Accessibility evidence is narrower than keyboard usability.**

   Native dialog semantics, focus handling and visible outlines are good. Dynamic result counts and draft text have no live-region semantics; only the toast does (`P/index.html:93–109`, `P/app.js:127–150`). Actual screen-reader comprehension remains untested. I do not infer a specific assistive-technology failure from source alone.

### Retain

- The chosen sidebar, palette and Precision sans/monospace hierarchy.
- A stable selected identity across representations.
- Full requirement prose rather than compulsory formal syntax.
- Explicit Record versus Cancel.
- Honest “not traced,” “partial,” “outdated” and “extent unreviewed” distinctions.
- Separate test mappings rather than implied passing results.
- Optional source inspection with unmistakable fictional-source labeling.
- Visible session-only storage limits.
- Duplicate protection and captured requirement targeting.
- Semantic labels alongside color.

The correct response is not to add more disclaimers. Preserve these distinctions while moving the relevant ones nearer the decision.

---

## 6. Bounded next-slice alternatives

These are alternatives for owner selection, not authorization to implement all three.

### A. Complete one mapping decision — **recommended**

Keep the existing scope and fixtures. Improve only the sequence:

**Understand obligation → inspect candidate → record or leave unresolved → understand remainder → recover.**

Include the full statement in the picker, direct inspection of recorded code mappings, a readable remaining-work summary and individual session-link recovery. If a scope note is explored, keep it optional and human-authored; recording it must not imply verified realization.

**Acceptance checks**

- The complete REQ-02 statement/version is readable while inspecting `filters.ts`.
- A participant can identify the search-preservation uncertainty without closing the picker.
- Choosing a candidate alone records nothing.
- Recording changes neither approval nor implementation/test-result judgments.
- Partial, stale and unreviewed information remains apparent after the zero-link gap closes.
- An incorrect session link can be undone without losing another link.
- The entire path works with keyboard only; assistive-technology checks cover changing results, selection and confirmation.
- Narrow-screen completion preserves the requirement/candidate association without horizontal overflow.

**Why this first:** It repairs weaknesses in the task already being tested and produces useful learning without another screen or integration.

### B. Compare one family’s contributions

Explore a bounded context arrangement with one intent, three requirements and one shared artifact. Let the user compare selected statements or contribution summaries simultaneously, while maintaining a clear selection.

**Acceptance checks**

- Users can explain why these items are shown together.
- They recognize the shared artifact as one identity with different relationship scopes.
- They can identify overlap or an uncovered obligation without cycling through every record.
- Returning from detail preserves scope and selection.

**Tradeoff:** More directly tests the owner’s big-picture need, but requires a carefully grounded fixture to avoid recreating the rejected wall of text.

### C. Explain one proposed change

Use a small storyboard or explicitly simulated interaction: one proposed delta, a few related items, reasons for attention and retained original intent. No impact engine.

**Acceptance checks**

- Users identify what is proposed versus established.
- Each candidate consequence has an understandable reason.
- They can distinguish known effects, possible impact and unknowns.
- A retained system requirement is not silently relaxed.
- Historical evidence remains distinguishable from a new assessment.

**Tradeoff:** Tests Tracer’s sustaining value more directly, but expands beyond the current linking decision.

**Recommendation:** A first. Use B as the subsequent test of the working model if linking becomes understandable. A slash menu should wait: it can accelerate an understood action, but cannot supply missing decision context.

---

## 7. Realistic user-task validation plan

### Participants and material

Run a small formative round, approximately 4–6 participants if feasible, including frequent authors/contributors and reviewers/consumers across:

- documentation-heavy medical-device or aerospace work;
- lighter software/technology work.

Do not treat those as fixed rigor categories. Ask about the actual task’s risk and coordination needs.

Use sanitized real artifacts where available. Otherwise label teaching/illustrative material explicitly:

- **Formal variant:** an agreed carrying/fit constraint, candidate design output, incomplete mapping and an older check.
- **Software variant:** a bounded discovery behavior, code candidates and tests; distinguish target specification from current runtime. EventSculpt excerpts can ground the case without importing or claiming conformance.

### Neutral tasks

1. “Explain what is settled here and what still needs attention.”
2. “Investigate whether this existing artifact addresses this statement. Record a useful relationship if appropriate; you may decide not to.”
3. “What can you now conclude? What can you not conclude?”
4. “You recorded the wrong artifact. Correct that without losing your other work.”
5. “Switch representation, inspect a neighboring item, then return and explain your current scope.”

For B or C, add only the corresponding family-comparison or proposed-change task—not the whole product journey.

### What to observe

Record assistance, interpretation errors, context reconstruction, rereading, unnecessary navigation, hesitation and recovery—not just clicks or visual preference.

Probe specifically whether participants:

- mistake absent links for absent implementation;
- mistake approval or a new mapping for completion;
- recognize partial and outdated scope;
- distinguish tests from results;
- notice the exact clause a candidate leaves unassessed;
- recognize shared identity;
- know what will survive reload.

Include keyboard-only testing, zoom/reflow inspection and a suitable screen-reader session. The full-page mobile PNG is not sufficient evidence of comfortable operation within an actual phone viewport.

### Decision gate

Do not advance if participants repeatedly need coaching to understand the mapping’s scope, believe the link proves realization, lose the exact obligation during inspection, or cannot recover safely.

Record these as task observations tied to PN/story IDs. Small-sample success supports only the tested task/context—not “best UI,” general usability validation or regulatory suitability.

---

## 8. Inspection limits and review disposition

- I read the freeze manifest, but available tools did not allow independent SHA-256 verification. The manifest also does not list `mobile-picker.png`.
- The supplied receipt reports passing functional checks and sampled contrast. I inspected its script and results but did not rerun them.
- `precision-relationships.png` shows relationship content while Coverage still appears visually highlighted. Source updates the pressed state, and the capture immediately follows the switch with animated styling. I cannot establish a persistent product defect from that frame; verify a settled capture before treating it as one.
- No hands-on browser, screen-reader, zoom, scrolling or real-user testing was performed.
- No files, services or repository state were changed.

## Review

- **Correct:** Selection continuity, explicit recording, honest mapping qualifiers, fictional-source boundaries and tab-only save disclosure are well supported by source and supplied evidence.
- **Fixed:** None; read-only review.
- **Findings:** One P1 decision-context issue and four P2 interaction/information-hierarchy concerns above.
- **Merge verdict: OK with notes** for the isolated study. **Not approved as a production UX or evidence of broader need satisfaction.**

**Bottom line:** Precision is worth keeping. The next improvement should make one engineering judgment clearer and recoverable—not merely make linking faster or add another way to invoke it.
