# Independent QA and code review

Status: implementation review and automated verification, October 13, 2026. This is a technical review, not customer acceptance or a claim that the visual design is complete.

## Review scope

Reviewed native item graph depth and historical reads, explicit workflow metadata, engineering starter semantics, legacy enrichment proposals, realistic example schemas, and existing model-map browser expectations. No owner database was changed. All runtime fixtures use in-memory or temporary databases.

## Findings corrected

1. Workflow direction validation previously coerced arbitrary values to strings. JSON `["forward"]` could pass validation while the renderer interpreted it differently. Direction now accepts only the literal strings `forward` and `reverse`; a regression covers malformed directions.
2. Depth reads with additional manual expansion could omit newly discovered boundary nodes from `trace.frontier`. The boundary now derives from actual ordinary relationship endpoints that remain unexpanded, including manual discoveries. Receipt-only inputs remain distinct from ordinary traversal.
3. Graph query validation and breadth-first traversal exceeded existing complexity checks. Small validation and neighbor-collection functions reduce complexity without changing bounds, scan semantics, or error handling.
4. Existing constellation and browser assertions omitted the new design-to-test permission and explicit workflow metadata. Assertions now verify the additional native `tested_by` declaration and the exact persisted workflow definition, rather than weakening schema equality checks.
5. Historical reads with a missing root dropped requested depth metadata. Empty reads now retain that depth, so a comparison containing the old root and its neighborhood keeps the multilevel layout.

6. The new starter `tested_by` seed initially passed `scope`, `source_version`, and `review` while its schema declared no fields. The native validator correctly rejected the mismatch. The seed was corrected to use its declared empty field set. An actual-seed regression now verifies the design/implementation and acceptance-criteria paths through depth three, plus the absence of fabricated execution results.

## Verified behavior

- Intent flows into requirements. Requirements provide design inputs and test acceptance criteria; designs supply the design under test. The native requirement-to-intent trace direction remains intact.
- Workflow metadata names concrete permitted type pairs, supports explicitly reversed flow and feedback, and rejects unknown or disallowed endpoints, invalid labels, malformed directions, duplicate paths, and invalid feedback flags.
- Unrestricted trace endpoint permissions do not fabricate a complete workflow. An explicit workflow path can be authored for unrestricted endpoints; empty endpoint permissions reject it.
- Example enrichment preserves fields and endpoint permissions and leaves source schemas unchanged. Legacy starter enrichment is a staged proposal that does not allocate revisions or write schema data. Authored workflow metadata, including explicit empty workflow lists, is retained.
- Depth 1–6 follows incoming and outgoing native links through several levels. Cycles terminate, shared designs and tests retain a single identity, and native relationship directions are preserved.
- Current and historical depth reads respect snapshot revisions and tombstones. Comparisons identify removed test nodes and links without changing live state.
- Depth validation and overflow are visible errors, not silently truncated results. Explicit depth uses the agreed 200-node / 600-link overall bounds; each incident read retains its 200-link bound. Legacy reads retain their existing bounds.
- Receipt-declared inputs are an explicit provenance frontier. Ordinary depth does not recursively follow them or manufacture ordinary links; deliberate manual expansion remains available.
- Reads do not allocate project revisions.

## Remaining review considerations

A depth boundary lists unexpanded nodes, not proven omitted links. A node at the boundary may be a leaf. UI copy must describe this uncertainty. Receipt-only inputs may have unexplored ordinary connections even when the ordinary trace boundary is empty; completeness copy must qualify its scope.

Changing depth can produce a substantially larger canvas. Automated service tests do not establish readability or acceptable information density; task-based browser review at wide and narrow sizes remains necessary. The default graph should support following a requirement through design, test, and evidence without suggesting that every permitted model route has a recorded item link or passing test result.

Optional workflow metadata describes development flow. It is not a mandatory stage gate, executable workflow, verification-completeness rule, or release approval policy.

## Verification receipts

Combined graph, workflow, flow-layout, and temporal review: 27 tests passed. Full Node suite: 143 passed. Model-map browser review: 2 Chromium tests passed. Typecheck passed. Graph and core quality checks are clear; the latest shared quality run has one remaining `GraphCanvas` cognitive-complexity issue after further UI changes. The delivery checkpoint owns final aggregate checks and final visual/customer review status.

## Follow-up review: navigation and evidence interaction design

Status: design review only. The owner subsequently instructed the team to establish the design before optimizing its UI. Production integration of guided neighbors and selected-context filtering is paused. Baseline graph/state, selection guards, workflow, evidence input, and native inspector checks passed 28 tests. These checks preserve technical behavior; they do not approve a design.

