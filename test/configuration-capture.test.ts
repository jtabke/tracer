import test from "node:test";
import assert from "node:assert/strict";
import { Tracer } from "../src/index.ts";
import type { Repository, Transaction } from "../src/application/ports/repository.ts";
import {
  configurationCaptureFixture,
  configurationActor as actor,
} from "./configuration-capture-fixture.ts";

test("exact configuration captures native annotations, topology and explicit content; original identity recovers through later edits, deletion, schema change and reopen", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      before = await f.tracer.exportProject(),
      captured = await f.tracer.configurations.captureExact(input, actor);
    assert.equal(captured.capture!.context.projectRevision, input.expectedProjectRevision);
    assert.deepEqual(captured.capture!.content[0].observation, f.observation);
    assert.equal(captured.members[2].entity.fields.title, "Specification annotations");
    assert.equal(captured.relationships![0].relationship.id, f.link.id);
    assert.deepEqual((await f.tracer.exportProject()).provenance, before.provenance);
    assert.deepEqual((await f.tracer.exportProject()).evidence, before.evidence);
    await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "New live candidate", value: 2 } },
      1,
      actor,
    );
    await f.tracer.removeRelationship(f.link.id, 1, 1, actor);
    await f.tracer.removeEntity(f.root.id, 1, 1, actor);
    await f.tracer.setSchema(
      {
        ...f.schema,
        entityTypes: {
          item: { fields: { ...f.schema.entityTypes.item.fields, note: { type: "string" } } },
        },
      },
      1,
      actor,
    );
    f.reopen();
    const current = await f.tracer.exportProject();
    assert.deepEqual(await f.tracer.configurations.captureExact(input, actor), captured);
    assert.deepEqual(await f.tracer.configurations.get(input.id), captured);
    assert.deepEqual(await f.tracer.exportProject(), current);
    for (const other of [
      { ...input, name: "Different intent" },
      { ...input, expectedProjectRevision: input.expectedProjectRevision + 1 },
      { ...input, members: [...input.members].reverse() },
    ])
      await assert.rejects(f.tracer.configurations.captureExact(other, actor), {
        code: "conflict",
      });
    await assert.rejects(
      f.tracer.configurations.captureExact(input, { ...actor, actor: "different actor" }),
      { code: "conflict" },
    );
  } finally {
    f.close();
  }
});

test("exact capture requires explicit external state and preserves explained unknowns without observer IO", async () => {
  const f = await configurationCaptureFixture();
  try {
    const noIO = new Tracer(f.repository, undefined, async () => {
        throw Error("Capture must not observe");
      }),
      input = await f.input();
    await assert.rejects(noIO.configurations.captureExact({ ...input, content: [] }, actor), {
      code: "validation",
    });
    assert.equal((await f.tracer.configurations.list()).items.length, 0);
    const unknown = {
      ...input,
      content: [
        {
          entityId: f.material.id,
          observationId: null,
          reason: "Source was deliberately not available for this candidate",
        },
      ],
    };
    const saved = await noIO.configurations.captureExact(unknown, actor);
    assert.equal(saved.capture!.content[0].observation, null);
    assert.match(saved.capture!.content[0].reason!, /not available/);
    const second = await f.input();
    second.content[0].entityId = f.part.id;
    await assert.rejects(noIO.configurations.captureExact(second, actor), { code: "validation" });
  } finally {
    f.close();
  }
});

test("invalid, stale and oversized captures neither append history nor reserve the caller identity", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      before = await f.tracer.exportProject();
    const invalid = [
      { ...input, expectedSchemaVersion: 2 },
      { ...input, expectedProjectRevision: 0 },
      { ...input, expectedEvidenceRevision: 0 },
      { ...input, members: [input.members[0], input.members[0]] },
      { ...input, relationships: [input.relationships[0], input.relationships[0]] },
      { ...input, content: [input.content[0], input.content[0]] },
      { ...input, content: [{ entityId: f.material.id, observationId: null }] },
      { ...input, content: [{ entityId: f.material.id, observationId: "missing" }] },
      { ...input, content: [{ entityId: "outside", observationId: f.observation.id }] },
      { ...input, scope: { ...input.scope, rationale: "x".repeat(4001) } },
      { ...input, unsupported: true },
    ];
    for (const value of invalid) {
      await assert.rejects(f.tracer.configurations.captureExact(value, actor));
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
    assert.equal((await f.tracer.configurations.captureExact(input, actor)).id, input.id);
    const legacy = await f.tracer.configurations.capture(
      {
        name: "Legacy",
        subjectId: f.root.id,
        expectedSubjectVersion: 1,
        members: [{ entityId: f.root.id, version: 1 }],
      },
      actor,
    );
    assert.equal(legacy.capture, undefined);
    await assert.rejects(f.tracer.configurations.captureExact({ ...input, id: legacy.id }, actor), {
      code: "conflict",
    });
  } finally {
    f.close();
  }
});

