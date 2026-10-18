import test from "node:test";
import assert from "node:assert/strict";
import {
  createNavigationState,
  createWorkspaceNavigation,
} from "../ui/workbench/workspace-navigation.ts";

type Options = Parameters<typeof createWorkspaceNavigation>[0];
function fixture(overrides: Partial<Options> = {}) {
  const state = createNavigationState("A", ["A", "B"], 10, "graph", true);
  const calls: unknown[] = [];
  let head = 10;
  const paths = {
    roots: ["B"],
    keys: ["B", "C"],
    links: [{ id: "exact-link", source: "B", target: "C" }],
    levels: new Map([
      ["B", 0],
      ["C", 1],
    ]),
  };
  const navigation = createWorkspaceNavigation({
    state,
    head: () => head,
    trace: () => ({ root: "A", keys: ["A", "B"] }),
    relevantFeed: () => [{ revision: 9 }, { revision: 3 }, { revision: 6 }],
    paths: () => paths,
    neighborhood: () => ({ keys: ["B"], omitted: 2 }),
    selection: {
      clear: () => calls.push("clear"),
      flush: () => calls.push("flush"),
    },
    rememberDraft: () => calls.push(["draft", state.selected, state.editing]),
    beginDraft: () => calls.push("begin"),
    render: () => calls.push("render"),
    notify: (message) => calls.push(message),
    panelMode: () => "docked",
    focus: (target) => calls.push(["focus", target]),
    revealMatrixRelationship: () => calls.push("reveal-link"),
    ...overrides,
  });
  return { state, calls, navigation, paths, setHead: (value: number) => (head = value) };
}

test("navigation defaults preserve view-specific inspector preferences and independent scopes", () => {
  const keys = ["A"];
  for (const [view, expected] of [
    [null, "graph"],
    ["invalid", "graph"],
    ["matrix", "matrix"],
    ["history", "history"],
  ]) {
    const state = createNavigationState("A", keys, 0, view, true);
    assert.equal(state.perspective, expected);
    assert.equal(state.inspector, view !== "matrix");
    assert.equal(state.revision, 0);
    state.visible.add("B");
    assert.deepEqual([...state.baseScope], ["A"]);
  }
  assert.deepEqual(keys, ["A"]);
  assert.equal(createNavigationState("A", keys, 1, "history", false).inspector, false);
});

test("selection captures the previous draft before changing identity and preserves draft-owned Matrix context", () => {
  const { state, calls, navigation } = fixture({ panelMode: () => "drawer" });
  const draft = {
    kind: "artifact" as const,
    id: "A",
    schemaVersion: 1,
    row: 0,
    column: 0,
    key: "A",
    title: "attempted title",
    statement: "original statement",
    version: 2,
    fields: {},
  };
  state.matrixDraft = draft;
  state.matrixSubject = "original-root";
  state.editing = true;
  state.edge = "parallel-link-2";
  state.revision = 6;
  const camera = state.camera;
  const layout = state.layout;
  navigation.select("B", true);
  assert.deepEqual(calls, ["clear", ["draft", "A", true], "render", ["focus", "inspector-close"]]);
  assert.equal(state.matrixDraft, draft);
  assert.equal(state.matrixSubject, "original-root");
  assert.equal(state.edge, null);
  assert.equal(state.revision, 6);
  assert.equal(state.camera, camera);
  assert.equal(state.layout, layout);
  state.matrixDraft = null;
  state.pathPreview = { keys: ["A", "B"], links: [], revision: 6 };
  navigation.select("A");
  assert.equal(state.matrixSubject, "original-root");
  state.pathPreview = null;
  state.inspector = false;
  navigation.select("B");
  assert.equal(state.matrixSubject, null);
  assert.deepEqual(calls.at(-1), ["focus", { key: "B" }]);
});

test("perspective changes flush queued selection before capturing history and preserve full-editor preferences", () => {
  const base = fixture();
  const { state, calls } = base;
  const { navigation } = fixture({
    state,
    selection: {
      clear() {},
      flush() {
        state.selected = "B";
        state.edge = "exact-link";
      },
    },
    rememberDraft: () => calls.push(["draft", state.selected]),
    render: () => calls.push("render"),
    focus: (target) => calls.push(target),
    revealMatrixRelationship: () => calls.push("reveal-link"),
  });
  state.inspector = false;
  navigation.changePerspective("history");
  assert.deepEqual(state.historySubject, { key: "B", linkId: "exact-link" });
  assert.deepEqual(calls, [["draft", "B"], "render", "history"]);
  assert.equal(state.inspectorPrefs.graph, false);
  navigation.openArtifactAction();
  navigation.changePerspective("matrix");
  assert.equal(state.inspectorPrefs.history, true);
  assert.equal(state.artifactFull, false);
  assert.equal(state.inspector, false);
  assert.deepEqual(calls.slice(-2), ["reveal-link", "matrix"]);
  navigation.backWorkspaceAction();
  assert.equal(state.editing, false);
});

