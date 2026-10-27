import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Tracer } from "../src/application/service.ts";

// The same public commands used by clients; no direct storage fixture shortcuts.
export async function benchmarkEvidence(tracer: Tracer, ids: string[], unrelatedCount = 5000) {
  const actor = { actor: "benchmark" };
  const baseline = await tracer.baselines.capture(
    { name: "Before criterion change", expectedProjectRevision: (await tracer.timeline()).head },
    actor,
  );
  const relevant = await tracer.evidence.recordReceipt(
    {
      outputId: ids[1],
      outcome: "Synthetic result",
      inputs: [{ entityId: ids[0], fields: ["title"] }],
    },
    actor,
  );
  const root = await tracer.getEntity(ids[0]);
  await tracer.updateEntity(
    root.id,
    root.version,
    { fields: { title: "Changed criterion" } },
    1,
    actor,
  );
  const query = {
    baselineId: baseline.id,
    rootId: root.id,
    direction: "outgoing" as const,
    relationshipTypes: ["depends"],
    depth: 2,
    limit: 25,
  };
  const measure = async () => {
    const samplesMs: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
      const started = performance.now(),
        result = await tracer.getChangeImpact(query);
      samplesMs.push(performance.now() - started);
      assert.equal(result.evaluations.items.length, 1);
      assert.equal(result.evaluations.items[0].receipt.id, relevant.id);
      assert.equal(result.evaluations.items[0].scope.hasChanged, true);
      assert.equal(result.evaluations.nextAfter, undefined);
    }
    const sorted = [...samplesMs].sort((a, b) => a - b);
    return { samplesMs, medianMs: sorted[2], maxMs: sorted[4], matchingReceipts: 1 };
  };
  const beforeUnrelated = await measure();
  const selected = await tracer.getChangeImpact(query);
  const selectedIds = new Set(selected.native.after.paths.map((p) => p.entityId));
  const outside = ids.find((id) => !selectedIds.has(id));
  assert.ok(outside);
  const started = performance.now();
  for (let index = 0; index < unrelatedCount; index++)
    await tracer.evidence.recordReceipt(
      {
        outputId: outside,
        outcome: "Unrelated synthetic result",
        inputs: [{ entityId: outside, fields: ["title"] }],
      },
      actor,
    );
  const seedMs = performance.now() - started;
  return {
    unrelatedReceipts: unrelatedCount,
    seedMs,
    beforeUnrelated,
    afterUnrelated: await measure(),
    scope:
      "Five local sequential bounded impact reads per sample set; not concurrent-user throughput or a release threshold.",
  };
}