test("capture owns invocation data while queued and rolls back an append failure before identity reuse", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input();
    let unblock!: () => void;
    const waiting = f.repository.transaction(
      () =>
        new Promise<void>((r) => {
          unblock = r;
        }),
    );
    await new Promise<void>((r) => setImmediate(r));
    const original = structuredClone(input),
      pending = f.tracer.configurations.captureExact(input, actor);
    input.name = "Caller mutation";
    input.content[0].observationId = null;
    unblock();
    await waiting;
    const saved = await pending;
    assert.deepEqual(saved.capture!.intent, original);
    const next = await f.input(),
      before = await f.tracer.exportProject();
    const failing: Repository = {
      close() {},
      transaction: (work) =>
        f.repository.transaction((tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "appendConfiguration")
                  return async (value: Parameters<Transaction["appendConfiguration"]>[0]) => {
                    await target.appendConfiguration(value);
                    throw Error("post-append failure");
                  };
                return Reflect.get(target, key);
              },
            }),
          ),
        ),
    };
    await assert.rejects(new Tracer(failing).configurations.captureExact(next, actor), {
      code: "storage",
    });
    assert.deepEqual(await f.tracer.exportProject(), before);
    assert.equal((await f.tracer.configurations.captureExact(next, actor)).id, next.id);
  } finally {
    f.close();
  }
});

test("exact configuration result overflow rolls back before publication", async () => {
  const f = await configurationCaptureFixture();
  try {
    await f.tracer.updateEntity(
      f.part.id,
      1,
      { fields: { title: "Large native state", value: "x".repeat(2097152) } },
      1,
      actor,
    );
    const input = await f.input();
    input.members[1].version = 2;
    const before = await f.tracer.exportProject();
    await assert.rejects(f.tracer.configurations.captureExact(input, actor), /byte budget/);
    assert.deepEqual(await f.tracer.exportProject(), before);
    await assert.rejects(f.tracer.configurations.get(input.id), { code: "not_found" });
  } finally {
    f.close();
  }
});

