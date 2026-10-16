import { TracerError, ensure, record } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type { Tracer } from "../application/service.ts";

type CliOptions = { db: string; origin: Provenance; schemaVersion?: number; tokens: string[] };
export type CliContext = CliOptions & { tracer: Tracer; args: string[] };
export type CliCommand = (context: CliContext) => unknown | Promise<unknown>;

export function cliOptions(input: string[]): CliOptions {
  const options: CliOptions = {
    db: "tracer.sqlite",
    origin: { actor: "local", reason: undefined },
    tokens: [...input],
  };
  const { tokens } = options;
  while (tokens[0]?.startsWith("--") && tokens[0] !== "--help") {
    const flag = tokens.shift(),
      value = tokens.shift();
    ensure(value, "usage", "Missing option value");
    applyOption(options, flag!, value);
  }
  return options;
}
const optionSetters: Record<string, (options: CliOptions, value: string) => void> = {
  "--db": (options, value) => {
    options.db = value;
  },
  "--actor": (options, value) => {
    options.origin.actor = value;
  },
  "--reason": (options, value) => {
    options.origin.reason = value;
  },
  "--schema-version": (options, value) => {
    options.schemaVersion = Number(value);
  },
};
function applyOption(options: CliOptions, flag: string, value: string) {
  if (!Object.hasOwn(optionSetters, flag))
    throw new TracerError("usage", "Unknown option: " + flag);
  optionSetters[flag](options, value);
}
export function arity(args: string[], min: number, max = min) {
  ensure(
    args.length >= min && args.length <= max,
    "usage",
    "Wrong number of arguments; use --help",
  );
}
export function jsonInput<T>(value: string | undefined): T {
  ensure(value, "usage", "Missing JSON input");
  let result: unknown;
  try {
    result = JSON.parse(value);
  } catch {
    throw new TracerError("usage", "Invalid JSON input");
  }
  ensure(record(result), "usage", "Input must be a JSON object");
  return result as T;
}
export function queryInput<T>(args: string[]): T {
  arity(args, 0, 1);
  return args[0] ? jsonInput<T>(args[0]) : ({} as T);
}
export function requiredInput<T>(args: string[]): T {
  arity(args, 1);
  return jsonInput<T>(args[0]);
}
export function expectedSchema(context: CliContext): number {
  const version = context.schemaVersion;
  ensure(
    Number.isSafeInteger(version) && version! > 0,
    "usage",
    "Data writes require --schema-version N",
  );
  return version!;
}
