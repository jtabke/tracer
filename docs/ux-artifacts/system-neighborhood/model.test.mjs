import { test } from "node:test";
import assert from "node:assert/strict";
// These ordered imports execute the same classic globals as index.html; Node's
// test process provides isolation without replacing the model with a mock.
import "./fixture.js";
import "./model.js";
const model = globalThis.TracerToy;
const original = JSON.stringify(model.fixture);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("fictional family has readable siblings and one shared child, not cloned identities", () => {
  const state = model.initial();
  assert.equal(model.items(state).length, 12);
  assert.equal(model.family(state).length, 4);
  assert.equal(model.parents(state, "SW-LIMIT").length, 2);
  assert.ok(model.fixture.items.every((item) => item.statement.length > 70));
  state.scope = "SYS-STOP";
  assert.equal(model.family(state).length, 3);
  assert.ok(model.visible(state).some((item) => item.id === "DRV-CFG"));
});

test("local editing changes one identity in either family but never original intent or evidence", () => {
  const state = model.initial();
  model.edit(state, "SW-LIMIT", "statement", model.fixture.proposal);
  state.scope = "SYS-STOP";
  assert.equal(
    model.family(state).find((item) => item.id === "SW-LIMIT").statement,
    model.fixture.proposal,
  );
  assert.deepEqual(plain(model.evidence(state, "TEST-STOP")), ["SW-LIMIT"]);
  assert.deepEqual(plain(model.evidence(state, "TEST-VOLUME")), []);
  assert.equal(model.changed(state, "SYS-DEL"), false);
  assert.equal(model.changed(state, "MECH-TRANS"), false);
  assert.equal(JSON.stringify(model.fixture), original);
  model.edit(state, "SW-LIMIT", "statement", model.item(state, "SW-LIMIT").statement);
  assert.equal(model.changed(state, "SW-LIMIT"), false);
});

test("connecting existing information adds a proposed edge, not a duplicate or coverage verdict", () => {
  const state = model.initial();
  model.connect(state, "MECH-BACKLASH");
  assert.equal(model.items(state).length, 12);
  assert.equal(model.family(state).length, 5);
  assert.throws(() => model.connect(state, "MECH-BACKLASH"));
  assert.throws(() => model.connect(state, "TEST-STOP"));
  assert.equal(JSON.stringify(model.fixture), original);
});

test("authoring uses the captured parent, not a later browsing scope", () => {
  const state = model.initial();
  state.scope = "SYS-STOP";
  const id = model.add(
    state,
    "Recovery",
    "Record a declared recovery condition without inventing an approved stopping policy.",
    "Software",
    "SYS-DEL",
  );
  assert.equal(model.parents(state, id)[0].from, "SYS-DEL");
  assert.equal(
    model.family(state).some((item) => item.id === id),
    false,
  );
  assert.equal(model.item(state, id).version, "Local draft");
});

test("explicit export/resume retains scope, edits, questions, relationships and unfinished author text", () => {
  const state = model.initial();
  model.edit(state, "SW-LIMIT", "statement", model.fixture.proposal);
  model.connect(state, "MECH-BACKLASH");
  model.add(
    state,
    "Recovery",
    "Define a bench recovery condition; engineering agreement remains necessary.",
    "Software",
  );
  state.author.title = "Still drafting";
  state.author.statement = "This text is not yet a contribution.";
  state.questions["TEST-STOP"] = "Would ramp-down need a new sequence observation?";
  state.lens = "change";
  assert.deepEqual(plain(model.validate(JSON.stringify(state))), plain(state));
});

test("invalid resumes reject without mutating the original fixture or supplied live workspace", () => {
  const state = model.initial(),
    saved = JSON.stringify(state);
  for (const alter of [
    (value) => {
      value.prototype = "production";
    },
    (value) => {
      value.drafts.UNKNOWN = { title: "x", statement: "x" };
    },
    (value) => {
      value.addedLinks = [{ from: "SYS-DEL", to: "SW-LIMIT", meaning: "proposed contribution" }];
    },
    (value) => {
      value.author.scope = "UNKNOWN";
    },
    (value) => {
      value.author.title = "x".repeat(201);
    },
    (value) => {
      value.baseline = [];
    },
    (value) => {
      value.drafts["SW-LIMIT"] = { title: "x", statement: "x", inputs: [] };
    },
  ]) {
    const candidate = JSON.parse(saved);
    alter(candidate);
    assert.throws(() => model.validate(JSON.stringify(candidate)));
  }
  assert.throws(() => model.validate("x".repeat(200001)));
  assert.equal(JSON.stringify(state), saved);
  assert.equal(JSON.stringify(model.fixture), original);
});

test("resume validators independently enforce author, item, dictionary and relationship boundaries", () => {
  const invalid = [
    (state) => {
      state.author.title = "x".repeat(201);
    },
    (state) => {
      state.author.kind = "Invented";
    },
    (state) => {
      state.questions = [];
    },
    (state) => {
      state.questions.UNKNOWN = "Unowned";
    },
    (state) => {
      state.drafts["SW-LIMIT"] = { title: "Valid", statement: 2 };
    },
    (state) => {
      state.addedItems.push({
        id: "LOCAL-1",
        title: " ",
        statement: "Valid",
        kind: "Software",
        version: "Local draft",
      });
    },
    (state) => {
      state.addedLinks.push({ from: "SYS-DEL", to: "TEST-STOP", meaning: "proposed contribution" });
    },
    (state) => {
      state.addedLinks.push({ from: "SYS-DEL", to: "SW-LIMIT", meaning: "proposed contribution" });
    },
    (state) => {
      state.extra = "unsupported";
    },
  ];
  for (const change of invalid) {
    const state = model.initial();
    change(state);
    assert.throws(() => model.validate(JSON.stringify(state)));
    assert.equal(JSON.stringify(model.fixture), original);
  }
});