test("revision navigation uses the current head and captures drafts before applying read-only history", () => {
  const { state, navigation, calls, setHead } = fixture();
  state.editing = true;
  navigation.visitRevision("3");
  assert.deepEqual(calls[0], ["draft", "A", true]);
  assert.equal(state.revision, 3);
  assert.equal(state.assessment, 3);
  navigation.showDetails(true);
  assert.equal(state.editing, false);
  assert.ok(!calls.includes("begin"));
  setHead(12);
  navigation.visitRevision(100);
  assert.equal(state.revision, 12);
  navigation.showDetails(true);
  assert.equal(state.editing, true);
  assert.equal(state.sheetState, "partial");
  assert.ok(calls.includes("begin"));
  navigation.visitRevision(-5);
  assert.equal(state.revision, 1);
  navigation.closeDetails();
  assert.deepEqual(calls.at(-1), ["focus", "details"]);
});

test("change investigation retains exact links, copied origin and layout through historical return", () => {
  const { state, navigation, paths } = fixture();
  state.layout.set("A", { x: 10, y: 20 });
  state.edge = "original-link";
  navigation.relationshipHistoryAction();
  const subject = state.historySubject!;
  navigation.pickEvent("6", { showHistory: true });
  navigation.inspectRevisionAction();
  assert.equal(state.perspective, "graph");
  assert.equal(state.revision, 6);
  assert.equal(state.selected, "B");
  assert.deepEqual([...state.pathLinkIds!], ["exact-link"]);
  assert.equal(state.pendingInvestigationLayout, paths);
  assert.deepEqual(state.investigation, { subject, event: 6, revision: 6 });
  assert.notEqual(state.investigation!.subject, subject);
  state.layout.get("A")!.x = 99;
  assert.deepEqual(state.focusReturn!.layout, [["A", { x: 10, y: 20 }]]);
  navigation.returnChangeAction();
  assert.equal(state.perspective, "history");
  assert.deepEqual(state.historySubject, { key: "A", linkId: "original-link" });
  navigation.returnFocusAction();
  assert.deepEqual([...state.visible], ["A", "B"]);
  assert.deepEqual([...state.baseScope], ["A", "B"]);
  assert.deepEqual(state.layout.get("A"), { x: 10, y: 20 });
  assert.equal(state.focusReturn, null);
  navigation.returnChangeAction();
  navigation.resetAction();
  assert.equal(state.investigation, null);
  assert.equal(state.selected, "A");
  assert.equal(state.revision, 6);
  navigation.returnChangeAction();
});

test("event stepping handles filtered gaps and boundaries while retaining an existing history subject", () => {
  const { state, navigation } = fixture();
  navigation.pickEvent(7, { showHistory: true });
  const subject = state.historySubject;
  navigation.stepEvent(-1);
  assert.equal(state.event, 6);
  navigation.stepEvent(1);
  assert.equal(state.event, 9);
  navigation.stepEvent(1);
  assert.equal(state.event, 9);
  navigation.pickEvent(4);
  navigation.stepEvent(1);
  assert.equal(state.event, 6);
  navigation.artifactHistoryAction();
  assert.deepEqual(state.historySubject, subject);
});

test("focus return retains the first scope, supports saved base scopes and does not capture drafts implicitly", () => {
  const { state, navigation, calls } = fixture();
  navigation.focusAction();
  const origin = state.focusReturn;
  navigation.focusAction();
  assert.equal(state.focusReturn, origin);
  assert.ok(!calls.some((call) => Array.isArray(call) && call[0] === "draft"));
  state.focusReturn!.baseScope = ["A"];
  state.focusReturn!.pathIds = ["original-link"];
  delete state.focusReturn!.matrixScope;
  state.matrixScope = "neighborhood";
  navigation.returnFocusAction();
  assert.deepEqual([...state.baseScope], ["A"]);
  assert.deepEqual([...state.pathLinkIds!], ["original-link"]);
  assert.equal(state.matrixScope, "neighborhood");
  navigation.returnFocusAction();
  navigation.expandSheetAction();
  navigation.collapseSheetAction();
  assert.equal(state.sheetState, "collapsed");
  assert.equal(state.inspector, true);
});

test("drawer editing focuses the editor while historical inspection keeps its read-only focus", () => {
  const { state, calls, navigation } = fixture({ panelMode: () => "drawer" });
  navigation.showDetails(true);
  assert.equal(state.editing, true);
  assert.deepEqual(calls.at(-1), ["focus", "draft-title"]);
  navigation.visitRevision(3);
  navigation.showDetails(true);
  assert.equal(state.editing, false);
  assert.deepEqual(calls.at(-1), ["focus", "inspector-close"]);
});
