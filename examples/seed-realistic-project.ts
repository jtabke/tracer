import { exampleWorkflow } from "../src/core/workflow-presets.ts";
import { exampleCoverage } from "./coverage-expectations.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { inNewProject } from "./isolated-project.ts";
import { medicalDeviceExample } from "./medical-device-example.ts";
import { technologyExample } from "./technology-example.ts";
import { withDevelopmentContext } from "./development-example-additions.ts";
import { integratedProductExample } from "./integrated-product-example.ts";
import type { Entity, Relationship } from "../src/core/model.ts";
import type { ExampleDefinition } from "./realistic-model.ts";

export type RealisticDomain = "medical" | "technology" | "integrated";

export async function seedRealisticProject(destination: string, domain: RealisticDomain) {
  if (!["medical", "technology", "integrated"].includes(domain))
    throw new Error("Unknown realistic example domain");
  const definition =
    domain === "integrated"
      ? integratedProductExample
      : withDevelopmentContext(
          domain === "medical" ? medicalDeviceExample : technologyExample,
          domain,
        );
  return inNewProject(destination, async (tracer, paths) => {
    const actor = { actor: "fictional-example-author", reason: definition.description };
    await tracer.setSchema(
      exampleWorkflow(
        { ...definition.schema, coverageExpectations: exampleCoverage[domain] },
        domain,
      ),
      0,
      actor,
    );
    const entities: Record<string, Entity> = {};
    const relationships: Relationship[] = [];
    for (const [type, key, title, statement, fields] of definition.items) {
      if (entities[key]) throw new Error(`Duplicate example key: ${key}`);
      entities[key] = (await tracer.createEntity(
        {
          type,
          key,
          fields: {
            title,
            statement,
            status: "illustrative draft",
            owner: "fictional example team",
            notes:
              "Fictional native record for exploration. No actual device, source code, test execution, approval or release is represented.",
            ...fields,
          },
        },
        1,
        actor,
      )) as Entity;
    }
    const entity = (key: string) => {
      if (!entities[key]) throw new Error(`Unknown example key: ${key}`);
      return entities[key];
    };
    for (const configuration of definition.configurations ?? []) {
      const before = entity(configuration.key);
      entities[configuration.key] = (await tracer.updateEntity(
        before.id,
        before.version,
        {
          fields: {
            ...before.fields,
            scope: configuration.scope,
            manifest: configuration.members.map((key) => ({
              entityId: entity(key).id,
              key,
              version: entity(key).version,
            })),
          },
        },
        1,
        {
          actor: actor.actor,
          reason:
            "Record selected native revisions in a navigation manifest; immutable capture is stored separately.",
        },
      )) as Entity;
    }
    const configurations = await captureExampleConfigurations(tracer, definition, entity, actor);
    for (const [type, source, target, scope] of definition.links) {
      relationships.push(
        (await tracer.createRelationship(
          {
            type,
            source: entity(source).id,
            target: entity(target).id,
            fields: {
              scope:
                scope ??
                "Illustrative recorded trace; assess the connected statements for its extent.",
              source_version: entity(source).version,
              review: "unreviewed example annotation",
            },
          },
          1,
          actor,
        )) as Relationship,
      );
    }
    const receipts = await captureExampleReceipts(
      tracer,
      definition,
      entity,
      configurations,
      actor,
    );
    // Actual persisted history: do not imitate stale inputs by merely changing a status string.
    for (const change of definition.changes) {
      const before = entity(change.key);
      entities[change.key] = (await tracer.updateEntity(
        before.id,
        before.version,
        {
          fields: { ...before.fields, statement: change.statement },
        },
        1,
        { actor: actor.actor, reason: change.reason },
      )) as Entity;
    }
    const followUp = await captureFollowUp(tracer, definition, entity, actor);
    if (followUp) configurations.followUp = followUp;
    const tasks = definition.tasks.map((task) => ({
      ...task,
      rootId: entity(task.root).id,
      url:
        "/?" +
        new URLSearchParams({
          item: entity(task.root).id,
          family: task.relationship,
          direction: task.direction ?? "outgoing",
        }),
    }));
    const manifest = {
      title: definition.title,
      description: definition.description,
      domain,
      coverageExpectations: Object.keys(exampleCoverage[domain]),
      sources: definition.sources,
      counts: {
        entities: Object.keys(entities).length,
        relationships: relationships.length,
        receipts: receipts.length,
        configurations: Object.keys(configurations).length,
      },
      keys: Object.fromEntries(Object.entries(entities).map(([key, value]) => [key, value.id])),
      receipts,
      configurations: Object.fromEntries(
        Object.entries(configurations).map(([key, value]) => [key, value.id]),
      ),
      tasks,
      chains: definition.chains,
    };
    writeFileSync(join(paths.directory, "tasks.json"), JSON.stringify(manifest, null, 2) + "\n");
    writeFileSync(join(paths.directory, "GUIDE.md"), guide(definition, tasks));
    return {
      ...paths,
      domain,
      entities,
      relationships,
      receipts,
      configurations,
      tasks,
      chains: definition.chains,
      counts: manifest.counts,
    };
  });
}

