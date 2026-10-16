import { inNewProject } from "./isolated-project.ts";
import { projectTemplates } from "../src/core/project-templates.ts";
import type { Entity, Relationship } from "../src/core/model.ts";

/** Illustrative native metadata only. Never imports code or claims actual test results. */
export async function seedWorkspace(
  destination: string,
  domain: "software" | "engineering" = "software",
) {
  return inNewProject(destination, async (tracer, { directory, database }) => {
    const actor = {
      actor: "workspace-example",
      reason: "Illustrative native project, not evidence of implementation or conformance",
    };
    await tracer.setSchema(projectTemplates[domain].schema, 0, actor);
    const create = async (type: string, key: string, title: string, statement = title) =>
      (await tracer.createEntity(
        {
          type,
          key,
          fields: {
            title,
            statement,
            notes: "Illustrative project-managed record; no external binding or result evidence.",
          },
        },
        1,
        actor,
      )) as Entity;
    const intents = [
      await create(
        "intent",
        "INT-01",
        domain === "software"
          ? "Find services without losing browsing context"
          : "Carry and position an instrument during a task",
      ),
      await create(
        "intent",
        "INT-02",
        domain === "software"
          ? "Recover a useful search after navigation"
          : "Inspect and maintain the carrying assembly",
      ),
    ];
    const statements =
      domain === "software"
        ? [
            "The user can browse services by category.",
            "Filtering results shall preserve the user's search text.",
            "Sparse results shall explain available next actions without claiming no services exist.",
            "Returning from service details shall retain the browsing position.",
            "Similar service names shall remain distinguishable by their category and description.",
            "A failed search shall retain the attempted search and offer retry.",
            "Keyboard navigation shall reach the category and result controls.",
            "Changing categories shall retain the search text until the user explicitly clears it.",
          ]
        : [
            "The carrying assembly shall support positioning the instrument for the described task.",
            "The attachment shall be inspectable before carrying; acceptance criteria remain to be specified.",
            "The handle shall permit the intended grip; fit and task limits remain to be evaluated.",
            "Maintenance shall permit inspection without implying successful qualification.",
          ];
    const requirements: Entity[] = [];
    for (const [index, statement] of statements.entries())
      requirements.push(
        await create(
          "requirement",
          `REQ-${String(index + 1).padStart(2, "0")}`,
          index === 4
            ? "Browse services — category context and description for similarly named results"
            : statement,
          statement,
        ),
      );
    const outputs = await createOutputs();
    async function createOutputs() {
      const outputs: Entity[] = [];
      const counts =
        domain === "software" ? { code: 5, design: 3, test: 4 } : { design: 3, test: 3 };
      for (const [type, count] of Object.entries(counts))
        for (let index = 0; index < count; index++)
          outputs.push(
            await create(
              type,
              `${type.toUpperCase()}-${index + 1}`,
              domain === "software" && type === "code"
                ? [
                    "discovery.ts",
                    "filters.ts",
                    "category-index.ts",
                    "discovery.ts",
                    "navigation.ts",
                  ][index]
                : `${type} record ${index + 1}`,
              type === "test"
                ? "Illustrative test definition only. No execution or passing result is recorded."
                : "Illustrative design/code description; extent is a human judgment, not inferred realization.",
            ),
          );
      return outputs;
    }
    const link = async (type: string, source: Entity, target: Entity, fields = {}) =>
      (await tracer.createRelationship(
        { type, source: source.id, target: target.id, fields },
        1,
        actor,
      )) as Relationship;
    for (const [index, requirement] of requirements.entries()) {
      await link(
        "contributes_to",
        requirement,
        intents[index < Math.ceil(requirements.length / 2) ? 0 : 1],
      );
      if (index === 1) await link("contributes_to", requirement, intents[1]); // Shared identity, not copied prose.
    }
    const mapping = await link("mapped_to", requirements[0], outputs[0], {
      scope: "Partial — browsing/positioning only; remaining scope unresolved",
      source_version: 1,
      review: "unreviewed",
    });
    await link("mapped_to", requirements[1], outputs[0], {
      scope: "Shared contribution; extent unreviewed",
      source_version: 1,
      review: "unreviewed",
    });
    await link("mapped_to", requirements[2], outputs.at(-1)!, {
      scope: "Test definition mapped; execution/results unknown",
      source_version: 1,
      review: "unreviewed",
    });
    await link("tested_by", outputs[0], outputs.at(-1)!);
    requirements[0] = (await tracer.updateEntity(
      requirements[0].id,
      1,
      {
        fields: {
          ...requirements[0].fields,
          statement: `${statements[0]} Preserve the surrounding task context.`,
        },
      },
      1,
      actor,
    )) as Entity;
    return { directory, database, domain, intents, requirements, outputs, mapping };
  });
}
