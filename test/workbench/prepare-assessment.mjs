import { disposableOrigin } from "./verification-fixtures.mjs";
// Optional walkthrough setup. Run only on a fresh disposable candidate server.
import assert from "node:assert/strict";
const origin = disposableOrigin();
assert.notEqual(new URL(origin).port, "8174", "Do not seed the owner review server.");
const snapshot = await (await fetch(origin + "/api/project-snapshot")).json();
assert.equal(snapshot.projectRevision, 399, "Use a fresh Aster walkthrough fixture.");
const entity = (key) => snapshot.entities.find((e) => e.key === key);
const output = entity("RUN-01"),
  focus = entity("PRS-02");
const receipts = await (
  await fetch(origin + "/api/evidence?kind=receipt&subject=" + output.id + "&limit=25")
).json();
assert.equal(receipts.items.length, 1, "Walkthrough preparation must not be replayed.");
const token = (await (await fetch(origin + "/api/session")).json()).token;
const response = await fetch(origin + "/api/receipts", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Tracer-Token": token, Origin: origin },
  body: JSON.stringify({
    outputId: output.id,
    expectedOutputVersion: output.version,
    outcome: "SIMULATED bench checks at 10–40 °C for this walkthrough; not physical test evidence.",
    supersedes: receipts.items[0].id,
    inputs: ["PRS-02", "OUT-01", "VER-01"].map((key) => ({
      entityId: entity(key).id,
      expectedVersion: entity(key).version,
      fields: ["statement"],
    })),
  }),
});
assert.ok(response.ok, await response.clone().text());
const receipt = await response.json();
const comparison = await (await fetch(origin + "/api/comparison?receiptId=" + receipt.id)).json();
assert.equal(comparison.state, "current");
console.log(
  JSON.stringify({
    origin,
    revision: 399,
    subject: focus.key,
    subjectId: focus.id,
    outputId: output.id,
    receiptId: receipt.id,
    supersedes: receipt.supersedes,
    capturedVersion: focus.version,
    initialComparison: comparison.state,
  }),
);
