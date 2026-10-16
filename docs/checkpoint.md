# Tracer implementation status

Updated 2026-10-16. This page summarizes implemented behavior, verification and remaining work. Design rationale belongs in the [UX plan](ux-plan.md); storage and API contracts belong in [architecture](architecture.md).

## Native application

The shared map-led browser application runs against separate fictional Orbit and Aster databases. It provides project browsing, bounded graph exploration, item tables, contextual artifact/relationship editing, schema configuration and retained evidence/configuration tasks. All examples use the same core and application contracts.

The headless core provides version-guarded atomic changesets, immutable native history, directed relationships, saved views, exact configurations, native baselines, structural coverage and scoped change investigation. SQLite is the implemented storage adapter. Captured evaluation inputs, current input freshness and recorded review decisions remain separate facts.

## Workbench candidate

`npm run workbench` opens the native-backed Graph / Matrix / History candidate with separate fictional Aster and Gatherline databases. It remains distinct from the default production map. The [candidate guide](ux-artifacts/product-identity/README.md) documents its interaction contract and source boundaries.

Implemented workflows include:

- Create artifacts from a title-first Matrix row, revealing schema-required fields before commit.
- Link compatible existing artifacts or atomically create an artifact and its connection.
- Edit fields in floating editors while preserving table geometry, scroll and canonical shared identity.
- Retain artifact, relationship, revision and investigation scope across Graph, Matrix and History.
- Explore recorded dependency paths with stable positions, readable fitted titles and contextual actions.
- Compare captured/current evaluation inputs and record an immutable assessment with rationale.
- Preserve drafts across view changes, reject stale versions/tokens and inspect uncertain saves without automatic replay.
- Use a docked inspector, drawer or compact/partial sheet according to available workspace; historical states are read-only.

The verified assessment scenario modifies PRS-02 from 10–40°C to 5–45°C at r400, retains twenty exact recorded links across views, identifies changed captured inputs, records Needs reevaluation and reloads the same decision. The receipt and native project revision remain unchanged by the review. All example outcomes are explicitly simulated.

## Verification

Latest application verification, 2026-10-16:

| Check                     | Result                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Passed formatting, strict types, lint, 335 unit tests, 130 browser tests, production/harness builds and dependency/duplication/health gates |
| `npm run workbench:check` | Passed candidate types, policy/projection checks and disposable-database authoring, conflict/recovery, assessment and responsive journeys   |
| Documentation navigation  | All tracked Markdown file/heading links resolve; four focused documentation/onboarding browser checks passed at desktop and narrow widths   |
| README illustrations      | Four selected native-backed screenshots; wordmark and images checked at desktop and 680px without horizontal overflow                       |

Regression coverage includes immutable snapshot conversion, deleted historical endpoints, editor/table stability, keyboard and range copy, exact cross-view identities, schema-optional shortcuts, comparison-token drift, unknown inputs, failed reads, lost responses, database switching and historical write locks. The keyboard reader-return regression also verifies that a delayed focus callback cannot steal focus after returning to the item list.

These are technical checks using fictional fixtures. They do not establish representative-user efficiency, broad accessibility certification or engineering validity.

## Current limits

- The production map reads a transactional native snapshot bounded to 10,000 artifacts and 100,000 relationships. Drawing/query bounds are disclosed separately.
- The workbench draws up to 50 artifacts and projects up to 500 trace rows or 100 terminal links per grouped cell. It is not virtualized.
- Assessment discovery follows declared input/captured-output scope, five evaluations per page. Ordinary graph connectivity is not an assessed dependency or proof of impact.
- Unsaved drafts and spatial organization are session-only. Saved engineering records and review decisions persist.
- Spreadsheet paste/bulk mutation, durable Matrix recipes, arbitrary two-revision comparison and broader receipt authoring are not delivered by the candidate.
- PostgreSQL parity, authenticated collaboration, hosted integrations, restoration and standalone packaging remain future work.

## Open work

Evaluate complete create → connect → modify → investigate → assess tasks with representative users in more than one domain. Use those results to prioritize production integration, larger-dataset interaction, clearer review context and remaining authoring friction. Automated checks and visual consistency are supporting evidence, not substitutes for task validation.