test("exact capture accepts full 100-member/200-link/100-content scope and refuses cardinality/input-byte overflow atomically", async () => {
  const f = await configurationCaptureFixture();
  try {
    const members = [f.root, f.part, f.material],
      content = [];
    for (let i = 3; i < 100; i++)
      members.push(
        await f.tracer.createEntity(
          {
            type: "item",
            fields: { title: `Member ${i}`, value: i },
            resource: {
              label: `Source ${i}`,
              source: { system: "file", externalId: `/synthetic/member-${i}` },
            },
          },
          1,
          actor,
        ),
      );
    for (const [i, member] of members.entries()) {
      if (i < 2)
        await f.tracer.evidence.bindExternal(
          {
            entityId: member.id,
            system: "file",
            externalId: `/synthetic/member-${i}`,
            ownership: "external",
          },
          actor,
        );
      const observation = await f.tracer.evidence.observe(
        { entityId: member.id, locator: { system: "file", path: `/synthetic/member-${i}` } },
        actor,
      );
      content.push({ entityId: member.id, observationId: observation.id });
    }
    const relationships = [f.link];
    for (let i = 1; i < 200; i++)
      relationships.push(
        await f.tracer.createRelationship(
          { type: "depends", source: f.root.id, target: f.part.id, fields: {} },
          1,
          actor,
        ),
      );
    const input = await f.input();
    input.members = members.map((x) => ({ entityId: x.id, version: x.version }));
    input.relationships = relationships.map((x) => ({ relationshipId: x.id, version: 1 }));
    input.content = content;
    const saved = await f.tracer.configurations.captureExact(input, actor);
    assert.equal(saved.members.length, 100);
    assert.equal(saved.relationships!.length, 200);
    assert.equal(saved.capture!.content.length, 100);
    const before = await f.tracer.exportProject();
    for (const invalid of [
      { ...input, id: "overflow-members", members: [...input.members, input.members[0]] },
      {
        ...input,
        id: "overflow-links",
        relationships: [...input.relationships, input.relationships[0]],
      },
      { ...input, id: "overflow-content", content: [...content, content[0]] },
      {
        ...input,
        id: "overflow-bytes",
        content: content.map((x) => ({ ...x, reason: "x".repeat(4000) })),
      },
    ]) {
      await assert.rejects(f.tracer.configurations.captureExact(invalid, actor));
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
  } finally {
    f.close();
  }
});

test("concurrent original capture intents cannot create duplicate identities", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      before = await f.tracer.exportProject(),
      results = await Promise.all([
        f.tracer.configurations.captureExact(input, actor),
        f.tracer.configurations.captureExact(input, actor),
      ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal((await f.tracer.configurations.list()).items.length, 1);
    const after = await f.tracer.exportProject();
    assert.deepEqual(after.current, before.current);
    assert.deepEqual(after.provenance, before.provenance);
    assert.deepEqual(after.evidence, before.evidence);
  } finally {
    f.close();
  }
});

test("receipt capture uses the configuration's exact content and native facets after later observations, never the current source", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      configuration = await f.tracer.configurations.captureExact(input, actor);
    await f.tracer.updateEntity(
      f.material.id,
      1,
      { fields: { title: "Later annotations", value: 2 } },
      1,
      actor,
    );
    const later = new Tracer(f.repository, undefined, async () => ({
      availability: "available",
      hash: "sha256:" + "b".repeat(64),
    }));
    const observed = await later.evidence.observe(
      {
        entityId: f.material.id,
        locator: { system: "file", path: "/synthetic/specification.txt" },
      },
      actor,
    );
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        configurationId: configuration.id,
        outcome: "Explicit recorded observations, not an inferred pass",
        inputs: [
          { entityId: f.material.id, facet: "content", role: "Selected original source bytes" },
          {
            entityId: f.material.id,
            facet: "native",
            fields: ["value"],
            role: "Selected native annotations",
          },
        ],
      },
      actor,
    );
    assert.equal(receipt.inputs[0].observation!.id, f.observation.id);
    assert.equal(receipt.inputs[0].observation!.hash, "sha256:" + "a".repeat(64));
    assert.equal(receipt.inputs[0].entity.version, 1);
    assert.equal(receipt.inputs[0].pin!.entity.version, 1);
    assert.equal(receipt.inputs[0].contentRetention, "external-content-not-retained");
    assert.equal(receipt.inputs[1].observation, undefined);
    assert.equal(receipt.inputs[1].entity.fields.value, 1);
    assert.equal((await f.tracer.evidence.compareReceipt(receipt.id)).state, "changed");
    const before = await f.tracer.exportProject();
    for (const declaration of [
      { entityId: f.material.id },
      { entityId: f.material.id, facet: "content" as const, observationId: observed.id },
      { entityId: f.material.id, facet: "content" as const, fields: ["value"] },
    ]) {
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          {
            outputId: f.root.id,
            configurationId: configuration.id,
            outcome: "Must reject ambiguous input",
            inputs: [declaration],
          },
          actor,
        ),
        { code: "validation" },
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
  } finally {
    f.close();
  }
});

test("undeclared or unknown configuration content and native revision tags cannot fabricate observed receipt inputs", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input();
    input.content = [
      { entityId: f.material.id, observationId: null, reason: "No source state selected" },
    ];
    const unknown = await f.tracer.configurations.captureExact(input, actor),
      legacy = await f.tracer.configurations.capture(
        {
          name: "Legacy native only",
          subjectId: f.root.id,
          expectedSubjectVersion: 1,
          members: [{ entityId: f.part.id, version: 1 }],
        },
        actor,
      ),
      before = await f.tracer.exportProject();
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          configurationId: unknown.id,
          outcome: "Unknown content",
          inputs: [{ entityId: f.material.id, facet: "content" }],
        },
        actor,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          configurationId: legacy.id,
          outcome: "Undeclared content",
          inputs: [{ entityId: f.part.id, facet: "content" }],
        },
        actor,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: "Native pin is not observed bytes",
          inputs: [{ entityId: f.part.id, revision: 1, facet: "content" }],
        },
        actor,
      ),
      { code: "validation" },
    );
    await assert.rejects(
      f.tracer.evidence.recordReceipt(
        {
          outputId: f.root.id,
          outcome: "Native current is not observed bytes",
          inputs: [{ entityId: f.part.id, facet: "content" }],
        },
        actor,
      ),
      { code: "validation" },
    );
    assert.deepEqual(await f.tracer.exportProject(), before);
  } finally {
    f.close();
  }
});

