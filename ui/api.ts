import type { EvidenceKind, EvidenceQuery } from "../src/core/evidence.ts";
import type { Page } from "../src/core/model.ts";
import type {
  EvidenceByKind,
  ReadPath,
  ReadQuery,
  ReadResponse,
} from "../src/interfaces/api-contract.ts";
import { decodeRead } from "../src/interfaces/api-decoders.ts";
import { setToken, transport } from "./http-transport.ts";
export { ApiError } from "../src/interfaces/api-contract.ts";

export function read<K extends EvidenceKind>(
  path: "/api/evidence",
  query: EvidenceQuery & { kind: K },
): Promise<Page<EvidenceByKind[K]>>;
export function read<K extends ReadPath>(path: K, query: ReadQuery<K>): Promise<ReadResponse<K>>;
export function read<K extends ReadPath>(path: K, query: ReadQuery<K>): Promise<ReadResponse<K>> {
  return transport(url(path, query), (value) => decodeRead(path, query, value));
}
export async function connect() {
  setToken((await read("/api/session", {})).token);
}
export function url<K extends ReadPath>(path: K, query: ReadQuery<K>) {
  if (path === "/api/working-context")
    return path + "?" + new URLSearchParams({ query: JSON.stringify(query) });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined)
      params.set(key, key === "steps" ? JSON.stringify(value) : String(value));
  return params.size ? path + "?" + params : path;
}
