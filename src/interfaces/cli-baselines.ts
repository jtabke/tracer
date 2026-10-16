import type { BaselineInput, BaselineQuery, BaselineContentsQuery } from "../core/baseline.ts";
import { arity, queryInput, requiredInput, type CliCommand } from "./cli-input.ts";

export const baselineCommands: Record<string, CliCommand> = {
  "baseline capture": ({ tracer, args, origin }) =>
    tracer.baselines.capture(requiredInput<BaselineInput>(args), origin),
  "baseline get": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.baselines.get(args[0]);
  },
  "baseline list": ({ tracer, args }) => tracer.baselines.list(queryInput<BaselineQuery>(args)),
  "baseline contents": ({ tracer, args }) =>
    tracer.baselines.contents(requiredInput<BaselineContentsQuery>(args)),
};
