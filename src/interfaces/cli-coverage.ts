import type { CoverageSet, CoverageListQuery, CoverageEvaluationQuery } from "../core/coverage.ts";
import { queryInput, requiredInput, type CliCommand } from "./cli-input.ts";

export const coverageCommands: Record<string, CliCommand> = {
  "coverage set": ({ tracer, args, origin }) =>
    tracer.coverage.set(requiredInput<CoverageSet>(args), origin),
  "coverage list": ({ tracer, args }) => tracer.coverage.list(queryInput<CoverageListQuery>(args)),
  "coverage evaluate": ({ tracer, args }) =>
    tracer.coverage.evaluate(requiredInput<CoverageEvaluationQuery>(args)),
};
