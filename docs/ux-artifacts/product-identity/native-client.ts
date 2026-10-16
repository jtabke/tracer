// Study adapter: reuse production decoding, transport, guards and recovery ownership.
import { connect, read } from "../../../ui/api.ts";
import { write } from "../../../ui/write-transport.ts";
import { MutationController } from "../../../ui/mutation-controller.ts";
import { reconcileMutation } from "../../../ui/reconcile-mutation.ts";
import type { Operation } from "../../../src/application/commands.ts";
import type { Revision, Changeset } from "../../../src/core/model.ts";
import { projectWorkspace } from "./workspace-snapshot.ts";
export let projects: { id: string; title: string }[] = [];
let lastError: unknown;
export const mutations = new MutationController(write, (error) => {
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
