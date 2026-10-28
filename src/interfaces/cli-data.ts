import { ensure } from "../core/model.ts";
import type { Schema, EntityQuery, RelationshipQuery } from "../core/model.ts";
import type { Verification } from "../application/verification.ts";
import type {
  ChangesetInput,
  EntityInput,
  EntityEdit,
  RelationshipInput,
} from "../application/commands.ts";
import {
  arity,
  expectedSchema,
  jsonInput,
  queryInput,
  requiredInput,
  type CliCommand,
} from "./cli-input.ts";

export const dataCommands: Record<string, CliCommand> = {
  "verification open": ({ tracer, args, origin }) => {
    const verification: Verification = tracer.verification;
    return verification.open(
      requiredInput<import("../core/verification-case.ts").OpenVerificationCase>(args),
      origin,
    );
  },
  "verification get": ({ tracer, args }) => {
    const verification: Verification = tracer.verification;
    return verification.get(
      requiredInput<import("../core/verification-case.ts").VerificationSelection>(args),
    );
  },
  "verification locate": ({ tracer, args }) => {
    arity(args, 1);
    const verification: Verification = tracer.verification;
    return verification.locate(args[0]);
  },
  "verification execution": ({ tracer, args }) => {
    const { executionId, ...selection } = requiredInput<
      import("../core/verification-case.ts").VerificationSelection & { executionId: string }
    >(args);
    const verification: Verification = tracer.verification;
    return verification.execution(selection, executionId);
  },
  "verification record-execution": ({ tracer, args, origin }) => {
    const verification: Verification = tracer.verification;
    return verification.recordExecution(
      requiredInput<import("../core/verification-case.ts").RecordVerificationExecution>(args),
      origin,
    );
  },
  "verification resolve-model": ({ tracer, args }) => {
    const verification: Verification = tracer.verification;
    return verification.resolveModel(
      requiredInput<import("../core/application-model.ts").ApplicationModelPin>(args),
    );
  },
  "verification prepare-basis": ({ tracer, args }) => {
    const verification: Verification = tracer.verification;
    return verification.prepareBasis(
      requiredInput<import("../core/verification-basis.ts").PrepareVerificationBasis>(args),
    );
  },
  "assessment locate": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.changeAssessments.locate(args[0]!);
  },
  "assessment analyze": ({ tracer, args }) =>
    tracer.changeAssessments.analyze(
      requiredInput<import("../core/change-assessment.ts").AssessmentSelection>(args),
    ),
  "assessment disposition": ({ tracer, args }) => {
    const { subject, ...selection } = requiredInput<
      import("../core/change-assessment.ts").AssessmentSelection & {
        subject: import("../core/change-assessment.ts").CandidateKey;
      }
    >(args);
    return tracer.changeAssessments.disposition(selection, subject);
  },
  "assessment set-disposition": ({ tracer, args, origin }) =>
    tracer.changeAssessments.setDisposition(
      requiredInput<import("../core/change-assessment.ts").SetAssessmentDisposition>(args),
      origin,
    ),
  "assessment close": ({ tracer, args, origin }) =>
    tracer.changeAssessments.close(
      requiredInput<import("../core/change-assessment.ts").RefreshChangeAssessment>(args),
      origin,
    ),
  "assessment reopen": ({ tracer, args, origin }) =>
    tracer.changeAssessments.reopen(
      requiredInput<import("../core/change-assessment.ts").RefreshChangeAssessment>(args),
      origin,
    ),
  "assessment get": ({ tracer, args }) =>
    tracer.changeAssessments.get(
      requiredInput<import("../core/change-assessment.ts").AssessmentSelection>(args),
    ),
  "assessment refresh": ({ tracer, args, origin }) =>
    tracer.changeAssessments.refresh(
      requiredInput<import("../core/change-assessment.ts").RefreshChangeAssessment>(args),
      origin,
    ),
  "assessment open": ({ tracer, args, origin }) =>
    tracer.changeAssessments.open(
      requiredInput<import("../core/change-assessment.ts").OpenChangeAssessment>(args),
      origin,
    ),
  "application-model resolve": ({ tracer, args }) =>
    tracer.applicationModels.resolve(
      requiredInput<import("../core/application-model.ts").ApplicationModelPin>(args),
    ),
  "evaluation commit": ({ tracer, args, origin }) =>
    tracer.evaluations.commit(
      requiredInput<import("../application/evaluations.ts").EvaluationCommand>(args),
      origin,
    ),
  "evaluation outcome": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.evaluations.getOutcome(args[0]);
  },
  "schema get": async ({ tracer, args }) => {
    arity(args, 0);
    return (await tracer.getSchema()) ?? null;
  },
  "schema preview": ({ tracer, args }) =>
    tracer.previewSchema(
      requiredInput<import("../core/schema-preview.ts").SchemaPreviewInput>(args),
    ),
  "entity get": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.getEntity(args[0]);
  },
  "relationship get": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.getRelationship(args[0]);
  },
  "schema set": ({ tracer, args, origin }) => {
    arity(args, 2);
    return tracer.setSchema(jsonInput<Schema>(args[0]), Number(args[1]), origin);
  },
  "entity list": ({ tracer, args }) => tracer.queryEntities(queryInput<EntityQuery>(args)),
  "relationship list": ({ tracer, args }) =>
    tracer.queryRelationships(queryInput<RelationshipQuery>(args)),
  "entity create": (context) =>
    context.tracer.createEntity(
      requiredInput<EntityInput>(context.args, ["type", "key", "fields"]),
      expectedSchema(context),
      context.origin,
    ),
  "entity update": (context) => {
    arity(context.args, 3);
    return context.tracer.updateEntity(
      context.args[0],
      Number(context.args[1]),
      jsonInput<EntityEdit>(context.args[2], ["key", "fields"]),
      expectedSchema(context),
      context.origin,
    );
  },
  "entity remove": (context) => {
    arity(context.args, 2, 3);
    ensure(
      context.args[2] === undefined || context.args[2] === "cascade",
      "usage",
      "Use cascade explicitly to delete connected links",
    );
    return context.tracer.removeEntity(
      context.args[0],
      Number(context.args[1]),
      expectedSchema(context),
      context.origin,
      context.args[2] === "cascade",
    );
  },
  "relationship create": (context) =>
    context.tracer.createRelationship(
      requiredInput<RelationshipInput>(context.args, ["type", "source", "target", "fields"]),
      expectedSchema(context),
      context.origin,
    ),
  "relationship update": (context) => {
    arity(context.args, 3);
    return context.tracer.updateRelationship(
      context.args[0],
      Number(context.args[1]),
      jsonInput<RelationshipInput>(context.args[2], ["type", "source", "target", "fields"]),
      expectedSchema(context),
      context.origin,
    );
  },
  "relationship remove": (context) => {
    arity(context.args, 2);
    return context.tracer.removeRelationship(
      context.args[0],
      Number(context.args[1]),
      expectedSchema(context),
      context.origin,
    );
  },
  "changeset apply": ({ tracer, args, origin }) =>
    tracer.applyChangeset(requiredInput<ChangesetInput>(args), origin),
  "changeset outcome": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.getChangesetOutcome(args[0]);
  },
  "changeset list": ({ tracer, args }) => {
    arity(args, 0, 2);
    return tracer.changesets(
      args[0] === undefined ? 0 : Number(args[0]),
      args[1] === undefined ? 100 : Number(args[1]),
    );
  },
};
