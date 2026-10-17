import test from "node:test";
import assert from "node:assert/strict";
import { areaChoices } from "../../ui/map/organization.ts";

test("area totals count real identities once, retaining empty authored choices", () => {
  const index = { entities: new Map(["a", "b", "c"].map((id) => [id, { id }])) };
  const organization = {
    a: { path: [], areas: ["Shared", "Shared", "Hardware"] },
    b: { path: [], areas: [] },
    deleted: { path: [], areas: ["Empty"] },
  };
  const before = structuredClone(organization);
  assert.deepEqual(areaChoices(index, organization), [
    { name: "All areas", count: 3 },
    { name: "Empty", count: 0 },
    { name: "Hardware", count: 1 },
    { name: "Shared", count: 1 },
    { name: "Uncategorized", count: 2 },
  ]);
  assert.deepEqual(organization, before);
});
