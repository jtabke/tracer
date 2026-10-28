import { ensure, json, knownProperties, record } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { OpenChangeAssessment } from "../core/change-assessment.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { EvaluationExecutor } from "./evaluation-executor.ts";
import { prepareModelPin, resolveApplicationModel } from "./application-models.ts";
import { impactQuery } from "./impact-context.ts";
import { discoverAssessmentScope } from "./assessment-scope.ts";

function prepareOpen(input: OpenChangeAssessment) {
  input = snapshotInput(input);
  ensure(record(input) && json(input), "validation", "Invalid assessment command");
  knownProperties(input, [
    "commandId",
    "assessmentId",
    "title",
    "purpose",
    "model",
    "query",
    "additionalFields",
    "expectedSchemaVersion",
    "expectedProjectRevision",
    "expectedEvidenceRevision",
  ]);
  for (const key of ["assessmentId", "title", "purpose"] as const)
    ensure(
      typeof input[key] === "string" &&
        input[key].trim().length > 0 &&
        input[key].length <= (key === "purpose" ? 4000 : 200),
      "validation",
      "Assessment needs bounded identity, title and purpose",
      { path: [key] },
    );
  for (const key of ["expectedProjectRevision", "expectedEvidenceRevision"] as const)
    ensure(
      Number.isSafeInteger(input[key]) && input[key] >= 0,
      "validation",
      "Assessment needs exact native and evidence guards",
      { path: [key] },
    );
  input.model = prepareModelPin(input.model);
  ensure(record(input.query), "validation", "Select an assessment discovery scope");
  knownProperties(input.query, ["baselineId", "rootId", "direction", "relationshipTypes", "depth"]);
  impactQuery(input.query);
  ensure(
    record(input.additionalFields),
    "validation",
    "Provide additional assessment fields explicitly",
  );
  return input;
}

/** Engineering lifecycle rules belong here; native schema and capture protocols remain shared. */
export class ChangeAssessments {
  private executor: EvaluationExecutor;
  constructor(executor: EvaluationExecutor) {
    this.executor = executor;
  }
  async open(input: OpenChangeAssessment, actor: Provenance) {
    input = prepareOpen(input);
    return this.executor.execute(
      input,
      actor,
      async (tx, request) => {
        const model = await resolveApplicationModel(tx, request.model);
        ensure(
          model.compatibility.writable,
          "validation",
          "Application model is incompatible with the current schema",
        );
        ensure(
          !(await tx.getRevision("entity", request.assessmentId, 1)),
          "conflict",
          "Assessment identity has already been used",
        );
        const binding = model.definition.assessment;
        const controlled = new Set(Object.values(binding.fields));
        ensure(
          Object.keys(request.additionalFields).every((name) => !controlled.has(name)),
          "validation",
          "Additional fields cannot replace application-controlled fields",
        );
        const scope = await discoverAssessmentScope(tx, request);
        return {
          operations: [
            {
              op: "entity.create",
              id: request.assessmentId,
              input: {
                type: binding.type,
                fields: {
                  ...request.additionalFields,
                  [binding.fields.title]: request.title,
                  [binding.fields.state]: model.definition.states.open,
                  [binding.fields.model]: request.model,
                  [binding.fields.scope]: scope,
                  [binding.fields.closure]: null,
                },
              },
            },
          ],
          receipt: {
            outputId: request.assessmentId,
            expectedOutputVersion: 1,
            outcome:
              "Assessment opened with recorded selected scope; no dispositions or completion judgment established",
            inputs: [
              {
                entityId: request.model.entityId,
                revision: request.model.version,
                facet: "native",
                fields: [request.model.field],
                role: "governing application model",
              },
            ],
          },
        };
      },
      "change-assessment.open",
    );
  }
}