function guide(
  definition: ExampleDefinition,
  tasks: (ExampleDefinition["tasks"][number] & { url: string })[],
) {
  const walkthrough = tasks.map(
    (task, index) =>
      `## ${index + 1}. ${task.title}\n\nIn the shared development map, search for \`${task.root}\`. Inspect ${task.inspect.map((key) => `\`${key}\``).join(", ")}.\n\n${task.explanation}`,
  );
  return `# ${definition.title}\n\n${definition.description}\n\nAll examples use the shared development map. Choose the project, search by item key, and select a result to focus its trace. Use the direction and level controls to inspect recorded connections; reveal a chosen branch without replacing the starting map. **Items table** shows the current scope as rows. **Edit item and connections** opens native editing; **Return to map** retains the task draft. **Evaluations** shows captured input versions and review decisions, while **Configurations** shows immutable selected input sets. “Current” means matching captured inputs, not a passing test.\n\n${walkthrough.join("\n\n")}\n\n## Long traces\n\nUse the trace controls to follow a branch and return to the previous trace. Shared records keep one identity wherever they appear. Exact chain queries in tasks.json are available through the headless API/CLI; the historical task URLs are metadata rather than saved map views.\n\n## Structural expectations\n\nUse \`coverage list\` to discover authored policy and \`coverage evaluate\` to inspect exact native counts and bounded samples. Policies require recorded targets only; they do not establish successful execution or release readiness.\n\n## Persistence\n\nSaved items, connections, evaluations, reviews and configurations belong to the selected project database. Map folders, categories and view recipes last only for the current session and reset on reload or project switch.\n\n## Sources and assumptions\n\n${definition.sources.map((source) => `- [${source.title}](${source.url}): ${source.use}`).join("\n")}\n\nAll project-specific prose, numbers and results are illustrative assumptions. Ordinary connections do not infer test coverage or approval. These fixtures contain no external source bindings.\n`;
}

async function captureExampleConfigurations(
  tracer: import("../src/application/service.ts").Tracer,
  definition: ExampleDefinition,
  entity: (key: string) => Entity,
  actor: import("../src/core/model.ts").Provenance,
) {
  const configurations: Record<string, import("../src/core/configuration.ts").Configuration> = {};
  for (const configuration of definition.configurations ?? []) {
    const subject = entity(configuration.key);
    // The explicit evaluation input set includes targets and the build record as well as design members.
    const keys = [
      ...new Set([
        configuration.key,
        ...configuration.members,
        ...definition.receipts
          .filter((record) => record.inputs.includes(configuration.key))
          .flatMap((record) => record.inputs),
      ]),
    ];
    configurations[configuration.key] = await tracer.configurations.capture(
      {
        name: `${configuration.key} · selected native inputs`,
        subjectId: subject.id,
        expectedSubjectVersion: subject.version,
        members: keys.map((key) => ({ entityId: entity(key).id, version: entity(key).version })),
      },
      {
        ...actor,
        reason:
          "Fictional immutable native input set; includes evaluated targets, not a complete production BOM.",
      },
    );
  }

  return configurations;
}

async function captureExampleReceipts(
  tracer: import("../src/application/service.ts").Tracer,
  definition: ExampleDefinition,
  entity: (key: string) => Entity,
  configurations: Record<string, import("../src/core/configuration.ts").Configuration>,
  actor: import("../src/core/model.ts").Provenance,
) {
  const receipts = [];
  for (const record of definition.receipts) {
    const configuration = Object.entries(configurations).find(([key]) =>
      record.inputs.includes(key),
    )?.[1];
    const receipt = await tracer.evidence.recordReceipt(
      {
        outputId: entity(record.output).id,
        expectedOutputVersion: entity(record.output).version,
        outcome: record.outcome,
        ...(configuration ? { configurationId: configuration.id } : {}),
        inputs: record.inputs.map((key) => ({
          entityId: entity(key).id,
          ...(!configuration ? { expectedVersion: entity(key).version } : {}),
        })),
      },
      actor,
    );
    receipts.push({ output: record.output, id: receipt.id });
  }

  return receipts;
}

async function captureFollowUp(
  tracer: import("../src/application/service.ts").Tracer,
  definition: ExampleDefinition,
  entity: (key: string) => Entity,
  actor: import("../src/core/model.ts").Provenance,
) {
  const proposal = definition.followUpConfiguration;
  if (!proposal) return undefined;
  const subject = entity(proposal.subject);
  return tracer.configurations.capture(
    {
      name: proposal.name,
      subjectId: subject.id,
      expectedSubjectVersion: subject.version,
      members: proposal.members.map((key) => ({
        entityId: entity(key).id,
        version: entity(key).version,
      })),
    },
    { ...actor, reason: proposal.reason },
  );
}
