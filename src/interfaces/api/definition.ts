import type { ApiCapabilities } from "../api-capabilities.ts";
import { strictObject } from "./input.ts";
import type { Tracer } from "../../application/service.ts";
import type { Provenance } from "../../core/model.ts";
import type { Decoder } from "../decode.ts";
import type { DemoGuide } from "../demo-guide.ts";

export type ReadContext = {
  tracer: Tracer;
  capabilities(): ApiCapabilities;
  token: string;
  guide: DemoGuide | null;
  projects: { id: string; title: string }[];
};
export type MutationContext = { tracer: Tracer; provenance: Provenance };
export type QueryParameter = {
  name: string;
  encoding: "text" | "integer" | "json" | "csv";
  required: boolean;
};
export type QueryCodec<Q> = {
  parameters: QueryParameter[];
  encode(value: Q): string;
  decode(url: URL): Q;
};
export type ReadEndpoint<Q, R> = {
  features: readonly string[];
  query: QueryCodec<Q>;
  response(value: unknown, query: Q): R;
  handle(context: ReadContext, query: Q): R | Promise<R>;
};
export type WriteEndpoint<I, R> = {
  features: readonly string[];
  inputKeys: string[];
  input: Decoder<I>;
  response(value: unknown, input?: I): R;
  handle(context: MutationContext, input: I): R | Promise<R>;
};
/** Infer public responses from service results; check the wire decoder against them. */
export function read<Q, R>(endpoint: {
  features?: readonly string[];
  query: QueryCodec<Q>;
  handle(context: ReadContext, query: Q): R;
  response(value: unknown, query: Q): NoInfer<Awaited<R>>;
}) {
  return { ...endpoint, features: endpoint.features ?? [] };
}
export function write<S extends Record<string, Decoder<unknown>>, R>(
  shape: S,
  response: Decoder<R>,
  options: { features?: readonly string[] } = {},
) {
  const input = strictObject(shape);
  return (
    handle: (context: MutationContext, value: ReturnType<typeof input>) => R | Promise<R>,
  ) => ({
    features: options.features ?? [],
    inputKeys: Object.keys(shape),
    input,
    response,
    handle,
  });
}