A shortest-path proposal was considered and rejected for this pass. A requirement can connect directly to a test through acceptance criteria and indirectly through the design under test. Choosing the shortest path can omit the design and obscure the owner's central concern. It is not a full verification chain or all verification inputs.

The replacement **design hypothesis**, not an approved interaction, is guided navigation among recorded neighbors with an optional selection-and-neighbors canvas. Its proposed contract retains one selected identity, all its direct ordinary neighbors, explicit captured-input/output neighbors, and all native links whose endpoints are visible. Native arrow directions, parallel links, sibling connections, self-links, and shared identities are retained. Captured receipt and comparison objects are not rewritten. Superseded receipts do not create new neighbor expansion. Exact omissions refer to loaded ordinary items and links; captured-input connections are counted separately. Missing selection returns the original loaded graph with explicit status. A draft helper passed eight regression tests, but production integration and browser testing were stopped before completion; that is not delivery or design acceptance.

The full matched graph should continue to authorize inspector selection and drafts; the canvas projection is only a presentation view. Collapsing context must not change the native scope, clear the selected draft, or make an unchanged loaded selection appear unavailable.

Direct receipt inspection should carry the exact receipt identity into a read-only comparison panel. A different output or relationship selection must pass the existing discard guard before any receipt state changes. A receipt for the same currently edited output can be opened beside the editor while retaining its draft, provided the entity editor stays mounted under its existing entity ID. Keying or replacing the editor by receipt ID would require a discard guard even for the same output. Comparison changes must not silently adopt refreshed review tokens or write decisions.

### Page hierarchy risks to resolve before implementation

- **Global versus local navigation:** current global Graph/Table entries overlap with representations inside a working scope. Project studio establishes a shell direction; it does not establish that every implementation projection deserves a primary navigation area. Decide where an engineer changes projects or work context versus merely changes representation.
- **Working purpose:** a graph overview, sibling authoring surface, and evidence comparison serve different jobs. Camera tuning, labels, or another focus checkbox cannot decide which job organizes the page. Explore the information hierarchy and before/action/result states first.
- **Three distinct meanings:** the project model describes types and authored workflow; working traces describe recorded native links; evidence describes exact captured records and comparisons. Similar cards and arrows need distinct context without repetitive warning prose.
- **Scope continuity:** the starting scope, selected item, and current draft should each be identifiable once. Avoid repeated headings and duplicate status summaries. Evidence inspection should preserve or clearly return to the current work context.

### Design-first acceptance questions

Use the same realistic seeded case in each proposed composition. Before component tuning or production coding, the owner should be able to explain the screen's purpose, identify the current scope and selected item, choose the next action, and distinguish actual records from model permissions and captured evidence.

Test a medical-device chain that shows both requirement criteria and design under test feeding a protocol, with shared designs and sibling requirements. Contrast it with a software chain from outcome/story through implementation, scenario, run, and release, preserving its own vocabulary. Include a sustaining change where current input revisions differ from captured evidence without implying automatic impact or invalidating an engineering decision.

For each direction, show initial overview, selection, deeper navigation, captured/current comparison, return to the draft, canceled navigation, and narrow layout. Agree on the hierarchy and interaction transitions before judging spacing, toolbar layout, or animation. Simulated review is useful critique; owner direction and eventual representative-user testing remain separate acceptance evidence.

## Independent design-study task review

Reviewed the Docked studio and Focused studio proposals at `http://127.0.0.1:4350/` using the separate Playwright CLI session `tracer-design-first-qa`. This is the fictional excerpt in [`studio-task-design.html`](../studio-design-first/studio-task-design.html), not the native application. No production UI, services, databases, or design-study source was edited during this review. Findings below describe the inspected proposal state and require retesting after prototype corrections.

### Interactions and meanings that held up

- Docked Graph → Table retained the selected design and its unsaved statement. Attempting another record selection retained the draft and displayed a clear instruction to save or cancel first.
- Model Visual → Text → Visual carried the same connection label, and Cancel restored the saved label.
- Authored model semantics show intent feeding requirements, requirements guiding design and supplying test criteria, and design supplying the thing under test. Recorded native `finding_from` direction remains finding → evaluation rather than being silently reversed to mimic development flow.
- Captured v1 and current v2 are visibly distinct from the simulated outcome and review judgment. The Focused full-width comparison is easier to read than a narrow inspection pane at 1440 px. Narrow layout stacks captured/current content without document overflow.

