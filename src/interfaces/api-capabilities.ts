import { changesetLimits } from "../core/command-limits.ts";
import { array, integer, object, text } from "./decode.ts";

/** Increment for incompatible wire/behavior changes; additive fields/routes/features retain it. */
// Resource-only endpoints and qualified relationship input semantics require renegotiation.
export const apiContractVersion = 2;
export const apiIdentity = "tracer-http";
export const httpLimits = { maxRequestBodyBytes: 1024 * 1024 } as const;
/** Decode future contract versions/features so compatibility can fail explicitly. */
export const capabilityResponse = object({
  api: text,
  contractVersion: integer(1),
  features: array(text),
  operations: array(object({ method: text, path: text })),
  limits: object({
    maxChangesetOperations: integer(1),
    maxCommandIdCharacters: integer(1),
    maxRequestBodyBytes: integer(1),
  }),
});

/** Public discovery types follow the runtime wire decoder. */
export type ApiCapabilities = ReturnType<typeof capabilityResponse>;
export type ApiOperation = ApiCapabilities["operations"][number];
export const apiLimits: ApiCapabilities["limits"] = {
  maxChangesetOperations: changesetLimits.maxOperations,
  maxCommandIdCharacters: changesetLimits.maxCommandIdCharacters,
  ...httpLimits,
};
