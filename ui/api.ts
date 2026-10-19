import type { EvidenceKind, EvidenceQuery } from "../src/core/evidence.ts";
import type { Page } from "../src/core/model.ts";
import type {
  EvidenceByKind,
  ReadPath,
  ReadQuery,
  ReadResponse,
} from "../src/interfaces/api-contract.ts";
import { encodeQuery } from "../src/interfaces/api-endpoints.ts";
import { readRequest, connectSession } from "./http-transport.ts";
export { ApiError } from "../src/interfaces/api-contract.ts";

export function read<K extends EvidenceKind>(
  path: "/api/evidence",
  query: EvidenceQuery & { kind: K },
): Promise<Page<EvidenceByKind[K]>>;
export function read<K extends ReadPath>(path: K, query: ReadQuery<K>): Promise<ReadResponse<K>>;
export function read<K extends ReadPath>(path: K, query: ReadQuery<K>): Promise<ReadResponse<K>> {
  return readRequest(path, query);
}
export const connect = connectSession;
export const url = encodeQuery;
