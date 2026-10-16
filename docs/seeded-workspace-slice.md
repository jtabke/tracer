# Seeded working workspace — first delivery slice

**Status:** owner-approved transition; first persisted working candidate implemented, with empty/new and large/dense states included. This document remains the canonical scope and invariants, not a claim of final acceptance. Fixture choices are illustrative engineering examples, not observed-user evidence. Checks and unresolved static quality findings are recorded in the [checkpoint](checkpoint.md).

## Outcome and evidence

Carry the selected Precision workbench/contribution interactions into the existing React/local-server/SQLite application. Complete one useful task: inspect intent and shared contributions → edit a requirement → assess and record an artifact mapping → see remaining uncertainty → reopen the same project and resume committed work.

Needs: PN-02/03/04/07/08/09. Stories: ND-02/03/04 and R-01. Evidence: owner-reported needs and iterative feedback, the selected visual study, and [independent critiques](ux-artifacts/link-design-prototype/reviews/README.md). Sustaining impact remains an important later journey, not part of this implementation. Passing checks will not establish user usefulness or scalability guarantees.

## First fixtures

- **Software, 22 illustrative items:** two needs/intents, eight requirements, five code-artifact records, four test records and three design records. Service discovery remains recognizable, but include another intent, a shared requirement, shared code, long/near-duplicate titles, an untraced obligation, partial scope and a mapping captured against an earlier requirement version. An agreed/approved intent must not masquerade as implemented.
- **Contrasting engineering fixture, 12 illustrative items:** two intents, four requirements, three design outputs and three test records. Use an explicitly illustrative carrying/fit/task example with no invented clinical specifications or compliance claims. The same UI/query/mutation path must work without hardcoded software types.
- Seed history deliberately through normal commands so the earlier/current versions actually exist. Qualifiers and source-version references are human-authored relationship attributes declared in the example schema, not invented engine statuses or inferred realization.
- Code/design records and any snippets are labeled illustrative, project-managed example metadata. They are not real repository bindings or source observations. Test definitions are not test results. No external Git/file/CI integration is required for this slice.
- Both examples seed only a new isolated directory/database; refusal of existing directories is required. Retain the existing small/offline and scale demos. Reopen the same database rather than reseeding to resume.

Counts are fixture-design choices, not workloads or capacity promises. The existing 1,000/10,000-item demos remain separate synthetic stress workloads.

## Workspace states to design together

**Owner requirement:** consider both a genuinely empty/new project and a large project with many traces, not just the small seeded example. This expands design and validation coverage; it does not authorize hosting, import/integration infrastructure or a schema-builder redesign.

- **Empty/new:** distinguish no project, an empty project and an empty filtered result. Make the next useful action clear: create/open a project, then author a first intent/requirement using a suitable schema/template. Do not force example data or a complex schema editor. Design the progression from first item → another related item → first recorded relationship, including cancellation and validation failures. Project/template setup and item creation must be mapped to existing capabilities before implementation; unsupported steps remain explicit gaps, not simulated success.
- **Small/growing:** retain the seeded inspect/edit/map/remove/reopen task, but include an item with no connections and a family with only some connections. Empty relationship areas explain what is absent in the current scope without implying missing implementation or complete coverage.
- **Large/dense:** use the existing synthetic 1,000/10,000-item workloads to exercise navigation/search/filtering and bounded context. Include highly connected/shared items, long or similar names, and mixed relationship qualifiers in focused cases. Show a useful scoped working set rather than every trace at once; retain selection and return context. Distinguish total versus loaded counts, pagination/overflow, no matches, loading and failed reads. Never imply that hidden/off-page traces do not exist.

These are states of one workspace with shared identities and interactions, not three separate applications. Small fixtures explain the task; synthetic workloads test limits and recovery, not user usefulness or guaranteed capacity.

## Interaction boundary

1. Enter a project with useful seeded context, not a mandatory schema editor.
2. Locate/select an intent or family, compare contributions and inspect a requirement/artifact/mapping through the selected Precision design. Scope and bounded-read omissions must be explicit.
3. Keep one canonical entity/link identity; Coverage and Relationships are projections, not copies. Artifact emphasis means recorded mappings, not impact, satisfaction or completeness.
4. Edit requirement prose through explicit Save/Cancel. Retain attempted values and captured versions on validation/conflict/read failures. Selection/view changes must not silently discard a draft.
5. Find an existing candidate, compare against the complete captured statement/version and explicitly record a qualified mapping. Missing trace does not prove missing implementation. Captured mapping versions must never silently adopt a newer statement; implement transactional endpoint preconditions or explicitly historical capture semantics after checking the existing command contract.
6. Inspect recorded scope and old/current version context using actual stored revisions. A partial/outdated/unreviewed mapping stays unresolved; approval, implementation, test mapping and results remain separate.
7. Remove a mistaken newly recorded mapping through a version-checked command. It is a new historical removal, not the static prototype's history-erasing session undo. No general restoration/undo framework.
8. Show Saving/Saved/Failed and the saved revision clearly. Reload/restart preserves committed edits and links. Selection can be restored through navigable identity/URL context; unsaved draft persistence and a persisted layout/settings subsystem are not required. Warn about unsaved work rather than imply it is saved.

## Existing implementation map

The representative existing mutation path is:

`ui/work-item.tsx` / field editor → shared `commit` in `ui/main.tsx` → `ui/api.ts` → POST `/api/changesets` in `src/interfaces/local-server.ts` → `Tracer.applyChangeset` in `src/application/service.ts` → validated operations inside the repository transaction → SQLite state plus changeset/object history.

