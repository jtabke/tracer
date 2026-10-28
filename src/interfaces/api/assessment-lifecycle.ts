import type { ChangeAssessments } from "../../application/change-assessments.ts";
import type {
  AssessmentAnalysis,
  AssessmentSelection,
  DispositionView,
} from "../../core/change-assessment.ts";
import { changeAssessmentLimits } from "../../core/change-assessment.ts";
import {
  parseActions,
  parseSupport,
  parseCandidate,
  parseDispositionView,
} from "../../core/assessment-disposition.ts";
import { canonical } from "../../core/evidence.ts";
import {
  array,
  boolean,
  fields,
  integer,
  literal,
  nullable,
  number,
  object,
  text,
} from "../decode.ts";
import { read, write } from "./definition.ts";
import * as q from "./query.ts";
import { evaluation } from "./evaluations.ts";
import { assessmentViewResponse } from "./assessment-reads.ts";

const decision = literal("no_action", "revise", "reverify", "investigate", "acknowledge_unknown");
const result = object({
  obligations: array(
    object({
      subject: parseCandidate,
      currentDigest: text,
      hasUnknown: boolean,
      disposition: nullable(
        object({
          id: text,
          version: integer(1),
          membershipId: text,
          decision,
          rationalePreview: text,
        }),
      ),
      state: literal("undisposed", "open_actions", "stale_basis", "unknown", "accounted"),
      openActions: integer(),
      waivedActions: integer(),
    }),
  ),
  discovery: literal("current", "changed", "unknown"),
  discoveryReason: nullable(text),
  completion: object({
    state: literal("open", "completed", "needs_reassessment"),
    receiptId: nullable(text),
  }),
});
function analysis(value: unknown, input: AssessmentSelection): AssessmentAnalysis {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > changeAssessmentLimits.viewBytes)
    throw Error("Assessment analysis exceeds 256 KiB");
  const parsed = result(value),
    view = assessmentViewResponse((value as { view: unknown }).view, input);
  const keys = new Set(parsed.obligations.map((item) => item.subject.kind + ":" + item.subject.id));
  if (
    keys.size !== view.scope.candidates.length ||
    parsed.obligations.length !== keys.size ||
    !view.scope.candidates.every((item) => keys.has(item.kind + ":" + item.id))
  )
    throw Error("Analysis does not cover the declared population");
  for (const item of parsed.obligations)
    if (
      !/^sha256:[a-f0-9]{64}$/.test(item.currentDigest) ||
      item.openActions + item.waivedActions > 5 ||
      (item.state === "undisposed") !== (item.disposition === null) ||
      (item.state === "accounted" && item.openActions !== 0) ||
      (item.disposition && item.disposition.rationalePreview.length > 200)
    )
      throw Error("Invalid obligation summary");
  const closed = view.assessment.state === view.model.definition.states.closed;
  if (
    (parsed.completion.state === "open") === closed ||
    parsed.completion.receiptId !== (closed ? view.control.receiptId : null) ||
    (parsed.completion.state === "completed" &&
      (parsed.discovery !== "current" ||
        parsed.obligations.some((item) => item.state !== "accounted")))
  )
    throw Error("Completion does not match controlled application state");
  return { ...parsed, view };
}
const command = {
  commandId: text,
  assessmentId: text,
  openingCommandId: text,
  expectedSchemaVersion: number,
  expectedProjectRevision: number,
  expectedEvidenceRevision: number,
  expectedAssessmentVersion: number,
};
function applied(
  value: unknown,
  input?: {
    commandId: string;
    assessmentId: string;
    expectedAssessmentVersion: number;
    expectedProjectRevision: number;
  },
) {
  const decoded = evaluation(value, input),
    native = decoded.native?.results.find(
      (result) =>
        result.id === decoded.receipt.output.id && "fields" in result && !("source" in result),
    );
  if (
    !decoded.native ||
    !native ||
    canonical(native) !== canonical(decoded.receipt.output) ||
    (input &&
      (decoded.receipt.output.id !== input.assessmentId ||
        decoded.receipt.output.version !== input.expectedAssessmentVersion + 1 ||
        decoded.native.changeset.projectRevision !== input.expectedProjectRevision + 1))
  )
    throw Error("Application result does not match its exact command");
  return decoded;
}
const features = ["change-assessment-dispositions", "change-assessment-closure"];
export const assessmentLifecycleReads = {
  "/api/assessment-analysis": read({
    features,
    query: q.query({ assessmentId: q.textParam, openingCommandId: q.textParam }),
    response: analysis,
    handle: ({ tracer }, input) => {
      const assessments: ChangeAssessments = tracer.changeAssessments;
      return assessments.analyze(input);
    },
  }),
  "/api/assessment-disposition": read({
    features: ["change-assessment-dispositions"],
    query: q.query({
      assessmentId: q.textParam,
      openingCommandId: q.textParam,
      kind: q.choice("entity", "relationship", "receipt"),
      id: q.textParam,
    }),
    response: (value: unknown, input): DispositionView | null => {
      if (value === null) return null;
      const parsed = parseDispositionView(value);
      if (
        parsed.data.subject.id !== input.id ||
        parsed.data.subject.kind !== input.kind ||
        parsed.assessment.assessmentId !== input.assessmentId ||
        parsed.assessment.openingCommandId !== input.openingCommandId
      )
        throw Error("Disposition belongs to another candidate");
      return parsed;
    },
    handle: ({ tracer }, input) => {
      const assessments: ChangeAssessments = tracer.changeAssessments;
      return assessments.disposition(
        { assessmentId: input.assessmentId, openingCommandId: input.openingCommandId },
        { kind: input.kind, id: input.id },
      );
    },
  }),
};
export const assessmentLifecycleWrites = {
  "/api/change-assessments/disposition": write(
    {
      ...command,
      subject: parseCandidate,
      dispositionId: text,
      membershipId: text,
      expectedDispositionVersion: number,
      expectedBasisDigest: text,
      title: text,
      decision,
      rationale: text,
      actions: parseActions,
      support: parseSupport,
      additionalFields: fields,
    },
    applied,
    {
      features: [
        "change-assessment-dispositions",
        "atomic-evaluation-commands",
        "evidence-revision-guards",
      ],
    },
  )(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.setDisposition(input, provenance);
  }),
  "/api/change-assessments/close": write({ ...command, reason: text }, applied, {
    features: [
      "change-assessment-closure",
      "atomic-evaluation-commands",
      "evidence-revision-guards",
    ],
  })(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.close(input, provenance);
  }),
  "/api/change-assessments/reopen": write({ ...command, reason: text }, applied, {
    features: [
      "change-assessment-closure",
      "atomic-evaluation-commands",
      "evidence-revision-guards",
    ],
  })(({ tracer, provenance }, input) => {
    const assessments: ChangeAssessments = tracer.changeAssessments;
    return assessments.reopen(input, provenance);
  }),
};
