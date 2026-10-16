export const titleCase = (text) => String(text).replaceAll("_", " ");
export const typeName = (type) =>
  ({
    product_requirement: "Product requirement",
    subsystem_requirement: "Subsystem requirement",
    component_requirement: "Component requirement",
    verification_protocol: "Verification plan",
    validation_protocol: "Validation plan",
    design_output: "Design output",
    user_need: "User need",
    test_run: "Recorded run",
  })[type] ?? titleCase(type);
export const MAX_VISIBLE = 50;

export function snapshotAt(data, revision) {
  const records = new Map(),
    links = new Map();
  for (const entry of data.revisions) {
    if (entry.projectRevision > revision) break;
    const objects =
      entry.kind === "entity" ? records : entry.kind === "relationship" ? links : null;
    if (!objects) continue;
    if (entry.snapshot) objects.set(entry.id, entry.snapshot);
    else objects.delete(entry.id);
  }
  return {
    records: new Map([...records.values()].map((record) => [record.key, record])),
    links: [...links.values()],
  };
}
export function significantEvents(data, selected = null) {
  const revisions = selected
    ? data.revisions.filter(
        (entry) =>
          entry.snapshot?.key === selected ||
          entry.snapshot?.source === selected ||
          entry.snapshot?.target === selected,
      )
    : data.revisions;
  const entityAdds = revisions.filter((entry) => entry.kind === "entity" && entry.version === 1);
  const linkAdds = revisions.filter(
    (entry) => entry.kind === "relationship" && entry.version === 1,
  );
  const events = [];
  if (!selected)
    events.push({
      revision: 1,
      title: "Model defined",
      detail: "Project-owned types and relationship rules",
    });
  if (entityAdds.length)
    events.push({
      revision: entityAdds.at(-1).projectRevision,
      title: selected ? `${selected} created` : `${entityAdds.length} artifacts created`,
      detail: "End of initial record creation",
    });
  if (linkAdds.length)
    events.push({
      revision: linkAdds.at(-1).projectRevision,
      title: `${linkAdds.length} connections recorded`,
      detail: selected
        ? `Incoming and outgoing links for ${selected}`
        : "End of initial relationship creation",
    });
  for (const entry of revisions.filter((entry) => entry.version > 1)) {
    const change = data.changesets.find((item) => item.projectRevision === entry.projectRevision);
    events.push({
      revision: entry.projectRevision,
      title: `${entry.snapshot?.key ?? typeName(entry.snapshot?.type ?? entry.kind)} updated`,
      key: entry.snapshot?.key,
      detail: change?.reason ?? "Native revision",
    });
  }
  return events.sort((a, b) => a.revision - b.revision);
}
export function diffAt(data, revision) {
  return data.revisions
    .filter((entry) => entry.projectRevision === revision)
    .map((entry) => {
      const before = [...data.revisions]
        .reverse()
        .find(
          (previous) =>
            previous.kind === entry.kind &&
            previous.id === entry.id &&
            previous.projectRevision < revision,
        )?.snapshot;
      const after = entry.snapshot;
      const previousFields = before?.fields ?? {},
        nextFields = after?.fields ?? {};
      const fields = [...new Set([...Object.keys(previousFields), ...Object.keys(nextFields)])]
        .filter((key) => JSON.stringify(previousFields[key]) !== JSON.stringify(nextFields[key]))
        .map((key) => ({ key, before: previousFields[key], after: nextFields[key] }));
      if (entry.kind === "relationship" && before && after) {
        for (const key of ["source", "type", "target"])
          if (before[key] !== after[key])
            fields.unshift({ key, before: before[key], after: after[key] });
      }
      return { ...entry, before, after, fields };
    });
}
export function allowedTypes(schema, source, target) {
  return Object.entries(schema.relationshipTypes)
    .filter(([, rule]) => rule.source.includes(source.type) && rule.target.includes(target.type))
    .map(([type]) => type);
}
