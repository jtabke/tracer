# Domain and storage

## Native objects and versions

Entities and directed relationships have stable IDs, schema-governed fields and captured versions. User-facing keys/names are labels, not replacements for identity. Ordinary updates preserve fields outside the approved patch; deletion retains native history and historical endpoint identity. Schema declarations permit operations but do not establish engineering completeness.

The portable owners are [domain models](../../../src/core/model.ts), [application services](../../../src/application/service.ts) and [repository ports](../../../src/application/ports/). The [SQLite adapter](../../../src/persistence/sqlite.ts) owns platform-specific storage.

## Current state and permanent history

Native commands commit an ordered changeset and its history atomically. Historical reads resolve the state/schema at the selected revision rather than joining current endpoints into old records. Native revision, object version and evidence revision are different clocks; commands must use the guards appropriate to their captured proposal.

Configurations pin exact selected member states and optional relationships/content. A baseline pins a complete native revision. Neither a manifest nor an ordinary membership link proves a complete BOM, verified configuration or release readiness. Comparisons retain an explicit before/after pair; live refresh never selects a newer capture silently.

Saved views are bounded current-data presentation recipes, not captured engineering states. Browser-local camera and investigation recovery are separate from database records and are not portable collaboration state.

## Persistence and operational recovery

SQLite transactions and the repository queue own atomicity and database concurrency. Migration checks preserve native/evidence history, configurations, baselines and saved views; unknown formats reject. Database physical format and project schema version are independent. See [storage/migration details](../developer-reference.md#storage-and-migration) before changing either.

Recorded-project JSON is an inspection/exchange artifact, not a supported full database restore format. Command-outcome ledgers are operational data; SQLite online backups retain the recovery state that a JSON export does not. Never copy only an active SQLite main file while WAL work may be outstanding.

## Executable boundaries

Use the shared [repository contract](../../../test/repository-contract.ts), [evidence contract](../../../test/repository-evidence-contract.ts), [SQLite concurrency checks](../../../test/sqlite-concurrency.test.ts) and feature-specific migration tests. Another backend must run these contracts before claiming equivalent identity, atomicity, history or recovery guarantees.
