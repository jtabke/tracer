import { studyOrganization as organize } from "../../../ui/map/organization.ts";
import { asterFolders } from "../../../examples/map-organization.mjs";
export { asterFolders };
export * from "../../../ui/map/organization.ts";
export function studyOrganization(fixture) {
  return organize({ ...fixture, authoredFolders: asterFolders });
}
