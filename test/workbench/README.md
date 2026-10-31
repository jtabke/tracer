# Workbench regression harness

This is maintained test infrastructure over the production `ui/workbench/` owners, not an alternate product UI or historical design study. Its small shims support static-export loading and reuse the production implementations. Production must not import this directory.

## Commands

From the repository root with Node 24.15+ and installed Chromium:

```sh
npm run workbench:check
npm run workbench:screenshots
npm run workbench
```

The checks build production assets, use automatically assigned local ports and create a separate disposable native database for each mutating suite. They close owned servers and remove only their own temporary directories. `npm run workbench` is an optional persistent local review launcher on port 8174; it prints its fixture paths. Resume only a deliberately selected fixture with `TRACER_STUDY_DIRECTORY=/absolute/path npm run workbench`.

Mutation scripts require an explicit disposable `TRACER_NATIVE_ORIGIN` and reject the persistent review port. `prepare-assessment.mjs` additionally requires an untouched r399 fictional fixture. Never point these scripts at a personal or private development database.

## Owners and generated output

- `verification-fixtures.mjs`: fixture process/port/cleanup ownership.
- `check-workbench.mjs`: one production build and regression orchestration.
- `verify-*.mjs`, `verify-snapshot.ts`: native persistence, geometry, authoring, stale/failed reads, historical locks and unknown-save recovery checks.
- `build-data.mjs`, `study.js`, `index.html`: regenerated fictional static-export loading path; `data.json` is ignored.
- `package-review.mjs`: paired desktop/narrow galleries in ignored `output/product-identity/`.

The shell's state/transport/mutation owners stay in production. Harness JavaScript retains its pre-existing analysis exclusion after relocation; production source has no new exemption, and harness TypeScript plus browser/native assertions remain in the full check. No threshold or contract is weakened by moving this directory.

[Selected documentation images](../../docs/images/README.md) explain capture states and reproduction. Full galleries, generated snapshots and databases stay local. Scripted fixture checks are technical evidence, not device performance or representative-user validation.
