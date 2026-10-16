import type { ViewSave } from "../application/saved-views.ts";
import { arity, requiredInput, type CliCommand } from "./cli-input.ts";

export const savedViewCommands: Record<string, CliCommand> = {
  "saved-view list": ({ tracer, args }) => {
    arity(args, 0);
    return tracer.savedViews.list();
  },
  "saved-view save": ({ tracer, args }) => tracer.savedViews.save(requiredInput<ViewSave>(args)),
  "saved-view remove": async ({ tracer, args }) => {
    arity(args, 2);
    await tracer.savedViews.remove(args[0], Number(args[1]));
    return { removed: true };
  },
};
