import {
  baseline,
  comparedState,
  coverage,
  delta,
  entity,
  reachability,
  receipt,
  relationship,
  schema,
  workEvidence,
  workingComparison,
  workQueue,
  workRecord,
} from "../api-models.ts";
import {
  array,
  boolean,
  integer,
  literal,
  nullable,
  number,
  object,
  page,
  text,
} from "../decode.ts";
import { validateWorkingContextScope, workingContextDecoder } from "../working-context-decoders.ts";
import { read, write } from "./definition.ts";
import { expectations, workingContextInput } from "./input.ts";
import * as q from "./query.ts";
const workingContextResponse = workingContextDecoder(
  schema,
  entity,
  relationship,
  workingComparison,
);
export const analysisReads = {
  "/api/next-work": read({
    query: q.query({
      requirementType: q.optionalParam(q.textParam),
      statementField: q.optionalParam(q.textParam),
      allocationExpectationId: q.optionalParam(q.textParam),
      verificationExpectationId: q.optionalParam(q.textParam),
    }),
    response: object({
      schema: nullable(schema),
      projectRevision: integer(),
      evidenceRevision: integer(),
      schemaVersion: integer(),
      selection: object({
        requirementType: text,
        statementField: text,
        allocationExpectationId: text,
        verificationExpectationId: text,
      }),
      queues: object({
        statements: workQueue(workRecord),
        allocation: workQueue(workRecord),
        verification: workQueue(workRecord),
        changedEvidence: workQueue(workEvidence),
        reviews: workQueue(workEvidence),
      }),
    }),
    handle: ({ tracer }, q) => tracer.getNextWork(q),
  }),
  "/api/working-context": read({
    query: q.jsonQuery(workingContextInput, "Working context requires one query JSON"),
    response: (value, query) => {
      const result = workingContextResponse(value);
      validateWorkingContextScope(result, query);
      return result;
    },
    handle: ({ tracer }, q) => tracer.getWorkingContext(q),
  }),
  "/api/impact": read({
    query: q.query({
      ...q.pageParams,
      baselineId: q.textParam,
      rootId: q.textParam,
      direction: q.choice("incoming", "outgoing", "both"),
      relationshipTypes: q.jsonParam(
        array(text),
        "Invalid impact relationship types JSON",
        "Impact needs explicit relationship types as a JSON array",
      ),
      depth: q.optionalParam(q.integerParam),
      expectedProjectRevision: q.optionalParam(q.integerParam),
    }),
    response: object({
      context: object({
        baseline,
        beforeSchema: schema,
        afterSchema: schema,
        projectRevision: integer(1),
        evidenceRevision: integer(),
      }),
      scope: object({
        rootId: text,
        direction: literal("incoming", "outgoing", "both"),
        relationshipTypes: array(text),
        depth: integer(1),
      }),
      native: object({
        entities: array(delta(entity)),
        relationships: array(delta(relationship)),
        before: reachability(),
        after: reachability(),
      }),
      evaluations: page(
        object({
          receipt,
          comparison: comparedState,
          scope: object({
            inputIds: array(text),
            relationshipIds: array(text),
            state: literal("current", "changed", "unknown"),
            hasChanged: boolean,
            hasUnknown: boolean,
          }),
          supersession: object({ count: integer(), ids: array(text) }),
        }),
      ),
      summary: object({
        scope: literal("page"),
        evaluated: integer(),
        current: integer(),
        changed: integer(),
        unknown: integer(),
      }),
    }),
    handle: ({ tracer }, q) => tracer.getChangeImpact(q),
  }),
  "/api/coverage-expectations": read({
    query: q.query({ baselineId: q.optionalParam(q.textParam) }),
    response: coverage.catalogue,
    handle: ({ tracer }, q) => tracer.coverage.list(q),
  }),
  "/api/coverage": read({
    query: q.query({
      ...q.pageParams,
      baselineId: q.optionalParam(q.textParam),
      expectationId: q.textParam,
      expectedProjectRevision: q.optionalParam(q.integerParam),
    }),
    response: coverage.evaluation,
    handle: ({ tracer }, q) => tracer.coverage.evaluate(q),
  }),
};
export const analysisWrites = {
  "/api/coverage-expectations": write(
    { expectations, expectedSchemaVersion: number },
    schema,
  )(({ tracer, provenance }, input) => tracer.coverage.set(input, provenance)),
};
