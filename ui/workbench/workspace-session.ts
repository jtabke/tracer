import { snapshotAt } from "./workspace-history.ts";
import type {
  WorkspaceEntity,
  WorkspaceRelationship,
  projectWorkspace,
} from "./workspace-snapshot.ts";

export type WorkspaceData = ReturnType<typeof projectWorkspace> & {
  modelRevision?: number;
  partial?: boolean;
  projectWide?: boolean;
  historyMore?: boolean;
  feed?: ReturnType<typeof import("./workspace-history.ts").nativeFeed>;
};
type AdoptionReason = "saved" | "refreshed" | "pending-inspected" | "editor-inspected";
type RevisionState = {
  revision: number;
  event: number;
  assessment: number | null;
  evidenceEpoch: number;
};
type ModelState = Pick<RevisionState, "revision"> & {
  localEntities: ReadonlyMap<string, WorkspaceEntity>;
  localLinks: ReadonlyMap<string, WorkspaceRelationship>;
  removed: ReadonlySet<string>;
};

// Owns loaded data and derived history, never writes, acknowledges outcomes or replaces drafts.
export function createWorkspaceSession(initial: WorkspaceData) {
  let data = initial;
  const cache = new Map<number, ReturnType<typeof snapshotAt>>();
  return {
    get data() {
      return data;
    },
    get head() {
      return data.snapshotReference.revision;
    },
    replace(next: WorkspaceData) {
      data = next;
      cache.clear();
    },
    adopt(next: WorkspaceData, reason: AdoptionReason, state: RevisionState) {
      data = next;
      cache.clear();
      state.revision = state.event = data.snapshotReference.revision;
      if (reason === "saved") state.assessment = state.revision;
      if (reason !== "editor-inspected") state.evidenceEpoch++;
    },
    model(state: ModelState) {
      let snapshot = cache.get(state.revision);
      if (!snapshot) {
        snapshot = snapshotAt(data, state.revision);
        cache.set(state.revision, snapshot);
      }
      if (
        state.revision !== data.snapshotReference.revision ||
        !(state.localEntities.size || state.localLinks.size || state.removed.size)
      )
        return snapshot;
      const records = new Map(snapshot.records);
      let links = snapshot.links;
      if (state.revision === data.snapshotReference.revision) {
        for (const [key, record] of state.localEntities) records.set(key, record);
        links = [
          ...links.filter((link) => !state.removed.has(link.id)),
          ...state.localLinks.values(),
        ];
      }
      return { records, links };
    },
  };
}
