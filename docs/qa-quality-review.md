# Task coverage and quality review

This summary records findings from historical AI-assisted authoring and sustaining-review walkthroughs. The walkthroughs used real local HTTP/SQLite behavior with fictional fixtures; they were not participant studies. Later implementation is summarized in the [status page](checkpoint.md).

## Journey coverage

| Journey                           | Bounded capability observed                                      | Remaining evaluation question                                                            |
| --------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ND-01: begin recognizable work    | Starter schema, ordinary-prose artifacts and explicit creation   | Can a new user begin without unnecessary setup or terminology help?                      |
| ND-02: write with parent intent   | Contextual editing, retained drafts and explicit connections     | Does creation retain enough parent intent without forcing a hierarchy?                   |
| ND-03: connect shared work        | Sibling relationships and canonical shared artifacts             | Can users compare dense or multiple-parent contexts accurately?                          |
| ND-04: find unresolved work       | Explicit missing/partial/old-version relationship context        | Which project rules make a missing link meaningful?                                      |
| SC-01: investigate a change       | Saved field history, connected context and retained scope        | Can users explain engineering consequences without treating adjacency as impact?         |
| SC-02: reason about removal       | Guarded disconnection, retained endpoints and history            | What retirement/supersession policies does a real project require?                       |
| SC-03: reassess evidence          | Immutable captures, input comparison and rationale-based review  | Can reviewers distinguish outcome, freshness and judgment?                               |
| Q-01: retain quantitative meaning | Free-text numbers, units and versioned prose                     | Which shared-value or calculation structures are useful without mandatory formalization? |
| R-01: recover interrupted work    | In-session drafts, conflict guards and uncertain-save inspection | What additional recovery is needed across browser shutdown or reload?                    |

## Findings incorporated

- Focus the loaded recorded-connection context instead of leaving it below the viewport.
- Offer explicit inspection of a newly created artifact without automatically connecting it.
- Keep native receipt review accessible independently of external-source binding.
- Bound narrow evidence controls and wrap identifiers without horizontal document overflow.
- Explain declared input paths using captured identity/version, with canonical IDs available on demand.
- Preserve expected versions, dirty-selection guards, immutable evidence and explicit refreshed-input adoption.
- Distinguish an unselected historical inspector from an artifact that is actually absent at that revision.

## Quality approach

`npm run check` combines formatting, strict types, hook lint, unit/browser tests, builds and dependency/duplication/health gates. Refactors preserve transaction boundaries, invocation-time capture, pagination order, history identities and uncertain-write recovery. Production code cannot import historical design studies or test-only UI components.

The workbench has a separate strict configuration and disposable-database regression command. See [Contributing](../CONTRIBUTING.md) and the [candidate guide](ux-artifacts/product-identity/README.md) for reproducible checks.

Passing checks establish technical behavior within their workloads. They do not establish user acceptance, engineering validity, unrestricted capacity or completion of every candidate story.
