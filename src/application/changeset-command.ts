import { changesetLimits } from "../core/command-limits.ts";
import { canonical } from "../core/evidence.ts";
import { ensure, json } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { ChangesetInput } from "./commands.ts";

export function changesetCommandId(value: unknown): asserts value is string {
  ensure(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= changesetLimits.maxCommandIdCharacters &&
      value.trim() === value &&
      json(value),
    "validation",
    "Command ID must be nonempty text of at most 200 characters",
    { path: ["commandId"] },
  );
}
/** JSON-normalize optional undefined fields, then compare object keys independent of order.
 * Guards, operation order, caller identities and trusted provenance are part of intent.
 */
export function changesetIntent(input: ChangesetInput, provenance: Provenance): string {
  return canonical(
    JSON.parse(
      JSON.stringify({
        expectedSchemaVersion: input.expectedSchemaVersion,
        expectedProjectRevision: input.expectedProjectRevision,
        operations: input.operations,
        provenance,
      }),
    ),
  );
}
