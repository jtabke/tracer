// Deliberately fictional, connected engineering workload. No execution results are generated.
export function makeConnectedFixture(base) {
  const areas = [
    "Power",
    "Measurement",
    "Connectivity",
    "Usability",
    "Mechanical",
    "Safety",
    "Storage",
    "Maintenance",
  ];
  const subjects = {
    Power: ["Battery", "Charging", "Distribution"],
    Measurement: ["Acquisition", "Calibration", "Signal quality"],
    Connectivity: ["Pairing", "Transport", "Recovery"],
    Usability: ["Controls", "Feedback", "Accessibility"],
    Mechanical: ["Enclosure", "Mounting", "Sealing"],
    Safety: ["Protection", "Detection", "Recovery"],
    Storage: ["Persistence", "Isolation", "Recovery"],
    Maintenance: ["Cleaning", "Inspection", "Service"],
  };
  const entities = [],
    relationships = [];
  const kind = {
    user_need: "Need",
    product_requirement: "Requirement",
    subsystem_requirement: "Allocation",
    design_output: "Design",
    verification_protocol: "Verification plan",
    validation_protocol: "Validation plan",
  };
  const keyPrefixes = {
    user_need: "UN",
    product_requirement: "PRS",
    subsystem_requirement: "SYS",
    design_output: "OUT",
    verification_protocol: "VER",
    validation_protocol: "VAL",
  };
  const ids = new Map();
  function add(type, area, subject, i) {
    const key = `${keyPrefixes[type]}-${String(entities.filter((e) => e.type === type).length + 1).padStart(3, "0")}`;
    const id = `connected:${key}`;
    entities.push({
      id,
      key,
      type,
      version: 1,
      fields: {
        title: `${area} · ${subject} · ${kind[type]} ${i + 1}`,
        statement: `Fictional study ${kind[type].toLowerCase()} for ${subject.toLowerCase()} in the ${area.toLowerCase()} area. Review the connected records together; this fixture is not a supplied device specification.`,
        status: "Draft",
      },
      studyFolder: [area, subject],
      studyAreas: [area, ...(subject === "Recovery" ? ["Safety"] : [])],
    });
    ids.set(`${type}:${area}:${subject}:${i}`, id);
    return id;
  }
  function link(source, target, type) {
    relationships.push({
      id: `connected:link:${relationships.length + 1}`,
      source,
      target,
      type,
      version: 1,
      fields: {
        scope: "Illustrative recorded relationship; no execution or satisfaction is asserted.",
      },
    });
  }
  for (const area of areas)
    for (const subject of subjects[area])
      for (let i = 0; i < 4; i++) {
        const need = add("user_need", area, subject, i),
          req = add("product_requirement", area, subject, i),
          sub = add("subsystem_requirement", area, subject, i),
          output = add("design_output", area, subject, i),
          ver = add("verification_protocol", area, subject, i);
        link(need, req, "addressed_by_requirement");
        link(req, sub, "allocated_to_subsystem");
        link(sub, output, "implemented_by");
        link(req, ver, "verified_by");
        link(sub, ver, "verified_by");
        link(ver, output, "examines_output");
        if (i === 0) {
          const val = add("validation_protocol", area, subject, i);
          link(need, val, "validated_by");
        }
      }
  const outputs = entities.filter((e) => e.type === "design_output"),
    reqs = entities.filter((e) => e.type === "product_requirement"),
    vers = entities.filter((e) => e.type === "verification_protocol");
  for (let i = 0; i < outputs.length; i++) {
    link(outputs[i].id, outputs[(i + 1) % outputs.length].id, "depends_on");
    link(reqs[i].id, vers[(i + 13) % vers.length].id, "verified_by");
    link(reqs[i].id, vers[0].id, "verified_by");
  }
  // One intentionally unlinked, uncategorized record tests discoverability.
  entities.push({
    id: "connected:unfiled",
    key: "PRS-UNFILED",
    type: "product_requirement",
    version: 1,
    fields: {
      title: "Unfiled interface requirement",
      statement: "Fictional isolated study record with no recorded relationships.",
      status: "Draft",
    },
    studyFolder: ["Unfiled"],
    studyAreas: [],
  });
  return { ...base, title: "Connected engineering study", entities, relationships };
}
