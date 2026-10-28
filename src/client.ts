import { assertApiCompatible, captureRequirements } from "./interfaces/api-compatibility.ts";
import type { CompatibilityRequirements } from "./interfaces/api-compatibility.ts";
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
export type { CompatibilityRequirements } from "./interfaces/api-compatibility.ts";
export type ClientOptions = {
  /** Opt in to checking compatibility before connecting; writes stay blocked until verified. */
  require?: CompatibilityRequirements;
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
  const required = options.require === undefined ? undefined : captureRequirements(options.require);
  let token = "";
  let compatibilityReady = required === undefined;
  let compatibilitySequence = 0;

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
    if (!compatibilityReady)
      throw new ApiError(
        "incompatible_api",
        "Verify API compatibility before writing. Nothing was sent.",
      );
    let body: string;
    try {
      body = JSON.stringify(input);
    } catch {
      throw new ApiError("validation", "The proposal could not be serialized. Nothing was sent.");
    }
    return request(
      path,
      (value) => decodeWrite(path, value, JSON.parse(body) as WriteInput<K>),
      body,
      options,
    );
  }
  /** Explicit, uncached preflight. A failed or superseded check cannot authorize a write. */
  async function checkCompatibility(
    requirements: CompatibilityRequirements = {},
    options: RequestOptions = {},
  ) {
    const sequence = ++compatibilitySequence;
    compatibilityReady = false;
    const captured = captureRequirements(requirements);
    let capabilities: ReadResponse<"/api/capabilities">;
    try {
      capabilities = await read("/api/capabilities", {}, options);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found")
        throw new ApiError("incompatible_api", "Server does not support API capability discovery.");
      throw error;
    }
    assertApiCompatible(capabilities, required ?? {});
    assertApiCompatible(capabilities, captured);
    if (sequence !== compatibilitySequence)
      throw new ApiError(
        "incompatible_api",
        "API compatibility check was superseded. Nothing was sent.",
      );
    compatibilityReady = true;
    return capabilities;
  }
  async function connect(options: RequestOptions = {}) {
    token = "";
    if (required !== undefined) await checkCompatibility({}, options);
    token = (await read("/api/session", {}, options)).token;
  }
  return { read, write, connect, checkCompatibility };
}
