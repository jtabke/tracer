import test from "node:test";
import assert from "node:assert/strict";
import { verificationFixture, verificationActor as actor } from "./verification-fixture.ts";

for (const domain of ["engineering", "research"] as const)
  test(`${domain}: exact native verification basis retains complete criteria/method assignment without writes`, async () => {
    const f = await verificationFixture(domain);
    try {
      const before = await f.tracer.exportProject(),
        basis = await f.tracer.verification.prepareBasis(f.input);
      assert.equal(basis.coverage.sourceComplete, true);
      assert.equal(basis.coverage.kind, "complete");
      assert.deepEqual(basis.coverage.unassignedCriterionIds, []);
      assert.equal(basis.criteria.length, 2);
      assert.deepEqual(basis.methods[0].relationship, f.relationship);
      assert.equal(basis.requirement.version, 1);
      assert.deepEqual(await f.tracer.exportProject(), before);
      await f.tracer.updateEntity(
        f.requirement.id,
        1,
        {
          fields: {
            ...f.requirement.fields,
            [f.definition.requirement.fields.acceptance[0]]: "Different current acceptance",
          },
        },
        1,
        actor,
      );
      f.reopen();
      assert.deepEqual(
        (await f.tracer.verification.prepareBasis(f.input)).criteria,
        basis.criteria,
      );
      await assert.rejects(
        f.tracer.verification.prepareBasis({
          ...f.input,
          requirement: { ...f.input.requirement, version: 2 },
        }),
        { code: "validation" },
      );
      assert.equal((await f.tracer.verification.prepareBasis(f.input)).requirement.version, 1);
    } finally {
      f.close();
    }
  });

test("partial source coverage and unassigned criteria remain explicit rather than implying complete verification", async () => {
  const f = await verificationFixture();
  try {
    const partial = structuredClone(f.input);
    partial.coverage.kind = "partial";
    partial.criteria.pop();
    partial.methods[0].criterionIds = ["AC-1"];
    const value = await f.tracer.verification.prepareBasis(partial);
    assert.equal(value.coverage.sourceComplete, false);
    assert.equal(value.coverage.kind, "partial");
    await assert.rejects(
      f.tracer.verification.prepareBasis({
        ...partial,
        coverage: { ...partial.coverage, kind: "complete" },
      }),
      { code: "validation" },
    );
    const unplanned = structuredClone(f.input);
    unplanned.methods[0].criterionIds = ["AC-1"];
    assert.deepEqual(
      (await f.tracer.verification.prepareBasis(unplanned)).coverage.unassignedCriterionIds,
      ["AC-2"],
    );
    const deliberatelyPartial = {
      ...f.input,
      coverage: { ...f.input.coverage, kind: "partial" as const },
    };
    const result = await f.tracer.verification.prepareBasis(deliberatelyPartial);
    assert.equal(result.coverage.sourceComplete, true);
    assert.equal(result.coverage.kind, "partial");
  } finally {
    f.close();
  }
});

test("verification basis rejects mismatched quotes, overlapping ranges, duplicate or foreign assignments atomically", async () => {
  const f = await verificationFixture();
  try {
    const before = await f.tracer.exportProject();
    const badQuote = structuredClone(f.input);
    badQuote.criteria[0].quote = "An invented criterion";
    const overlap = structuredClone(f.input);
    overlap.criteria.push({ ...overlap.criteria[0], id: "duplicate range" });
    const duplicate = structuredClone(f.input);
    duplicate.criteria[1].id = duplicate.criteria[0].id;
    const unknown = structuredClone(f.input);
    unknown.methods[0].criterionIds = ["Not in this basis"];
    const repeated = structuredClone(f.input);
    repeated.methods.push(repeated.methods[0]);
    const range = structuredClone(f.input);
    range.criteria[0].start = -1;
    const field = structuredClone(f.input);
    field.criteria[0].field = f.definition.requirement.fields.statement;
    const wrongLink = structuredClone(f.input);
    wrongLink.methods[0].relationship.id = f.requirement.id;
    for (const input of [badQuote, overlap, duplicate, unknown, repeated, range, field])
      await assert.rejects(f.tracer.verification.prepareBasis(input), { code: "validation" });
    await assert.rejects(f.tracer.verification.prepareBasis(wrongLink), { code: "not_found" });
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("verification basis owns invocation-time input while waiting for the repository", async () => {
  const f = await verificationFixture();
  try {
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = f.repository.transaction(async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await ready;
    const input = structuredClone(f.input),
      pending = f.tracer.verification.prepareBasis(input);
    input.criteria[0].quote = "Caller mutation";
    input.methods[0].criterionIds = ["Unknown"];
    release();
    await gate;
    const result = await pending;
    assert.equal(result.criteria[0].quote, f.input.criteria[0].quote);
    assert.deepEqual(result.methods[0].criterionIds, ["AC-1", "AC-2"]);
  } finally {
    f.close();
  }
});

test("verification basis refuses excess assignments and scope bytes rather than returning a partial population", async () => {
  const f = await verificationFixture();
  try {
    const before = await f.tracer.exportProject();
    const large = structuredClone(f.input);
    large.criteria[0].quote = "x".repeat(65536);
    await assert.rejects(f.tracer.verification.prepareBasis(large), /64 KiB/);
    const assignments = structuredClone(f.input);
    assignments.methods = Array.from({ length: 5 }, (_, i) => ({
      ...f.input.methods[0],
      entityId: "method-" + i,
      criterionIds: Array.from({ length: 25 }, (_, j) => "criterion-" + j),
    }));
    await assert.rejects(f.tracer.verification.prepareBasis(assignments), /100 assignments/);
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
