import type { ChangeImpactQuery } from "../core/impact.ts";
import { requiredInput, type CliCommand } from "./cli-input.ts";

export const impactCommands: Record<string, CliCommand> = {
  "impact get": ({ tracer, args }) =>
    tracer.getChangeImpact(requiredInput<ChangeImpactQuery>(args)),
};
