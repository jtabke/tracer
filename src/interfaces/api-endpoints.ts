import { apiContractVersion, apiIdentity, apiLimits } from "./api-capabilities.ts";
import type { ApiCapabilities } from "./api-capabilities.ts";
import type { Tracer } from "../application/service.ts";
import type { Provenance } from "../core/model.ts";
import { TracerError, ensure, json } from "../core/model.ts";
import type {
  ReadPath,
  ReadQuery,
  ReadResponse,
  WritePath,
  WriteInput,
  WriteResponse,
} from "./api-contract.ts";
import type {
  ReadEndpoint,
  WriteEndpoint,
  ReadContext,
  MutationContext,
} from "./api/definition.ts";
import { applicationModelReads } from "./api/application-models.ts";
import { verificationModelReads } from "./api/verification-models.ts";
import { verificationReads, verificationWrites } from "./api/verification-cases.ts";
import { changeAssessmentWrites } from "./api/change-assessments.ts";
import { assessmentReads } from "./api/assessment-reads.ts";
import { assessmentLifecycleReads, assessmentLifecycleWrites } from "./api/assessment-lifecycle.ts";
import { nativeReads, nativeWrites } from "./api/native.ts";
import { analysisReads, analysisWrites } from "./api/analysis.ts";
import { evidenceReads, evidenceWrites } from "./api/evidence.ts";
import { evaluationReads, evaluationWrites } from "./api/evaluations.ts";
import { sessionReads } from "./api/session.ts";

export const readEndpoints = {
  ...verificationReads,
  ...verificationModelReads,
  ...assessmentLifecycleReads,
  ...assessmentReads,
  ...applicationModelReads,
  ...nativeReads,
  ...analysisReads,
  ...evidenceReads,
  ...sessionReads,
  ...evaluationReads,
};
export const writeEndpoints = {
  ...verificationWrites,
  ...assessmentLifecycleWrites,
  ...changeAssessmentWrites,
  ...nativeWrites,
  ...analysisWrites,
  ...evidenceWrites,
  ...evaluationWrites,
};
/** Discovery and reference inventory derive from the same registered handlers as dispatch. */
export function describeApi(): ApiCapabilities {
  const operations = [
    ...Object.keys(readEndpoints)
      .sort()
      .map((path) => ({ method: "GET", path })),
    ...Object.keys(writeEndpoints)
      .sort()
      .map((path) => ({ method: "POST", path })),
  ];
  const features = [
    ...new Set([
      ...Object.values(readEndpoints).flatMap((endpoint) => endpoint.features),
      ...Object.values(writeEndpoints).flatMap((endpoint) => endpoint.features),
    ]),
  ].sort();
  return {
    api: apiIdentity,
    contractVersion: apiContractVersion,
    features,
    operations,
    limits: { ...apiLimits },
  };
}
const reads: { [K in ReadPath]: ReadEndpoint<ReadQuery<K>, ReadResponse<K>> } = readEndpoints;
const writes: { [K in WritePath]: WriteEndpoint<WriteInput<K>, WriteResponse<K>> } = writeEndpoints;
export function encodeQuery<K extends ReadPath>(path: K, value: ReadQuery<K>) {
  return path + reads[path].query.encode(value);
}
export function decodeQuery<K extends ReadPath>(path: K, url: URL) {
  return reads[path].query.decode(url);
}
export function decodeRead<K extends ReadPath>(path: K, query: ReadQuery<K>, value: unknown) {
  return reads[path].response(value, query);
}
export function decodeWrite<K extends WritePath>(path: K, value: unknown, input?: WriteInput<K>) {
  return writes[path].response(value, input);
}
function decodeWriteInput<K extends WritePath>(path: K, value: unknown): WriteInput<K> {
  ensure(json(value), "validation", "Request must contain JSON-safe data");
  try {
    return writes[path].input(value);
  } catch (error) {
    if (error instanceof TracerError) throw error;
    throw new TracerError("validation", `Invalid request for ${path}`);
  }
}
async function executeRead<K extends ReadPath>(context: ReadContext, path: K, url: URL) {
  return reads[path].handle(context, decodeQuery(path, url));
}
async function executeWrite<K extends WritePath>(
  context: MutationContext,
  path: K,
  value: unknown,
) {
  return writes[path].handle(context, decodeWriteInput(path, value));
}

/** HTTP hosting resolves authorization/project context before dispatching a known route. */
export async function readQuery(
  tracer: Tracer,
  url: URL,
  context: Omit<ReadContext, "tracer" | "capabilities">,
): Promise<{ handled: true; value: unknown } | { handled: false }> {
  if (!Object.hasOwn(readEndpoints, url.pathname)) return { handled: false };
  return {
    handled: true,
    value: await executeRead(
      { ...context, tracer, capabilities: describeApi },
      url.pathname as ReadPath,
      url,
    ),
  };
}
export async function mutation(
  tracer: Tracer,
  path: string,
  value: unknown,
  provenance: Provenance,
) {
  ensure(Object.hasOwn(writeEndpoints, path), "not_found", "Unknown mutation endpoint");
  return executeWrite({ tracer, provenance }, path as WritePath, value);
}
