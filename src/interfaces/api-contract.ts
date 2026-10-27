import type { ErrorCode, ErrorDetails } from "../core/model.ts";
import type { ExternalIdentity, Observation, Receipt, Review } from "../core/evidence.ts";
import type { readEndpoints, writeEndpoints } from "./api-endpoints.ts";

/** Public contracts derive from the endpoint definitions, never parallel route tables. */
export type ReadApi = {
  [K in keyof typeof readEndpoints]: {
    query: ReturnType<(typeof readEndpoints)[K]["query"]["decode"]>;
    response: ReturnType<(typeof readEndpoints)[K]["response"]>;
  };
};
export type WriteApi = {
  [K in keyof typeof writeEndpoints]: {
    input: ReturnType<(typeof writeEndpoints)[K]["input"]>;
    response: ReturnType<(typeof writeEndpoints)[K]["response"]>;
  };
};
export type ReadPath = keyof ReadApi;
export type ReadQuery<K extends ReadPath> = ReadApi[K]["query"];
export type ReadResponse<K extends ReadPath> = ReadApi[K]["response"];
export type WritePath = keyof WriteApi;
export type WriteInput<K extends WritePath> = WriteApi[K]["input"];
export type WriteResponse<K extends WritePath> = WriteApi[K]["response"];
export type EvidenceByKind = {
  external: ExternalIdentity;
  observation: Observation;
  receipt: Receipt;
  review: Review;
};

export class ApiError extends Error {
  code: ErrorCode | "read_failed" | "outcome_unknown" | "incompatible_api";
  readonly details?: ErrorDetails;
  constructor(code: ApiError["code"], message: string, details?: ErrorDetails) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export type { ApiCapabilities, ApiOperation } from "./api-capabilities.ts";
