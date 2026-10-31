# Architecture

Tracer is a local-first engineering workspace over a portable headless core. The CLI, typed HTTP client and browser share the same commands and queries; the UI does not own a second engineering model.

## Source boundaries

| Layer       | Owner                              | Responsibility                                                          |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Domain      | `src/core/`                        | Identity, schemas, revisions, evidence and scoped engineering contracts |
| Application | `src/application/`                 | Guarded commands, queries and portable repository ports                 |
| Persistence | `src/persistence/`                 | SQLite transactions, history, migrations and recovery ledgers           |
| Interfaces  | `src/interfaces/`, `src/client.ts` | CLI, local HTTP transport and typed client                              |
| Workspace   | `ui/workbench/`, `ui/map/`         | Shared investigation state and native-backed task presentation          |
| Checks      | `test/`, `test/workbench/`         | Service contracts, browser workflows and isolated fixture orchestration |

Production must not import tests, studies or private development data. Node/files/database concerns stay outside the portable core/application boundaries. [Contributing](../CONTRIBUTING.md) describes executable enforcement.

## Detailed contracts

- [Domain and storage](reference/architecture/domain-and-storage.md): native identities, history, schemas, configurations, baselines and migrations.
- [Commands and API](reference/architecture/commands-and-api.md): version guards, invocation-time ownership, atomicity, bounded reads and uncertain-command recovery.
- [Evidence and engineering change](reference/architecture/evidence-and-change.md): captured results versus applicability, assessment obligations and controlled Verification conclusions.
- [Workspace ownership](reference/architecture/workspace.md): retained pages, investigation context, draft lifetime and transport boundaries.
- [API/CLI reference](reference/developer-reference.md) and [generated endpoints](reference/api-reference.md): exact payloads, limits and available operations.

## Primitive contracts for extension

Preserve stable native identity and recorded versions; exact captured inputs are not replaceable by newer state. Keep schema permission, structural connectivity, execution outcome, applicability judgment and release authority distinct. A transaction failure must leave both recorded state and the next transaction usable. Unknown saves require original-command inspection, not automatic replay. Failed or partial reads cannot establish absent obligations or grant write authority.

New adapters must satisfy the shared repository/evidence contract and concurrency/recovery checks before parity is claimed. SQLite is the implemented local adapter; authenticated team hosting and other-backend parity remain unproven.

## Current limits and history

The browser snapshot is bounded to 10,000 records / 100,000 connections; individual views and engineering projections have additional disclosed bounds. External bytes are not retained automatically, and local source observations are explicit actions. No deployment, certification or representative-user validation follows from passing software checks.

The previous architecture document mixed implemented contracts, superseded prototypes and dated implementation milestones. Its exact text is preserved through [engineering-history recovery](development/archive.md#engineering-history); this overview and its focused contracts own current architecture.
