import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { referenceUseFixture } from "./reference-use-fixture.ts";
import { verificationActor as actor } from "./verification-fixture.ts";
import { createClient } from "../src/client.ts";
import { startHeadlessServer } from "../src/interfaces/headless-server.ts";

for (const external of [true, false])
  test(`${external ? "observed" : "native"}: associated receipt uses keep B/C and identical-state distinct selectors independent of default C`, async () => {
    const x = await referenceUseFixture("engineering", external),
      { f } = x;
    try {
      const target = await x.capture();
      const body = {
        outputId: f.requirement.id,
        outcome: "Synthetic explicit reference-use capture",
        configurationId: target.id,
        inputs: [0, 1, 2].map(x.input),
        relationshipInputs: x.relationships([0, 1, 2]),
      };
      const receipt = await f.tracer.evidence.recordReceipt(body, actor);
      assert.deepEqual(
        receipt.inputs.map((row) => row.referenceId),
        x.refs.slice(0, 3).map((row) => row.id),
      );
      assert.deepEqual(
        receipt.inputs.map((row) =>
          external ? row.observation!.hash?.at(-1) : row.entity.fields.text,
        ),
        [external ? "b" : "B", external ? "c" : "C", external ? "b" : "B"],
      );
      const compared = await f.tracer.configurations.compareReceipt({
        configurationId: target.id,
        receiptId: receipt.id,
      });
      assert.deepEqual(
        compared.comparison.inputs.map((row) => row.state),
        ["changed", "current", "changed"],
      );
      const before = await f.tracer.exportProject();
      await assert.rejects(
        f.tracer.evidence.recordReceipt({ ...body, inputs: [x.input(0), x.input(0)] }, actor),
        { code: "validation", message: /each input once/ },
      );
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          {
            ...body,
            inputs: [
              { ...x.input(0), ...(external ? { observationId: x.C!.id } : { revision: 2 }) },
            ],
          },
          actor,
        ),
        { code: "validation" },
      );
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          { ...body, relationshipInputs: [], inputs: [x.input(0)] },
          actor,
        ),
        { code: "validation", message: /explicitly captured qualified relationship/ },
      );
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          { ...body, inputs: [{ ...x.input(0), entityId: f.method.id }] },
          actor,
        ),
        { code: "validation", message: /same resource/ },
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
      const historical = {
        ...x.input(3),
        ...(external ? { observationId: x.B!.id } : { revision: 1 }),
      };
      const { configurationId, ...unconfigured } = body;
      assert.equal(configurationId, target.id);
      const raw = await f.tracer.evidence.recordReceipt(
        {
          ...unconfigured,
          inputs: [historical],
          relationshipInputs: x.relationships([3]),
        },
        actor,
      );
      assert.equal(
        external ? raw.inputs[0].observation!.id : raw.inputs[0].entity.version,
        external ? x.B!.id : 1,
      );
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          { ...body, inputs: [historical], relationshipInputs: x.relationships([3]) },
          actor,
        ),
        { code: "validation" },
      );
    } finally {
      f.close();
    }
  });

test("HTTP receipt association is explicit, rejects malformed references and preserves atomic evaluation recovery", async () => {
  const x = await referenceUseFixture(),
    { f } = x;
  const server = await startHeadlessServer(f.tracer, { port: 0, provenance: actor });
  try {
    const client = createClient({ baseUrl: server.origin });
    await client.connect();
    const command = {
      commandId: randomUUID(),
      expectedSchemaVersion: 2,
      expectedProjectRevision: (await f.tracer.getProjectSnapshot()).projectRevision,
      operations: [],
      receipt: {
        outputId: f.requirement.id,
        outcome: "Synthetic associated use",
        inputs: [x.input(0)],
        relationshipInputs: x.relationships([0]),
      },
    };
    const result = await client.write("/api/evaluation-commands", command);
    assert.equal(result.receipt.inputs[0].referenceId, x.refs[0].id);
    assert.equal(result.receipt.inputs[0].observation!.id, x.B!.id);
    assert.deepEqual(await client.write("/api/evaluation-commands", command), result);
    const before = await f.tracer.exportProject();
    await assert.rejects(
      client.write("/api/receipts", {
        ...command.receipt,
        inputs: [{ ...x.input(0), referenceId: "undeclared" }],
      }),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    await server.close();
    f.close();
  }
});

test("historical observed inputs retain identity snapshot and observation independently without inferring current availability", async () => {
  const x = await referenceUseFixture(),
    { f } = x;
  try {
    await f.tracer.removeEntity(x.resource.id, 1, 2, actor, true);
    const input = {
      entityId: x.resource.id,
      facet: "content" as const,
      revision: 1,
      observationId: x.B!.id,
    };
    const body = {
      outputId: f.requirement.id,
      outcome: "Historical used bytes; no current availability claim",
      inputs: [input],
    };
    const receipt = await f.tracer.evidence.recordReceipt(body, actor);
    assert.equal(receipt.inputs[0].pin!.entity.id, x.resource.id);
    assert.equal(receipt.inputs[0].observation!.id, x.B!.id);
    assert.equal((await f.tracer.evidence.compareReceipt(receipt.id)).state, "unknown");
    const before = await f.tracer.exportProject();
    const { observationId, ...missing } = input;
    assert.equal(observationId, x.B!.id);
    await assert.rejects(f.tracer.evidence.recordReceipt({ ...body, inputs: [missing] }, actor), {
      code: "validation",
    });
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        { ...body, inputs: [{ ...input, fields: ["label"] }] },
        actor,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        {
          ...body,
          inputs: [{ entityId: x.resource.id, facet: "content", referenceId: x.refs[3].id }],
          relationshipInputs: x.relationships([3]),
        },
        actor,
      ),
      { code: "validation", message: /unavailable/ },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});
