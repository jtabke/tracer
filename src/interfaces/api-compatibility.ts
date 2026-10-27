import { snapshotInput } from "../core/input-snapshot.ts";
import { ApiError } from "./api-contract.ts";
import { apiContractVersion, apiIdentity } from "./api-capabilities.ts";
import type { ApiCapabilities, ApiOperation } from "./api-capabilities.ts";
import { array, integer, optional, text } from "./decode.ts";
import { strictObject } from "./api/input.ts";

export type CompatibilityRequirements = {
  features?: readonly string[];
  operations?: readonly ApiOperation[];
  minimumLimits?: Partial<ApiCapabilities["limits"]>;
};
const requirementsInput = strictObject({
  features: optional(array(text)),
  operations: optional(array(strictObject({ method: text, path: text }))),
  minimumLimits: optional(
    strictObject({
      maxChangesetOperations: optional(integer(1)),
      maxCommandIdCharacters: optional(integer(1)),
      maxRequestBodyBytes: optional(integer(1)),
    }),
  ),
});
export function captureRequirements(value: CompatibilityRequirements): CompatibilityRequirements {
  try {
    return requirementsInput(snapshotInput(value));
  } catch {
    throw new ApiError("validation", "Invalid API compatibility requirements. Nothing was sent.");
  }
}
function incompatible(message: string): never {
  throw new ApiError("incompatible_api", message);
}
export function assertApiCompatible(value: ApiCapabilities, required: CompatibilityRequirements) {
  if (value.api !== apiIdentity || value.contractVersion !== apiContractVersion)
    incompatible(
      `Requires ${apiIdentity} contract ${apiContractVersion}; server reports ${value.api} contract ${value.contractVersion}.`,
    );
  for (const feature of required.features ?? [])
    if (!value.features.includes(feature))
      incompatible(`Server does not support required feature: ${feature}`);
  for (const operation of required.operations ?? [])
    if (
      !value.operations.some(
        (item) => item.method === operation.method && item.path === operation.path,
      )
    )
      incompatible(
        `Server does not support required operation: ${operation.method} ${operation.path}`,
      );
  for (const [key, minimum] of Object.entries(required.minimumLimits ?? {}))
    if (value.limits[key as keyof ApiCapabilities["limits"]] < minimum)
      incompatible(`Server limit ${key} is below the required minimum of ${minimum}.`);
}
