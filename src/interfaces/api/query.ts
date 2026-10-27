import type { ErrorCode } from "../../core/model.ts";
import { TracerError, ensure, record } from "../../core/model.ts";
import type { Decoder } from "../decode.ts";
import {
  array,
  integer as decodeInteger,
  optional as decodeOptional,
  text as decodeText,
  literal,
} from "../decode.ts";
import type { QueryCodec } from "./definition.ts";
import type { OptionalFields } from "./input.ts";
type Field<T> = {
  decode: Decoder<T>;
  encoding: "text" | "integer" | "json" | "csv";
  optional?: boolean;
  missing?: string;
  invalidJson?: string;
};
type QueryValue<S> = OptionalFields<{
  [K in keyof S]: S[K] extends Field<infer T> ? T : never;
}>;
type Failure = {
  code: ErrorCode;
  message: string;
};
type Options = {
  exact?: Failure;
  empty?: string;
  unknown?: Failure;
  invalid?: Failure;
};
export const textParam: Field<string> = { decode: decodeText, encoding: "text" };
export const integerParam: Field<number> = {
  decode: (value) => {
    ensure(
      typeof value === "number" && Number.isSafeInteger(value),
      "validation",
      "Expected a safe integer",
    );
    return value;
  },
  encoding: "integer",
};
export const positive: Field<number> = { decode: decodeInteger(1), encoding: "integer" };
export const csv: Field<string[]> = { decode: array(decodeText), encoding: "csv" };
export function choice<const T extends string>(...values: T[]): Field<T> {
  return { decode: literal(...values), encoding: "text" };
}
export function optionalParam<T>(field: Field<T>): Field<T | undefined> {
  return { ...field, optional: true, decode: decodeOptional(field.decode) };
}
export const pageParams = { after: optionalParam(textParam), limit: optionalParam(integerParam) };
export const evidencePage = { ...pageParams, subject: optionalParam(textParam) };
export function jsonParam<T>(decode: Decoder<T>, invalidJson?: string, missing?: string): Field<T> {
  return { decode, encoding: "json", invalidJson, missing };
}
function invalid(field: string, error: unknown): never {
  if (error instanceof TracerError) {
    if (error.details) throw error;
    throw new TracerError(error.code, error.message, { path: [field] });
  }
  throw new TracerError("validation", `Invalid query parameter: ${field}`, { path: [field] });
}
const wireDecoders: Record<
  Field<unknown>["encoding"],
  (raw: string, key: string, jsonError?: string) => unknown
> = {
  text: (raw) => raw,
  integer(raw, key) {
    ensure(/^-?(0|[1-9]\d*)$/.test(raw), "validation", `Invalid integer query parameter: ${key}`, {
      path: [key],
    });
    return Number(raw);
  },
  csv: (raw) => (raw ? raw.split(",") : []),
  json(raw, key, message) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new TracerError("usage", message ?? `Invalid JSON query parameter: ${key}`);
    }
  },
};
function decodeField<T>(field: Field<T>, raw: string | undefined, key: string): T {
  if (raw === undefined && field.missing) throw new TracerError("usage", field.missing);
  const value =
    raw === undefined ? undefined : wireDecoders[field.encoding](raw, key, field.invalidJson);
  try {
    return field.decode(value);
  } catch (error) {
    return invalid(key, error);
  }
}
function checkKeys(url: URL, keys: string[], options: Options) {
  if (options.empty) ensure(url.searchParams.size === 0, "usage", options.empty);
  if (options.exact)
    ensure(
      url.searchParams.size === keys.length && keys.every((key) => url.searchParams.has(key)),
      options.exact.code,
      options.exact.message,
    );
  const actual = [...url.searchParams.keys()];
  ensure(new Set(actual).size === actual.length, "usage", "Duplicate query parameter");
  for (const key of actual)
    ensure(
      keys.includes(key),
      options.unknown?.code ?? "validation",
      options.unknown?.message ?? `Unknown query parameter: ${key}`,
      options.unknown ? undefined : { path: [key] },
    );
}
/** Declares wire encoding and structural validation; services own business rules. */
export function query<S extends Record<string, Field<unknown>>>(
  shape: S,
  options: Options = {},
): QueryCodec<QueryValue<S>> {
  const fields = shape as Record<string, Field<unknown>>;
  const parse = (url: URL): QueryValue<S> => {
    checkKeys(url, Object.keys(fields), options);
    const result: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      const value = decodeField(field, url.searchParams.get(key) ?? undefined, key);
      if (value !== undefined) Object.defineProperty(result, key, { value, enumerable: true });
    }
    // Every declared field has been decoded; unknown and missing required fields reject.
    return result as QueryValue<S>;
  };
  return {
    parameters: Object.entries(fields).map(([name, field]) => ({
      name,
      encoding: field.encoding,
      required: !field.optional,
    })),
    encode(value) {
      ensure(record(value), "validation", "Query must be an object");
      const params = new URLSearchParams();
      for (const [key, item] of Object.entries(value)) {
        ensure(Object.hasOwn(fields, key), "validation", `Unknown query parameter: ${key}`, {
          path: [key],
        });
        if (item !== undefined)
          params.set(key, fields[key].encoding === "json" ? JSON.stringify(item) : String(item));
      }
      return params.size ? "?" + params : "";
    },
    decode(url) {
      try {
        return parse(url);
      } catch (error) {
        if (options.invalid) throw new TracerError(options.invalid.code, options.invalid.message);
        throw error;
      }
    },
  };
}
export function jsonQuery<Q>(decode: Decoder<Q>, message: string): QueryCodec<Q> {
  const field = jsonParam(decode, "Invalid working context JSON");
  return {
    parameters: [{ name: "query", encoding: "json", required: true }],
    encode: (value) => "?" + new URLSearchParams({ query: JSON.stringify(value) }),
    decode(url) {
      checkKeys(url, ["query"], { exact: { code: "usage", message } });
      return decodeField(field, url.searchParams.get("query") ?? undefined, "query");
    },
  };
}
