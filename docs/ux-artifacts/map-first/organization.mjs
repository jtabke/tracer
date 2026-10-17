import { studyOrganization as organize } from "../../../ui/map/study-organization.ts";
import { asterFolders } from "../../../examples/map-organization.mjs";
export { asterFolders };
export * from "../../../ui/map/organization.ts";
export function studyOrganization(fixture) {
  return organize({ ...fixture, authoredFolders: asterFolders });
}
export { directoryProjection } from "../../../ui/map/directory-projection.ts";
