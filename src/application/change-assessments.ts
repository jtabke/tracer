import { assessmentText, parseCandidate } from "../core/assessment-disposition.ts";
import { ensure, json, knownProperties, record } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type {
  AssessmentSelection,
  RefreshChangeAssessment,
  OpenChangeAssessment,
  SetAssessmentDisposition,
  CandidateKey,
} from "../core/change-assessment.ts";
import type { Repository } from "./ports/repository.ts";
import { prepareAssessmentSelection, assessmentContext } from "./assessment-context.ts";
import { refreshAssessment } from "./assessment-refresh.ts";
import { changeAssessmentLimits } from "../core/change-assessment.ts";
import { parseAssessmentScope } from "../core/assessment-scope-validation.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { EvaluationExecutor } from "./evaluation-executor.ts";
import { prepareModelPin, resolveApplicationModel } from "./application-models.ts";
import { prepareAssessmentQuery } from "./assessment-scope-query.ts";
import { discoverAssessmentScope } from "./assessment-scope.ts";
import { prepareDisposition, prepareAssessmentMutation } from "./assessment-disposition-input.ts";
import { setAssessmentDisposition, assessmentDispositions } from "./assessment-dispositions.ts";
import { analyzeAssessment } from "./assessment-analysis.ts";
import { concludeAssessment } from "./assessment-closure.ts";
import { candidateKey } from "./assessment-facts.ts";

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
  prepareAssessmentQuery(input.query);
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
  private repository: Repository;
  constructor(repository: Repository, executor: EvaluationExecutor) {
    this.repository = repository;
    this.executor = executor;
  }
  async locate(assessmentId: string) {
    assessmentText(assessmentId, 200);
    return this.repository.transaction(async (tx) => {
      const first = await tx.evidence("receipt", { subject: assessmentId, limit: 1 });
      const receipt = first.items[0];
      ensure(receipt, "not_found", "No recorded assessment opening was found");
      const openingCommandId = await tx.evaluationCommandForReceipt(receipt.id);
      ensure(openingCommandId, "conflict", "This record has no controlled assessment opening");
      const { view } = await assessmentContext(tx, { assessmentId, openingCommandId });
      ensure(
        new TextEncoder().encode(JSON.stringify(view)).byteLength <=
          changeAssessmentLimits.viewBytes,
        "validation",
        "Assessment view exceeds 256 KiB",
      );
      return view;
    });
  }
  async analyze(input: AssessmentSelection) {
    input = prepareAssessmentSelection(input);
    return this.repository.transaction(async (tx) => {
      const result = (await analyzeAssessment(tx, input)).analysis;
      ensure(
        new TextEncoder().encode(JSON.stringify(result)).byteLength <=
          changeAssessmentLimits.viewBytes,
        "validation",
        "Assessment analysis exceeds 256 KiB",
      );
      return result;
    });
  }
  async disposition(input: AssessmentSelection, subject: CandidateKey) {
    input = prepareAssessmentSelection(input);
    subject = parseCandidate(snapshotInput(subject));
    return this.repository.transaction(async (tx) => {
      const { view } = await assessmentContext(tx, input);
      ensure(
        view.scope.candidates.some(
          (candidate) => candidateKey(candidate) === candidateKey(subject),
        ),
        "validation",
        "Candidate is outside the declared assessment population",
      );
      return (
        (await assessmentDispositions(tx, view)).find(
          (item) => candidateKey(item.disposition.data.subject) === candidateKey(subject),
        )?.disposition ?? null
      );
    });
  }
  async setDisposition(input: SetAssessmentDisposition, actor: Provenance) {
    input = prepareDisposition(input);
    return this.executor.execute(
      input,
      actor,
      setAssessmentDisposition,
      "change-assessment.disposition",
    );
  }
  async close(input: RefreshChangeAssessment, actor: Provenance) {
    return this.conclude(input, actor, false);
  }
  async reopen(input: RefreshChangeAssessment, actor: Provenance) {
    return this.conclude(input, actor, true);
  }
  private conclude(input: RefreshChangeAssessment, actor: Provenance, reopen: boolean) {
    input = prepareAssessmentMutation(input, ["reason"]);
    assessmentText(input.reason);
    return this.executor.execute(
      input,
      actor,
      (tx, request) => concludeAssessment(tx, request, reopen),
      reopen ? "change-assessment.reopen" : "change-assessment.close",
    );
  }
  async get(input: AssessmentSelection) {
    input = prepareAssessmentSelection(input);
    return this.repository.transaction(async (tx) => {
      const view = (await assessmentContext(tx, input)).view;
      ensure(
        new TextEncoder().encode(JSON.stringify(view)).byteLength <=
          changeAssessmentLimits.viewBytes,
        "validation",
        "Assessment view exceeds 256 KiB",
      );
      return view;
    });
  }
  async refresh(input: RefreshChangeAssessment, actor: Provenance) {
    input = prepareAssessmentMutation(input, ["reason"]);
    assessmentText(input.reason);
    return this.executor.execute(input, actor, refreshAssessment, "change-assessment.refresh");
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
        scope.control = { commandId: request.commandId, openingCommandId: request.commandId };
        parseAssessmentScope(scope);
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
