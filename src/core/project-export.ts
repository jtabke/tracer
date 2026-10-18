import type { Changeset, Entity, Relationship, Revision, SchemaObject } from "./model.ts";
import { ensure, json } from "./model.ts";
import type { ExternalIdentity, Observation, Receipt, Review } from "./evidence.ts";
import { canonical } from "./evidence.ts";
import type { Configuration } from "./configuration.ts";
import type { Baseline } from "./baseline.ts";
import type { SavedView } from "./presentation.ts";

/** A recorded project snapshot, not a claim about external content or release completeness. */
export type ProjectExport = {
  format: "tracer-project-export";
  formatVersion: 1;
  scope: {
    nativeHistory: "all-recorded";
    evidence: "all-recorded";
    externalContent: "references-only";
  };
  projectRevision: number;
  evidenceRevision: number;
  current: { schema: SchemaObject | null; entities: Entity[]; relationships: Relationship[] };
  provenance: { changesets: Changeset[]; revisions: Revision[] };
  evidence: {
    external: ExternalIdentity[];
    observations: Observation[];
    receipts: Receipt[];
    reviews: Review[];
  };
  configurations: Configuration[];
  baselines: Baseline[];
  savedViews: SavedView[];
};

/** UTF-8 canonical JSON, with one terminal LF; no export clock, IDs or machine paths added. */
export function serializeProjectExport(value: ProjectExport): string {
  ensure(json(value), "validation", "Project export must contain only JSON data");
  return canonical(value) + "\n";
}