### Defects that can distort design feedback

1. **Preview edits leak across record identity.** Editing REQ-R03 to a distinctive statement and saving left the requirement's read view unchanged. Following DES-01 then displayed that requirement statement under DES-01. The proposal shares one `savedDraft` rather than associating values with the edited record. Correct the preview state or explicitly constrain editing to the supported design task before asking the owner to judge authoring behavior.
2. **Review confirmation contradicts displayed judgment.** Selecting “Needs reevaluation,” entering rationale, and saving reported a saved preview review while still displaying “Review unreviewed”; the rationale was not shown. The captured outcome should stay immutable, but the entered judgment needs a distinct visible result or the action must be marked nonfunctional.
3. **Depth behaves like a stage count.** Two levels hide FIND-R02 even though requirement → evaluation ← finding is a two-hop ordinary trace. This differs from the native depth contract. Either demonstrate recorded-link depth correctly or explicitly present a different scope concept.
4. **Representations hide different facts without disclosure.** Graph shows five example items and seven links. Table uses requirement/design/evaluation lanes, omits a finding record and several connections, and does not visibly respond to depth in the same way. Different representation is reasonable; silently changing the apparent scope or hiding the selected record is not a demonstrated interaction contract.
5. **Model geometry resembles an unintended return path.** In Focused at 1440 px, Design and Test share a column. The right-output/left-input route loops around the boundary; forward flow can look like feedback. Several inter-node labels have insufficient space and are partly obscured. This is a comprehension problem to settle in the diagram design, not evidence that more production camera tuning is appropriate.
6. **Text configuration duplicates authority and is incomplete.** Text mode shows two controls editing the same label, while “Exact definitions” is read-only. The study demonstrates one shared property, not full text configuration, new type/connection authoring, or invalid-definition handling.

Additional states to show before production design acceptance: missing captured evidence, unavailable input, failed read/save with retained proposal, invalid text model, and interrupted review rationale. In the Focused comparison, Graph/Table controls remain active while the working representation is replaced by comparison; decide whether those controls return to the scope, change an underlying view, or belong only to scope mode.

### Revised-study recheck

Revisited the corrected study in the same isolated QA browser. The following results supersede the original defect observations **for the transitions tested**; they do not approve the whole application or establish native implementation coverage.

- Both variants now demonstrate one-hop scope with four records and no Finding, and two-hop scope with all five records including Finding. Table includes all five records and fourteen incident references representing the seven ordinary links; the selected statement is no longer repeated in its inspector.
- Preview saves are keyed to record identity and version: a requirement save remains under that requirement at v2, and a design save remains under the design at v3. The captured comparison reflects the revised current design while retaining captured v1.
- Both variants retain the captured/current comparison while a review is being authored. A nondefault “Acknowledge changed inputs” choice and its rationale survive saving; the simulated recorded outcome remains unchanged. Both captured views use the full working area rather than a narrow comparison pane.
- Visual and Text each show one editable label control. A label carries between modes, and Cancel restores the saved label. This remains a starter example and a limited property-editing study, not full text-model authoring.
- Actual Focused model screenshots at 1024 and 390 px show readable forward flow and two explicit test inputs, replacing the earlier misleading return geometry. The model is now labeled as a starter excerpt separate from Orbit traces. The full sixteen-type Orbit model, dense feedback paths, and error states remain unresolved design coverage.
- Mobile captured inspection shows an explicit return to scope and removes irrelevant Graph/Table controls from comparison mode. No document overflow was observed.

An intermediate preview revision exposed its own-state echo rerendering controls before their change or pointer-click handling completed. Depth and nondefault decisions reverted, and pointer variant changes were inconsistent. After the parent corrected select handling and ignored its own echoed preview state, a final **normal-pointer** task changed Docked → Focused, retained depth one with four items, selected a different review decision, saved its rationale, and left the recorded outcome unchanged. This validates those revised preview interactions in this session; it is not a native application bug report or general input-system certification.

## Integration follow-up

The later integrated candidate passes the full 143 Node tests, full 63 Chromium workflows and existing formatting/type/quality gates. Final graph/model polish passes the 29 affected browser tasks. The earlier GraphCanvas complexity finding is resolved without changing thresholds; its event/geometry/render boundaries and explicit provenance modes now pass the existing gate. Actual viewport rendering, captured-version edge labels, current-version nodes, context emphasis, visible labels control and historical inspector framing address the browser concerns above. The checkpoint owns final logs and remaining product-design questions.
