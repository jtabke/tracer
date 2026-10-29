import type { ConfigurationInput, ExactConfigurationInput } from "../core/configuration.ts";
import type {
  EvidenceKind,
  EvidenceQuery,
  Locator,
  ReceiptInput,
  ReviewInput,
} from "../core/evidence.ts";
import { arity, jsonInput, queryInput, requiredInput, type CliCommand } from "./cli-input.ts";

type BindInput = {
  entityId: string;
  system: "git" | "file";
  externalId: string;
  ownership: "external";
};
export const evidenceCommands: Record<string, CliCommand> = {
  "configuration compare-receipt": ({ tracer, args }) => {
    arity(args, 2);
    return tracer.configurations.compareReceipt({ configurationId: args[0], receiptId: args[1] });
  },
  "configuration compare": ({ tracer, args }) => {
    arity(args, 2);
    return tracer.configurations.compare({ beforeId: args[0], afterId: args[1] });
  },
  "configuration context": ({ tracer, args }) => {
    arity(args, 0);
    return tracer.configurations.captureContext();
  },
  "external bind": ({ tracer, args, origin }) =>
    tracer.evidence.bindExternal(requiredInput<BindInput>(args), origin),
  "observation record": ({ tracer, args, origin }) =>
    tracer.evidence.observe(requiredInput<{ entityId: string; locator: Locator }>(args), origin),
  "receipt record": ({ tracer, args, origin }) =>
    tracer.evidence.recordReceipt(requiredInput<ReceiptInput>(args), origin),
  "receipt get": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.evidence.getReceipt(args[0]);
  },
  "receipt compare": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.evidence.compareReceipt(args[0]);
  },
  "review record": ({ tracer, args, origin }) =>
    tracer.evidence.review(requiredInput<ReviewInput>(args), origin),
  "evidence list": ({ tracer, args }) => {
    arity(args, 1, 2);
    return tracer.evidence.list(
      args[0] as EvidenceKind,
      args[1] ? jsonInput<EvidenceQuery>(args[1]) : {},
    );
  },
  "configuration capture-exact": ({ tracer, args, origin }) =>
    tracer.configurations.captureExact(requiredInput<ExactConfigurationInput>(args), origin),
  "configuration capture": ({ tracer, args, origin }) =>
    tracer.configurations.capture(requiredInput<ConfigurationInput>(args), origin),
  "configuration get": ({ tracer, args }) => {
    arity(args, 1);
    return tracer.configurations.get(args[0]);
  },
  "configuration list": ({ tracer, args }) =>
    tracer.configurations.list(queryInput<EvidenceQuery>(args)),
  "native-pin get": ({ tracer, args }) => {
    arity(args, 2);
    return tracer.getNativePin(args[0], Number(args[1]));
  },
};
