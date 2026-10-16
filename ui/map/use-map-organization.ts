import { useMemo, useState } from "react";
import { areaChoices, buildDirectory, matchesArea, studyOrganization } from "./organization.ts";
import type { Fixture, MapIndex, Organization } from "./types.ts";
export function useMapOrganization(data: Fixture, index: MapIndex, area: string) {
  const initialOrganization = useMemo(() => studyOrganization(data), [data]);
  const [customOrganization, setCustomOrganization] = useState<Organization | null>(null);
  const [orgRevision, setOrgRevision] = useState(0);
  const [checkedRecords, setCheckedRecords] = useState(new Set<string>());
  const [organizeIds, setOrganizeIds] = useState<string[] | null>(null);
  const [organizationUndo, setOrganizationUndo] = useState<Organization | null>(null);
  const organization = customOrganization ?? initialOrganization;
  const directory = useMemo(() => buildDirectory(index, organization), [index, organization]);
  const areas = useMemo(() => areaChoices(index, organization), [index, organization]);
  const browsingDirectory = useMemo(
    () =>
      buildDirectory(
        index,
        organization,
        [...index.entities.keys()].filter((id) => matchesArea(id, organization, area)),
      ),
    [index, organization, area],
  );
  function applyOrganization(action: string, value: string) {
    const path = value
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (action === "folder" && !path.length) return false;
    setOrganizationUndo(organization);
    const next = { ...organization };
    for (const id of organizeIds ?? []) {
      const current = organization[id] ?? { path: ["Unfiled"], areas: [] };
      next[id] =
        action === "folder"
          ? { ...current, path }
          : {
              ...current,
              areas:
                action === "add"
                  ? [...new Set([...current.areas, value])]
                  : current.areas.filter((name) => name !== value),
            };
    }
    setCustomOrganization(next);
    setOrgRevision((current) => current + 1);
    setOrganizeIds(null);
    setCheckedRecords(new Set());
    return true;
  }
  return {
    customOrganization,
    orgRevision,
    checkedRecords,
    organizeIds,
    organizationUndo,
    organization,
    directory,
    areas,
    browsingDirectory,
    setCustomOrganization,
    setOrgRevision,
    setCheckedRecords,
    setOrganizeIds,
    setOrganizationUndo,
    applyOrganization,
  };
}
