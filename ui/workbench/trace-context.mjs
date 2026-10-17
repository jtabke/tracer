import { traceRows } from "./trace-table.mjs";
export function reachableTrace(model, root, steps) {
  const projection = traceRows(model.records, model.links, [root], steps);
  const direct = new Set(
    model.links
      .filter((link) => link.source === root || link.target === root)
      .map((link) => (link.source === root ? link.target : link.source)),
  );
  const entries = new Map();
  for (const row of projection.rows)
    for (let index = 2; index < row.keys.length; index++) {
      const key = row.keys[index];
      if (!key || key === root || direct.has(key) || entries.has(key)) continue;
      entries.set(key, {
        key,
        keys: row.keys.slice(0, index + 1),
        links: row.links.slice(0, index),
      });
    }
  return { entries: [...entries.values()], truncated: projection.truncated };
}
export function recordedRoute(links, root, target, allowedIds) {
  const queue = [{ key: root, links: [] }],
    seen = new Set([root]);
  for (let i = 0; i < queue.length && i < 50; i++) {
    const current = queue[i];
    if (current.key === target) return current.links;
    for (const link of links) {
      if (
        link.source !== current.key ||
        (allowedIds && !allowedIds.has(link.id)) ||
        seen.has(link.target)
      )
        continue;
      seen.add(link.target);
      queue.push({ key: link.target, links: [...current.links, link] });
    }
  }
  return [];
}
