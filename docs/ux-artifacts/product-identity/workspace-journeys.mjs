import { MAX_VISIBLE, titleCase, snapshotAt, diffAt } from "./workspace-model.mjs";

// Presentation labels do not change the canonical relationship's type or endpoints.
export function relationshipLabel(type, outgoing) {
  const labels = {
    decomposes_into: ["Decomposes into", "Decomposed from"],
    verified_by: ["Verified by", "Verification criteria for"],
    validated_by: ["Validated by", "Validation criteria for"],
    realized_by: ["Realized by", "Realizes"],
    specified_by: ["Specified by", "Specifies"],
    references: ["References", "Referenced by"],
    depends_on: ["Depends on", "Required by"],
    contains: ["Contains", "Contained in"],
    executed_as: ["Executed as", "Execution of"],
    examines_output: ["Examines output", "Examined by"],
  };
  return (
    labels[type]?.[outgoing ? 0 : 1] ?? `${outgoing ? "Outgoing" : "Incoming"} · ${titleCase(type)}`
  );
}
export function historyFeed(data, { scope = "selected", key, linkId } = {}) {
  const relevantIds = new Set(
    data.revisions
      .filter((entry) =>
        linkId
          ? entry.kind === "relationship" && entry.id === linkId
          : entry.snapshot?.key === key ||
            entry.snapshot?.source === key ||
            entry.snapshot?.target === key,
      )
      .map((entry) => `${entry.kind}:${entry.id}`),
  );
  const matching =
    scope === "project"
      ? data.revisions
      : data.revisions.filter((entry) => relevantIds.has(`${entry.kind}:${entry.id}`));
  const groups = new Map();
  for (const entry of matching) {
    if (!groups.has(entry.projectRevision)) groups.set(entry.projectRevision, []);
    groups.get(entry.projectRevision).push(entry);
  }
  return [...groups]
    .map(([revision, entries]) => {
      const entry = entries[0],
        value = entry.snapshot;
      const title =
        entry.kind === "relationship"
          ? `${value?.source ?? "Relationship"} → ${value?.target ?? ""}`
          : entry.kind === "schema"
            ? "Project model"
            : (value?.title ?? value?.key ?? "Deleted artifact");
      const change = data.changesets.find((item) => item.projectRevision === revision);
      return {
        revision,
        entries,
        title,
        detail: change?.reason ?? "",
        kind: entry.kind,
        operation: entry.snapshot === null ? "Removed" : entry.version === 1 ? "Added" : "Modified",
      };
    })
    .sort((a, b) => b.revision - a.revision);
}
export function connectedWork(data, revision) {
  const snapshot = snapshotAt(data, revision),
    diffs = diffAt(data, revision);
  const keys = new Set(
    diffs
      .filter((diff) => diff.kind === "entity")
      .map((diff) => diff.after?.key ?? diff.before?.key),
  );
  const result = new Map();
  for (const link of snapshot.links) {
    if (!keys.has(link.source) && !keys.has(link.target)) continue;
    const key = keys.has(link.source) ? link.target : link.source;
    if (keys.has(key)) continue;
    const record = snapshot.records.get(key);
    if (!record) continue;
    if (!result.has(key)) result.set(key, { record, relationships: [] });
    result.get(key).relationships.push(link);
  }
  return [...result.values()].sort((a, b) => {
    const rank = (type) =>
      type === "verification_protocol" ? 0 : type === "subsystem_requirement" ? 1 : 2;
    return rank(a.record.type) - rank(b.record.type) || a.record.key.localeCompare(b.record.key);
  });
}
export function focusedNeighborhood(
  model,
  root,
  { direction = "downstream", depth = 1, verification = true } = {},
) {
  const reached = new Set([root]),
    queue = [{ key: root, level: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { key, level } = queue[i];
    if (level >= depth) continue;
    for (const link of model.links) {
      if (
        link.type !== "decomposes_into" &&
        !(verification && ["verified_by", "executed_as", "examines_output"].includes(link.type))
      )
        continue;
      const next =
        direction === "both"
          ? link.source === key
            ? link.target
            : link.target === key
              ? link.source
              : null
          : direction === "upstream"
            ? link.target === key
              ? link.source
              : null
            : link.source === key
              ? link.target
              : null;
      if (next && model.records.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push({ key: next, level: level + 1 });
      }
    }
  }
  const keys = [...reached];
  return { keys: keys.slice(0, MAX_VISIBLE), omitted: Math.max(0, keys.length - MAX_VISIBLE) };
}

// Recorded downstream paths are candidates for exploration, never assessed impacts.
export function potentialPaths(data, revision, depth = 2) {
  const model = snapshotAt(data, revision),
    diffs = diffAt(data, revision);
  const roots = [
    ...new Set(
      diffs
        .flatMap((diff) =>
          diff.kind === "entity"
            ? [diff.after?.key ?? diff.before?.key]
            : diff.kind === "relationship"
              ? [
                  diff.after?.source ?? diff.before?.source,
                  diff.after?.target ?? diff.before?.target,
                ]
              : [],
        )
        .filter((key) => model.records.has(key)),
    ),
  ];
  const types = new Set([
    "decomposes_into",
    "realized_by",
    "verified_by",
    "executed_as",
    "examines_output",
    "depends_on",
  ]);
  const levels = new Map(roots.map((key) => [key, 0])),
    queue = [...roots];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i],
      level = levels.get(key);
    if (level >= depth) continue;
    for (const link of model.links)
      if (link.source === key && types.has(link.type) && !levels.has(link.target)) {
        levels.set(link.target, level + 1);
        queue.push(link.target);
      }
  }
  const keys = queue.slice(0, MAX_VISIBLE),
    included = new Set(keys);
  const links = model.links.filter(
    (link) => included.has(link.source) && included.has(link.target) && types.has(link.type),
  );
  return { roots, keys, links, levels, omitted: Math.max(0, queue.length - keys.length) };
}

export function pathLayout(paths, width, height, previous = new Map(), pinned = new Set()) {
  const positions = new Map(),
    groups = new Map();
  for (const key of paths.keys) {
    const level = paths.levels.get(key) ?? 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(key);
  }
  const maximum = Math.max(1, ...groups.keys());
  for (const [level, keys] of groups)
    for (const [index, key] of keys.entries())
      positions.set(
        key,
        pinned.has(key) && previous.has(key)
          ? { ...previous.get(key) }
          : {
              x: width * (0.15 + (level / maximum) * 0.65),
              y: (height * (index + 1)) / (keys.length + 1),
            },
      );
  return positions;
}
