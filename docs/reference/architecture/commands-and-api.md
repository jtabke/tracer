# Commands and API

The supported portable entry is [src/index.ts](../../../src/index.ts). The platform-specific SQLite entry is `@tracer-local/core/sqlite`; [src/client.ts](../../../src/client.ts) exposes the endpoint-typed client. CLI and HTTP operations reuse the same application commands, not independent lifecycle implementations.

## Captured proposals and guarded writes

Inputs are copied at invocation. Later caller mutation cannot change captured fields, paths, guards, provenance or scope. Execution-time object/schema/native/evidence checks remain authoritative. Unsupported non-plain/cyclic data rejects rather than leaking aliasing into a queued operation.

Commands enforce captured versions and transactional consistency. Multi-object changes and an immutable evaluation outcome can commit atomically through `evaluations.commit`; ordinary atomic native operations use changesets. Model and engineering basis changes require explicit adoption or revision, never an implicit retry with newer inputs.

## Uncertain outcomes

A lost response is not evidence that nothing saved. Original command identity and intent remain available for inspection; an unknown outcome pauses dependent writes until the user has inspected saved records and acknowledged the result. Do not automatically replay or invent a replacement command. Rejected commands leave the transaction and its successor usable.

The browser's mutation controller and transport owners are [mutation-controller.ts](../../../ui/mutation-controller.ts), [http-transport.ts](../../../ui/http-transport.ts) and [write-transport.ts](../../../ui/write-transport.ts). Direct raw HTTP bypasses from feature components are forbidden.

## Reads, paging and discovery

Reads are bounded or paged with exact scope and clocks. Continuations reject changed context; restart deliberately rather than combining snapshots. A failed read is not an empty result. Retained data can explain a failed read but cannot grant write permission. Partial traversal does not imply complete engineering impact or absent off-page connections.

`GET /api/capabilities` declares compatibility, supported features and limits before writes. Shared endpoint definitions own validation and generated reference documentation. Headless serving must not require frontend packages or a build, and host shutdown owns its sessions/transactions.

## Authoritative details and checks

- [Developer reference](../developer-reference.md): payloads, call forms, guards and recovery examples.
- [Endpoint reference](../api-reference.md): generated from the shared definitions.
- [API compatibility checks](../../../test/api-capabilities.test.ts), [command recovery](../../../test/changeset-outcomes.test.ts), [headless startup](../../../test/headless-launcher.test.ts) and [server cleanup](../../../test/local-server-shutdown.test.ts).

Authenticated hosting and other-backend concurrency parity are not implemented merely because local HTTP and SQLite checks pass.
