import { evaluationFixture, evaluationActor } from "./evaluation-fixture.ts";
import type { ChangeAssessmentModel, ApplicationModelPin } from "../src/core/application-model.ts";
import { changeAssessmentSchema } from "../src/core/application-model.ts";
import type { Schema } from "../src/core/model.ts";
type ModelVocabulary = Omit<ChangeAssessmentModel, "contract" | "version" | "policy"> & {
  field: string;
};
const vocabularies: Record<"engineering" | "research", ModelVocabulary> = {
  engineering: {
    field: "definition",
    assessment: {
      type: "change_assessment",
      fields: {
        title: "title",
        state: "state",
        model: "model",
        scope: "scope",
        closure: "closure",
      },
    },
    disposition: {
      type: "change_disposition",
      fields: {
        title: "title",
        candidate: "candidate",
        decision: "decision",
        rationale: "rationale",
        actions: "actions",
      },
    },
    relationships: {
      member: "has_disposition",
    },
    states: {
      open: "in_progress",
      closed: "assessed",
    },
    decisions: {
      no_action: "no_change",
      revise: "revise_design",
      reverify: "repeat_test",
      investigate: "investigate_impact",
      acknowledge_unknown: "record_exception",
    },
  },
  research: {
    field: "rules",
    assessment: {
      type: "investigation",
      fields: {
        title: "title",
        state: "progress",
        model: "method_model",
        scope: "population",
        closure: "conclusion",
      },
    },
    disposition: {
      type: "interpretation",
      fields: {
        title: "title",
        candidate: "subject",
        decision: "judgment",
        rationale: "explanation",
        actions: "followups",
      },
    },
    relationships: {
      member: "includes_interpretation",
    },
    states: {
      open: "exploring",
      closed: "accounted_for",
    },
    decisions: {
      no_action: "retain",
      revise: "revise_analysis",
      reverify: "repeat_analysis",
      investigate: "investigate_basis",
      acknowledge_unknown: "acknowledge_uncertainty",
    },
  },
};
export async function applicationModelFixture(domain: "engineering" | "research" = "engineering") {
  const f = await evaluationFixture(domain);
  try {
    const original = await f.tracer.getSchema();
    if (!original) throw Error("Fixture schema missing");
    const { field, ...bindings } = structuredClone(vocabularies[domain]);
    const definition: ChangeAssessmentModel = {
      contract: "change_assessment",
      version: 1,
      ...bindings,
      policy: { allowUnknown: false },
    };
    const fragment = changeAssessmentSchema(definition);
    const schema: Schema = {
      entityTypes: {
        ...original.entityTypes,
        project_method: {
          fields: {
            title: { type: "string", required: true },
            [field]: { type: "json", required: true },
          },
        },
        ...fragment.entityTypes,
      },
      relationshipTypes: { ...original.relationshipTypes, ...fragment.relationshipTypes },
      coverageExpectations: original.coverageExpectations,
    };
    await f.tracer.setSchema(schema, 1, evaluationActor);
    const profile = await f.tracer.createEntity(
      {
        type: "project_method",
        fields: { title: domain + " application model", [field]: definition },
      },
      2,
      evaluationActor,
    );
    const pin: ApplicationModelPin = { entityId: profile.id, version: 1, field };
    return {
      ...f,
      base: f,
      definition,
      profile,
      pin,
      schema,
      get tracer() {
        return f.tracer;
      },
      get repository() {
        return f.repository;
      },
    };
  } catch (error) {
    f.close();
    throw error;
  }
}
