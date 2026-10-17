// Shared workspace adapter using native decoding, guards and mutation recovery.
import { connect, read } from "../api.ts";
import { createMutationController } from "../use-mutation.ts";
import type { ProjectSnapshot } from "../../src/core/project-snapshot.ts";
import { reconcileMutation } from "../reconcile-mutation.ts";
import type { Operation } from "../../src/application/commands.ts";
import type { Revision, Changeset } from "../../src/core/model.ts";
import { projectWorkspace } from "./workspace-snapshot.ts";
export let savedViews: import("../../src/core/presentation.ts").SavedView[] = [];
export let projectSnapshot: ProjectSnapshot;
export let projects: { id: string; title: string }[] = [];
let lastError: unknown;
export const mutations = createMutationController((error) => {
  lastError = error;
});
export async function initialize() {
  await connect();
  projects = await read("/api/projects", {});
  return load();
}
export async function load() {
  const snapshot = await read("/api/project-snapshot", {});
  const guide = await read("/api/demo-guide", {});
  const revisions: Revision[] = [];
  let after: string | undefined;
  do {
    const page = await read("/api/history", { limit: 1000, after });
    revisions.push(...page.items);
    after = page.nextAfter;
  } while (after);
  const changesets: Changeset[] = [];
  let before: number | undefined;
  do {
    const page = await read("/api/timeline", { before });
    if (page.head !== snapshot.projectRevision)
      throw new Error("Project changed while reading. Reload before editing.");
    changesets.push(...page.items);
    before = page.nextBefore;
  } while (before);
  const end = await read("/api/project-snapshot", {});
  if (end.projectRevision !== snapshot.projectRevision)
    throw new Error("Project changed while reading. Reload before editing.");
  savedViews = await read("/api/saved-views", {});
  projectSnapshot = snapshot;
  return projectWorkspace(snapshot, revisions, changesets, guide?.tasks[0]?.root);
}
export async function save(expectedSchemaVersion: number, operations: Operation[]) {
  lastError = undefined;
  const result = await mutations.run("/api/changesets", { expectedSchemaVersion, operations });
  if (!result)
    throw (
      lastError ?? new Error("A save is pending. Inspect its outcome before making another change.")
    );
  return result;
}
export async function inspectAttempt() {
  const state = mutations.snapshot();
  if (state.status !== "unknown") return null;
  const finish = mutations.beginReconciliation();
  const results = await reconcileMutation(state.attempt.path, state.attempt.input);
  finish();
  return results;
}
