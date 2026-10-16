# Connected model — visual reset

**Status:** owner-choice visual study. These are editable SVG drawings and rendered PNGs, not product UI, a working prototype, user validation or an approved direction.

This study replaces the rejected stretched type-card/register composition with two materially different ways to understand the configured model before entering work. Both use the same illustrative engineering starter schema:

- entity types: `intent`, `requirement`, `design`, `test` (three fields each in the engineering template);
- `requirement —contributes_to→ intent` (zero relationship fields);
- `requirement —mapped_to→ design | test` (`scope`, `source_version`, `review`).

Arrowheads follow the stored relationship direction. The diagrams show **permitted type connections**, not recorded item connections. They do not show or infer live item counts, hierarchy, coverage, approval, realization, impact, conformance or test results.

## Direction A — Type constellation

A node-centered spatial overview makes Requirement the visible junction while keeping all four types and their directed relationships on one bounded field. Shape, placement, labels and arrowheads carry the model; configuration is a quiet secondary action. Selecting Requirement keeps the constellation as orientation, exposes its two relationship choices and gives one primary entry into requirement work.

**Strength:** immediate whole-model recognition and a strong focal point.

**Tradeoff:** larger schemas need grouping, search or progressive reveal so the constellation does not become an unbounded graph.

- [Overview · 1440×900 PNG](concept-a-constellation-overview-1440x900.png) · [SVG](concept-a-constellation-overview-1440x900.svg)
- [Overview · 2560×1440 PNG](concept-a-constellation-overview-wide-2560x1440.png) · [SVG](concept-a-constellation-overview-wide-2560x1440.svg)
- [Requirement focus · 1440×900 PNG](concept-a-constellation-requirement-focus-1440x900.png) · [SVG](concept-a-constellation-requirement-focus-1440x900.svg)

## Direction B — Semantic route deck

A route-centered composition treats each relationship as a readable path through a compact semantic map. Requirement is a junction rather than a card; lanes, stations and arrowheads foreground direction. A persistent, narrow project rail offers orientation without recreating the prior seven-tab shell. Selecting `mapped_to` spotlights one route and moves the next action into an anchored route inspector.

**Strength:** relationship direction and alternate destinations read quickly with little container chrome.

**Tradeoff:** very dense models need route bundling and explicit overlap handling; the lane labels are orientation aids, not a prescribed engineering hierarchy or workflow order.

- [Overview · 1440×900 PNG](concept-b-route-deck-overview-1440x900.png) · [SVG](concept-b-route-deck-overview-1440x900.svg)
- [Overview · 2560×1440 PNG](concept-b-route-deck-overview-wide-2560x1440.png) · [SVG](concept-b-route-deck-overview-wide-2560x1440.svg)
- [`mapped_to` focus · 1440×900 PNG](concept-b-route-deck-mapping-focus-1440x900.png) · [SVG](concept-b-route-deck-mapping-focus-1440x900.svg)

## Interaction intent

1. Land on an overview that answers “what connects to what?” before exposing configuration.
2. Read explicit arrow direction and relationship names without reconstructing endpoints from separate rows.
3. Select a type (A) or relationship route (B) while the wider model remains visible.
4. Enter bounded recorded work from one focused primary action. The artifact does not specify the downstream working view.
5. Keep Configure available but secondary; no direct manipulation or persistence is implemented in this study.

## Source and limits

- Visual direction: current `docs/ux-plan.md` visual-reset section, `docs/user-needs.md` PN-03/PN-09 and relevant journeys.
- Rejected baseline: owner screenshot supplied for this task; its stretched type cards and textual relationship register are not retained as constraints.
- Schema/content: `src/core/project-templates.ts` engineering template. No database or owner data was read or written.
- Palette: owner-supplied `#0D0D0D`, `#262626`, `#D9D3C1`, `#268EA6`, `#29CDF2`, with nearby neutral drawing tones.
- Reference quality: the earlier Precision study informed contrast and control restraint only; neither its page composition nor its navigation is carried forward as a requirement.
- Validation is limited to static file/render checks (dimensions, SVG/text bounds, route arrow presence and pixel inspection). No functional interaction, accessibility certification, representative-user test or owner acceptance is claimed.

## Owner choice

Which organizing model should move forward for interaction design: **A, the type-centered constellation**, or **B, the relationship-centered route deck**? The unselected direction should remain a visual study rather than being blended into a compromise by default.
