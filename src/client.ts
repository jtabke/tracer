import { ApiError } from "./interfaces/api-contract.ts";
import type {
  EvidenceByKind,
  ReadPath,
  ReadQuery,
  ReadResponse,
  WritePath,
  WriteInput,
  WriteResponse,
} from "./interfaces/api-contract.ts";
import type { EvidenceKind, EvidenceQuery } from "./core/evidence.ts";
import type { Page } from "./core/model.ts";
import { decodeRead, decodeWrite, encodeQuery } from "./interfaces/api-endpoints.ts";
import { errorResponse } from "./interfaces/api-errors.ts";
import { snapshotInput } from "./core/input-snapshot.ts";

export { ApiError } from "./interfaces/api-contract.ts";
export type * from "./interfaces/api-contract.ts";
export type ClientOptions = {
  /** Absolute server URL for headless use; omitted for same-origin browser use. */
  baseUrl?: string;
  project?: string;
  headers?: HeadersInit;
  fetch?: typeof globalThis.fetch;
};
export type RequestOptions = { signal?: AbortSignal };

/** One immutable server/project identity and private session per client. No retries. */
export function createClient(options: ClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  const origin = baseUrl ? new URL(baseUrl).origin : undefined;
  const project = options.project ?? "default";
  const initialHeaders = new Headers(options.headers);
  const fetchRequest = options.fetch ?? ((...args) => globalThis.fetch(...args));
  let token = "";

  async function request<T>(
    path: string,
    decode: (value: unknown) => T,
    body: string | undefined,
    requestOptions: RequestOptions,
  ) {
    const headers = new Headers(initialHeaders);
    headers.set("X-Tracer-Project", project);
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      headers.set("X-Tracer-Token", token);
      if (origin) headers.set("Origin", origin);
    }
    try {
      const response = await fetchRequest(baseUrl + path, {
        method: body === undefined ? "GET" : "POST",
        headers,
        body,
        cache: "no-store",
        signal: requestOptions.signal,
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        const error = errorResponse(value);
        throw new ApiError(error.error, error.message, error.details);
      }
      return decode(value);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        body === undefined ? "read_failed" : "outcome_unknown",
        body === undefined
          ? "Could not read the project. Refresh to retry."
          : "Could not confirm the save outcome. Refresh and inspect saved data/history before retrying.",
      );
    }
  }
  function read<K extends EvidenceKind>(
    path: "/api/evidence",
    query: EvidenceQuery & { kind: K },
    options?: RequestOptions,
  ): Promise<Page<EvidenceByKind[K]>>;
  function read<K extends ReadPath>(
    path: K,
    query: ReadQuery<K>,
    options?: RequestOptions,
  ): Promise<ReadResponse<K>>;
  function read<K extends ReadPath>(
    path: K,
    query: ReadQuery<K>,
    options: RequestOptions = {},
  ): Promise<ReadResponse<K>> {
    let captured: ReadQuery<K>;
    let endpoint: string;
    try {
      captured = snapshotInput(query);
      endpoint = encodeQuery(path, captured);
    } catch {
      throw new ApiError("validation", "The query could not be serialized. Nothing was sent.");
    }
    return request(endpoint, (value) => decodeRead(path, captured, value), undefined, options);
  }
  function write<K extends WritePath>(
    path: K,
    input: WriteInput<K>,
    options: RequestOptions = {},
  ): Promise<WriteResponse<K>> {
    let body: string;
    try {
      body = JSON.stringify(input);
    } catch {
      throw new ApiError("validation", "The proposal could not be serialized. Nothing was sent.");
    }
    return request(path, (value) => decodeWrite(path, value), body, options);
  }
  async function connect(options: RequestOptions = {}) {
    token = (await read("/api/session", {}, options)).token;
  }
  return { read, write, connect };
}
