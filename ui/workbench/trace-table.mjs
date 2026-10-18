// Recorded path projection only. An empty stage means no matching recorded link,
// never a failed verification or an inferred coverage obligation.
function matchingLinks(records, links, source, step) {
  if (!source) return [];
  return links.filter(
    (link) =>
      link.source === source &&
      link.type === step.type &&
      records.get(link.target)?.type === step.targetType,
  );
}
export function traceRows(records, links, roots, steps, limit = 500) {
  let rows = roots.slice(0, limit).map((key) => ({ keys: [key], links: [] }));
  let truncated = roots.length > limit;
  for (const step of steps) {
    const next = [];
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
export function groupedTraceRows(records, links, roots, steps, limit = 500) {
  if (!steps.length)
    return {
      rows: roots.slice(0, limit).map((key) => ({ keys: [key], links: [], terminals: [] })),
      truncated: roots.length > limit,
    };
  const prefix = traceRows(records, links, roots, steps.slice(0, -1), limit);
  const last = steps.at(-1);
  const rows = prefix.rows.map((row) => {
    const source = row.keys.at(-1);
    const terminals = source
      ? links.filter(
          (link) =>
            link.source === source &&
            link.type === last.type &&
            records.get(link.target)?.type === last.targetType,
        )
      : [];
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
