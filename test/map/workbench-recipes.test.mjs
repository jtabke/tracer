import test from "node:test";
import assert from "node:assert/strict";
import { matrixRecipeDefinition, matrixRecipeScope } from "../../ui/workbench/matrix-recipes.ts";

test("Matrix recipe restores project scope without inheriting an unrelated investigation", () => {
  const state = {
    matrixRootType: "requirement",
    matrixSearch: "cutoff",
    matrixSteps: [{ type: "verified_by", targetType: "test" }],
  };
  const saved = matrixRecipeDefinition(state);
  const scope = matrixRecipeScope(saved);
  assert.equal(scope.matrixScope, "project");
  assert.equal(scope.investigation, null);
  assert.equal(scope.pathLinkIds, null);
  assert.equal(scope.matrixCell, null);
  assert.deepEqual(matrixRecipeDefinition(scope), saved);
  scope.matrixSteps[0].type = "changed";
  assert.equal(saved.steps[0].relationshipType, "verified_by");
  assert.equal(state.matrixSteps[0].type, "verified_by");
});
test("incoming recipes are rejected whole rather than silently reversing stored paths", () => {
  const definition = {
    kind: "chain",
    type: "test",
    steps: [{ type: "requirement", relationshipType: "verified_by", direction: "incoming" }],
  };
  assert.equal(matrixRecipeScope(definition), null);
  assert.deepEqual(matrixRecipeScope({ kind: "chain", type: "test", steps: [] }).matrixSteps, []);
});
