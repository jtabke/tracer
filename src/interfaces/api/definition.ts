import { strictObject } from "./input.ts";
import type { Tracer } from "../../application/service.ts";
import type { Provenance } from "../../core/model.ts";
import type { Decoder } from "../decode.ts";
import type { DemoGuide } from "../demo-guide.ts";

export type ReadContext = {
  tracer: Tracer;
  token: string;
  guide: DemoGuide | null;
  projects: { id: string; title: string }[];
};
export type MutationContext = { tracer: Tracer; provenance: Provenance };
export type QueryCodec<Q> = { encode(value: Q): string; decode(url: URL): Q };
export type ReadEndpoint<Q, R> = {
  query: QueryCodec<Q>;
  response(value: unknown, query: Q): R;
  handle(context: ReadContext, query: Q): R | Promise<R>;
};
export type WriteEndpoint<I, R> = {
  input: Decoder<I>;
  response: Decoder<R>;
  handle(context: MutationContext, input: I): R | Promise<R>;
};
/** Infer public responses from service results; check the wire decoder against them. */
export function read<Q, R>(endpoint: {
  query: QueryCodec<Q>;
  handle(context: ReadContext, query: Q): R;
  response(value: unknown, query: Q): NoInfer<Awaited<R>>;
}) {
  return endpoint;
}
export function write<S extends Record<string, Decoder<unknown>>, R>(
  shape: S,
  response: Decoder<R>,
) {
  const input = strictObject(shape);
  return (
    handle: (context: MutationContext, value: ReturnType<typeof input>) => R | Promise<R>,
  ) => ({
    input,
    response,
    handle,
  });
}
