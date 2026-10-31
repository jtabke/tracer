# Local operation and recovery

Tracer currently supports running from this source checkout with Node.js 24.15+ and the locked npm dependencies. There is no published npm SDK, desktop installer, hosted service or automatic updater.

## Start and reopen

```sh
npm ci
npm start -- --db "../my-project.sqlite"
```

Choose a stable path whose parent directory already exists; quote paths containing spaces. Starting with the same path reopens the existing project without reseeding it. Without `--db`, the default is `tracer.sqlite` in the current working directory, so explicit paths are recommended. Startup prints the resolved database path, local URL and exact **Resume saved setup** command.

`npm start` rebuilds the browser before serving. For repeat starts after a successful build:

```sh
npm run serve -- --db "../my-project.sqlite"
```

Run `npm start` again after changing/pulling source or removing `dist/`. Use Ctrl+C to close the server. Unsaved browser drafts are tab-local and do not survive reload/closure; saved records/history remain in SQLite. Fresh `npm run demo` launches intentionally create new fictional projects—use the printed resume command to continue a demo's saved edits.

For API-only operation, `npm run serve:api -- --db "../my-project.sqlite"` needs no browser build. Use a different `--port` if the default local port is occupied. This is a local service, not authenticated team hosting.

## Back up safely

```sh
npm run backup -- "../my-project.sqlite" "../my-project-backup.sqlite"
```

This uses SQLite's online backup API, including committed WAL state and operational command outcomes. It opens the source read-only and refuses an existing destination; choose a new filename each time. It does not bundle external referenced files or repositories—preserve those separately. Never copy only an active SQLite main file while WAL work may be outstanding.

To restore, stop every process using the affected project, retain the original for inspection, and select a completed backup at a new database path. Start Tracer with that explicit backup path. Do not overwrite a live database or assume JSON export can restore it; [JSON export](project-export.md) has a different purpose and omits operational recovery data.

Before an upgrade, retain a backup. Unsupported database formats reject; do not assume an older checkout can open a database migrated by newer source. A missing file is not a reason to reseed a working project.

## Errors and uncertain saves

A failed read is not an empty project or proof of missing work. Retry the read explicitly; retain drafts and inspect the error. A lost save response is not proof that nothing saved: use the application's original-command inspection/acknowledgment flow before continuing. Never blindly repeat a command to make a warning disappear.

For help, see [Support](../../SUPPORT.md) and [Security](../../SECURITY.md). Share only sanitized diagnostics and fictional reproduction data.
