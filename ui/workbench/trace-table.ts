import type { MatrixRow } from "./matrix-types.ts";
import type { WorkspaceRelationship } from "./workspace-snapshot.ts";

type Records = ReadonlyMap<string, { id?: string; type: string }>;
type Links = readonly WorkspaceRelationship[];
type Step = { type: string; targetType: string };

function indexLinks(records: Records, links: Links) {
  const outgoing = new Map<string, Map<string, WorkspaceRelationship[]>>();
  const byId = new Map<string, WorkspaceRelationship>();
  const parents = new Map<string, Map<string, Set<string>>>();
  for (const link of links) {
    const source = link.sourceId ?? records.get(link.source)?.id ?? link.source;
    const target = link.targetId ?? records.get(link.target)?.id ?? link.target;
    byId.set(link.id, link);
    const types = outgoing.get(source) ?? new Map<string, WorkspaceRelationship[]>();
    const matches = types.get(link.type) ?? [];
    matches.push(link);
    types.set(link.type, matches);
    outgoing.set(source, types);
    const incoming = parents.get(target) ?? new Map<string, Set<string>>();
    const sources = incoming.get(link.type) ?? new Set<string>();
    sources.add(source);
    incoming.set(link.type, sources);
    parents.set(target, incoming);
  }
  return { outgoing, byId, parents };
}
// Each recorded revision or changed local overlay supplies a new immutable link array.
const indexes = new WeakMap<Links, ReturnType<typeof indexLinks>>();
export function traceIndex(records: Records, links: Links) {
  let index = indexes.get(links);
  if (!index) indexes.set(links, (index = indexLinks(records, links)));
  return index;
}
function matchingLinks(
  records: Records,
  links: Links,
  source: string | null | undefined,
  step: Step,
) {
  if (!source) return [];
  return (
    traceIndex(records, links)
      .outgoing.get(records.get(source)?.id ?? source)
      ?.get(step.type) ?? []
  ).filter((link) => records.get(link.target)?.type === step.targetType);
}

export function traceRows(
  records: Records,
  links: Links,
  roots: string[],
  steps: Step[],
  limit = 500,
) {
  let rows: MatrixRow[] = roots.slice(0, limit).map((key) => ({ keys: [key], links: [] }));
  let truncated = roots.length > limit;
  for (const step of steps) {
    const next: MatrixRow[] = [];
    for (const row of rows) {
      const source = row.keys.at(-1);
      const matches = matchingLinks(records, links, source, step);
      for (const link of matches.length ? matches : [null]) {
        if (next.length >= limit) {
          truncated = true;
          break;
        }
        next.push({
          keys: [...row.keys, link?.target ?? null],
          links: [...row.links, link?.id ?? null],
        });
      }
    }
    rows = next;
  }
  return { rows, truncated };
}

// A grouped row keeps the full prefix identities and gathers only its direct final links.
// Shared nodes under different parents or parallel prefix links remain distinct occurrences.
export function groupedTraceRows(
  records: Records,
  links: Links,
  roots: string[],
  steps: Step[],
  limit = 500,
) {
  if (!steps.length)
    return {
      rows: roots.slice(0, limit).map((key) => ({ keys: [key], links: [], terminals: [] })),
      truncated: roots.length > limit,
    };
  const prefix = traceRows(records, links, roots, steps.slice(0, -1), limit);
  const last = steps.at(-1)!;
  const rows = prefix.rows.map((row) => {
    const source = row.keys.at(-1);
    const terminals = matchingLinks(records, links, source, last);
    return {
      ...row,
      keys: [...row.keys, terminals[0]?.target ?? null],
      links: [...row.links, terminals[0]?.id ?? null],
      terminals: terminals.slice(0, 100).map((link) => ({ key: link.target, linkId: link.id })),
      terminalTotal: terminals.length,
    };
  });
  return { rows, truncated: prefix.truncated || rows.some((row) => row.terminalTotal > 100) };
}
