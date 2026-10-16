import type { WriteInput, WritePath, WriteResponse } from "../src/interfaces/api-contract.ts";
import { ApiError } from "../src/interfaces/api-contract.ts";
import { decodeWrite } from "../src/interfaces/api-decoders.ts";
import { transport } from "./http-transport.ts";
/** Only the shared mutation controller calls this transport; editors use its guarded executor. */
export function write<K extends WritePath>(
  path: K,
  input: WriteInput<K>,
): Promise<WriteResponse<K>> {
  let body: string;
  try {
    body = JSON.stringify(input);
  } catch {
    throw new ApiError("validation", "The proposal could not be serialized. Nothing was sent.");
  }
  return transport(path, (value) => decodeWrite(path, value), body);
}
