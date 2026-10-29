import type * as Evidence from "../../core/evidence.ts";
import { comparison, evidence, external, observation, receipt, review } from "../api-models.ts";
import { literal, page, text } from "../decode.ts";
import { read, write } from "./definition.ts";
import { locator, receiptCommandInput } from "./input.ts";
import * as q from "./query.ts";
export const evidenceReads = {
  "/api/evidence": read({
    query: q.query({
      ...q.evidencePage,
      kind: q.choice("external", "observation", "receipt", "review"),
    }),
    response: (value, query) =>
      page<Evidence.Evidence>(
        evidence[literal("external", "observation", "receipt", "review")(query.kind)],
      )(value),
    handle: ({ tracer }, { kind, ...q }) => tracer.evidence.list(kind, q),
  }),
  "/api/receipt": read({
    query: q.query(
      { receiptId: q.textParam },
      { exact: { code: "usage", message: "Receipt requires receiptId" } },
    ),
    response: receipt,
    handle: ({ tracer }, q) => tracer.evidence.getReceipt(q.receiptId),
  }),
  "/api/comparison": read({
    query: q.query(
      { receiptId: q.textParam },
      { exact: { code: "usage", message: "Comparison requires receiptId" } },
    ),
    response: comparison,
    handle: ({ tracer }, q) => tracer.evidence.compareReceipt(q.receiptId),
  }),
};
export const evidenceWrites = {
  "/api/external": write(
    {
      entityId: text,
      system: literal("git", "file"),
      externalId: text,
      ownership: literal("external"),
    },
    external,
  )(({ tracer, provenance }, input) => tracer.evidence.bindExternal(input, provenance)),
  "/api/observations": write(
    { entityId: text, locator },
    observation,
  )(({ tracer, provenance }, input) => tracer.evidence.observe(input, provenance)),
  "/api/receipts": write(receiptCommandInput, receipt, {
    features: [
      "relationship-evaluation-inputs",
      "reference-evaluation-inputs",
      "historical-content-inputs",
    ],
  })(({ tracer, provenance }, input) => tracer.evidence.recordReceipt(input, provenance)),
  "/api/reviews": write(
    {
      receiptId: text,
      decision: literal("accepted", "acknowledged", "needs_reevaluation"),
      rationale: text,
      expectedComparison: text,
    },
    review,
  )(({ tracer, provenance }, input) => tracer.evidence.review(input, provenance)),
};