The command path already checks expected schema versions, validates fields/endpoints and checks object versions for updates/removals; failure rolls back. Reuse it rather than add workspace-owned persistence. Relationship creation currently uses the shared operation; endpoint freshness at mapping confirmation needs focused verification before claiming protection against stale candidate context.

Reads already have typed projections in `src/application/views.ts`, validated service entry points, bounded working-set/connections/chain queries and snapshot-consistent individual transactions. `ui/use-projection.ts` ignores obsolete responses and removes failed data rather than authorizing edits against unread state. Reuse these patterns. Separate browser requests are not one snapshot: do not build a family by silently combining unbounded per-item fetches. Add a narrowly typed, bounded family projection in the application layer only if existing projections cannot faithfully supply the selected task in one transaction.

Existing seed functions instantiate `Tracer` over `SQLiteRepository`, create schemas/entities/relationships through public commands, and refuse existing directories before cleanup. Extend those entry points without turning the seed into an application runtime or silently altering old examples.

## Maintainability and growth commitments

- Reuse React/Vite, local HTTP, typed commands and SQLite. No additional framework, state library, connector layer or database migration unless a required invariant demonstrates the need.
- Keep schema validation, relationship identity, history and transaction rules in core/application/persistence. Components handle presentation, selection and drafts, not duplicate business rules.
- Use schema-declared types/fields and explicit relationship roles/directions. Do not infer parentage or freshness from a relationship name. Domain-example content belongs in seed data, not `REQ-02`/`discovery.ts` branches in production components.
- Extract focused projection/presentation functions and components where the implemented interactions need independent tests. Do not introduce a speculative universal renderer/plugin/ontology framework.
- Bound and page reads/search from the start. Off-page connections must not create false missing-mapping conclusions. Group shared artifacts by ID, not filename. Surface overflow/load errors and retain drafts.
- Keep server-confirmed data separate from draft UI state. No mutable parallel entity store or successful-save claims before commit. Refresh affected projections after success; no automatic stale-token adoption or silent replay.
- Preserve local-server security and trusted-local-user boundaries. No production deployment, accounts, remote access or organizational security claims.
- Preserve useful existing query/editor helpers, APIs and technical sandbox tests. Do not revive the rejected screen design merely because it exists. Introduce the selected working surface incrementally; retire old UI only after callers and tests are understood.
- Measure growth with existing bounded/stress fixtures and targeted query checks, not a claim that a 22-item demo proves scale. PostgreSQL, collaboration and hosted operation remain outside this slice.

## Acceptance checks

### Core, projection and seed

- Existing-directory seeding refuses without changing original files; failed new-fixture creation cleans up only its owned directory.
- Both domains use the same view/service path. Shared/multi-parent entities are one identity, and mappings retain distinct scope/version attributes.
- A family projection is consistent, bounded and explicit about pagination/overflow. A valid off-page mapping is not counted as absent; same filenames do not collapse distinct identities.
- Successful edit/link/removal persists and appends correct history. Failed/stale schema or entity/link commands change neither current state nor history.
- Mapping confirmation honors captured context; a relevant intervening edit cannot silently be treated as reviewed current intent.

### Browser end-to-end

- Discover the seeded task, switch Coverage/Relationships, explore shared-artifact focus and return without losing context.
- Edit prose, cancel/save, inspect source/scope, record a link and remove one mistaken mapping while keeping other work.
- Reload and restart the same database: committed changes and history remain. No reseed required, and no unannounced draft loss.
- Concurrent edit, failed read and failed write preserve the attempt and explain recovery; no automatic overwrite/retry.
- Keyboard/focus, dynamic status, readable zoom/reflow and selected/mapped state are checked. Use focused assistive-technology inspection where available; state remaining limits honestly.
- Missing trace, partial/outdated scope and missing results remain understandable after recording. Do not collapse them into one completeness score.

Run the relevant repository format/type/build/quality/unit/integration/browser gates. Save verbose receipts and report concrete gaps; no broad passing claim while a relevant gate is unresolved.

### Workspace-state design and validation

- Review the empty → first item → first relationship sequence alongside the seeded task before treating the UX as complete. Record any project/template/creation capability gaps and agree on their smallest implementation scope.
- Check that clearing filters recovers a no-match view and that an unlinked item offers an appropriate next action without false completeness claims.
- Run focused large/dense fixture checks for search, disambiguation, bounded/paged reads, explicit omitted connections and selection/return context. Report measured workload and timings rather than an unqualified scalability claim.
- Keep empty, loading, failure and partial-data states distinct; preserve attempted edits and accessible recovery controls.

### User validation

The owner first performs the complete task on the software example and compares the same interactions on the engineering example. Ask what the shared artifact contributes, what remains unresolved and what was actually saved. Record assistance and interpretation failures. This is provisional owner validation; representative user-task evidence remains a later obligation.

## Non-goals and next action

No automatic source import, real source execution, Git/CI synchronization, formula engine, full-project graph, automatic impact propagation, mandatory approval workflow, general undo/restoration, schema-builder redesign, PostgreSQL work, accounts, collaboration, packaging/release or deployment.

**Next:** resolve the static quality follow-up without hiding findings or changing thresholds, then conduct the owner task review across empty/new, software and engineering examples. The implemented family read uses explicit relationship/direction scope, edge pagination and bounded incident context; source/target mapping confirmation is transactionally guarded. Keep the static study as historical design reference, not a second maintained application. Custom CSS remains the single styling system, with shared theme tokens and focused component styles; no Tailwind dependency was added.