test("configuration topology uses native resource source/target permissions and retains qualified historical references", async () => {
  const f = await configurationCaptureFixture();
  try {
    await f.tracer.setSchema(
      {
        ...f.schema,
        relationshipTypes: {
          ...f.schema.relationshipTypes,
          cites: {
            fields: {},
            source: ["item"],
            target: [],
            resourceTarget: true,
            reference: true,
          },
          resource_input: { fields: {}, source: [], resourceSource: true, target: ["item"] },
        },
      },
      1,
      actor,
    );
    const resource = await f.tracer.createEntity(
        {
          type: "@resource",
          fields: {},
          resource: {
            label: "Independent specification",
            source: { system: "file", externalId: "/synthetic/independent-spec" },
          },
        },
        2,
        actor,
      ),
      observation = await f.tracer.evidence.observe(
        { entityId: resource.id, locator: { system: "file", path: "/synthetic/independent-spec" } },
        actor,
      ),
      cites = await f.tracer.createRelationship(
        {
          type: "cites",
          source: f.root.id,
          target: resource.id,
          fields: {},
          reference: {
            role: "definition",
            explanation: "Captured qualified source",
            state: { mode: "pinned", observationId: observation.id },
          },
        },
        2,
        actor,
      ),
      inputLink = await f.tracer.createRelationship(
        { type: "resource_input", source: resource.id, target: f.part.id, fields: {} },
        2,
        actor,
      ),
      input = await f.input();
    input.members.push({ entityId: resource.id, version: 1 });
    input.content.push({ entityId: resource.id, observationId: observation.id });
    input.relationships.push(
      ...[cites, inputLink].map((x) => ({ relationshipId: x.id, version: 1 })),
    );
    const saved = await f.tracer.configurations.captureExact(input, actor);
    assert.deepEqual(
      saved.relationships!.find((p) => p.relationship.id === cites.id)!.relationship.reference,
      cites.reference,
    );
    assert.equal(
      saved.relationships!.find((p) => p.relationship.id === inputLink.id)!.relationship.source,
      resource.id,
    );
    await f.tracer.removeRelationship(cites.id, 1, 2, actor);
    await f.tracer.removeRelationship(inputLink.id, 1, 2, actor);
    assert.deepEqual(await f.tracer.configurations.captureExact(input, actor), saved);
    assert.deepEqual(await f.tracer.configurations.get(input.id), saved);
  } finally {
    f.close();
  }
});

test("controlled configuration receipts select exact historical topology instead of the later live relationship", async () => {
  const f = await configurationCaptureFixture();
  try {
    const input = await f.input(),
      configuration = await f.tracer.configurations.captureExact(input, actor);
    await f.tracer.updateRelationship(
      f.link.id,
      1,
      { type: "depends", source: f.root.id, target: f.material.id, fields: {} },
      1,
      actor,
    );
    const receipt = await f.tracer.evidence.recordReceipt(
      {
        outputId: f.root.id,
        configurationId: configuration.id,
        outcome: "Selected topology only",
        inputs: [],
        relationshipInputs: [{ id: f.link.id, role: "Exact selected connection" }],
      },
      actor,
    );
    assert.equal(receipt.relationshipInputs![0].relationship.version, 1);
    assert.equal(receipt.relationshipInputs![0].relationship.target, f.part.id);
    assert.equal(
      (await f.tracer.evidence.compareReceipt(receipt.id)).relationshipInputs![0].state,
      "changed",
    );
    const before = await f.tracer.exportProject();
    for (const selected of [
      { id: f.link.id, revision: 2 },
      { id: f.link.id, expectedVersion: 2 },
      { id: "outside-scope" },
    ]) {
      await assert.rejects(
        f.tracer.evidence.recordReceipt(
          {
            outputId: f.root.id,
            configurationId: configuration.id,
            outcome: "Must reject live/outside topology",
            inputs: [],
            relationshipInputs: [selected],
          },
          actor,
        ),
        { code: "validation" },
      );
      assert.deepEqual(await f.tracer.exportProject(), before);
    }
  } finally {
    f.close();
  }
});
