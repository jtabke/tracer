import type { Schema } from "@tracer-local/core";

// Fictional tutorial model, shared by the runnable example and walkthrough checks.
export const productModel: Schema = {
  entityTypes: {
    product: { fields: { title: { type: "string", required: true } } },
    requirement: {
      fields: {
        title: { type: "string", required: true },
        statement: { type: "string", required: true },
      },
    },
    component: { fields: { title: { type: "string", required: true } } },
  },
  relationshipTypes: {
    has_requirement: {
      source: ["product"],
      target: ["requirement"],
      fields: {},
      workflow: [
        { source: "product", target: "requirement", direction: "forward", label: "Requirements" },
      ],
    },
    allocated_to: {
      source: ["requirement"],
      target: ["component"],
      fields: {},
      workflow: [
        { source: "requirement", target: "component", direction: "forward", label: "Allocation" },
      ],
    },
  },
};
