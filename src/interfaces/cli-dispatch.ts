import { ensure } from "../core/model.ts";
import { dataCommands } from "./cli-data.ts";
import { evidenceCommands } from "./cli-evidence.ts";
import { projectionCommands, legacyProjectionCommands } from "./cli-projections.ts";
import { savedViewCommands } from "./cli-saved-views.ts";
import type { CliContext } from "./cli-input.ts";
import { baselineCommands } from "./cli-baselines.ts";
import { coverageCommands } from "./cli-coverage.ts";
import { impactCommands } from "./cli-impact.ts";

const commands = {
  ...dataCommands,
  ...evidenceCommands,
  ...projectionCommands,
  ...savedViewCommands,
  ...baselineCommands,
  ...coverageCommands,
  ...impactCommands,
};
export function dispatchCli(context: Omit<CliContext, "args">) {
  const [command, action, ...rest] = context.tokens;
  if (Object.hasOwn(legacyProjectionCommands, command))
    return legacyProjectionCommands[command]({ ...context, args: context.tokens.slice(1) });
  const key = `${command} ${action}`;
  ensure(Object.hasOwn(commands, key), "usage", "Unknown command; use --help");
  return commands[key]({ ...context, args: rest });
}
