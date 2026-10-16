import type { EvidenceKind, EvidenceQuery } from "../src/core/evidence.ts";
import type { Page } from "../src/core/model.ts";
import type {
  EvidenceByKind,
  ReadPath,
  ReadQuery,
  ReadResponse,
} from "../src/interfaces/api-contract.ts";
import { read, url } from "./api.ts";
import { useRead } from "./use-read.ts";

type ReadProjection<T> = ReturnType<typeof useRead<T>>;
export type Projection<K extends ReadPath> = ReadProjection<ReadResponse<K>>;
export function useProjection<K extends EvidenceKind>(
  path: "/api/evidence",
  query: (EvidenceQuery & { kind: K }) | undefined,
  epoch: number,
  report: (error: unknown) => void,
): ReadProjection<Page<EvidenceByKind[K]>>;
export function useProjection<K extends ReadPath>(
  path: K,
  query: ReadQuery<K> | undefined,
  epoch: number,
  report: (error: unknown) => void,
): ReadProjection<ReadResponse<K>>;
/** Typed endpoint reads retain mounted draft owners; ready alone authorizes writes. */
export function useProjection<K extends ReadPath>(
  path: K,
  query: ReadQuery<K> | undefined,
  epoch: number,
  report: (error: unknown) => void,
): ReadProjection<ReadResponse<K>> {
  const endpoint = query === undefined ? undefined : url(path, query);
  return useRead(
    endpoint,
    epoch,
    () => {
      if (query === undefined) throw new Error("No projection query selected");
      return read(path, query);
    },
    report,
  );
}
