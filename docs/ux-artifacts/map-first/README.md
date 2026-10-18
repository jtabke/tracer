# Map-first UI integration

The selected medical map experience now lives in `ui/map/` and runs over Tracer's headless core. **There is one application UI.** Orbit, medical and software examples all use the same renderer and native task panels.

From the repository root:

```sh
npm ci
npm run demo
```

The default demo opens Orbit alone. The terminal prints its database path and a command to resume it. Additional examples are listed in the [example reference](../../realistic-examples.md). Existing database pairs can be supplied with `--db` and `--secondary-db` (and optional `--guide` / `--secondary-guide`). Project routing uses a fixed configured registry; a request cannot name an arbitrary file.

`npm run dev --prefix docs/ux-artifacts/map-first` is a compatibility alias for the native medical example, not a second frontend. Root dependencies and the root build own the application. The previous standalone fixture renderer has been removed. Pure fixtures and historical verification scripts are retained here as research evidence; the old standalone browser scripts do not describe the current native task UI.

The map's 53 original projection/layout/identity tests now live in `test/map/` and run with `npm test`. Compatibility imports preserve historical fixture references. New root integration/browser tests cover native reads, bounded failure, editing/persistence, retained drafts, project isolation, read failure and save-outcome recovery. The prior editor/query browser checks run in an explicit test-only harness, never in a product/demo build.

Folder/category organization and map working views remain local to the current browser session. Item/relationship edits, model changes, evidence and captures use existing guarded core commands. No study folder membership or fictional study data is silently written into an owner's database. The map preserves real record identities, optional-key fallback and native directed endpoints while using authored workflow directions for presentation.

Historical concept decisions and limitations remain in the [UX plan](../../ux-plan.md) and [checkpoint](../../checkpoint.md). This integration is technical implementation, not a new claim of user validation or engineering validity.
