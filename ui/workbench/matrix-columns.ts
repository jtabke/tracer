import type { Schema } from "../../src/core/model.ts";

type Step = { type: string; targetType: string };

/** Legal outgoing columns, in model declaration order. Any/None constraints stay distinct. */
export function matrixColumnChoices(schema: Schema, sourceType: string): Step[] {
  if (!Object.hasOwn(schema.entityTypes, sourceType)) return [];
  return Object.entries(schema.relationshipTypes).flatMap(([type, rule]) =>
    rule.source && !rule.source.includes(sourceType)
      ? []
      : Object.keys(schema.entityTypes)
          .filter((target) => !rule.target || rule.target.includes(target))
          .map((targetType) => ({ type, targetType })),
  );
}

/** Keep valid authored steps; fill new/invalid steps from the model, stopping at a dead end. */
export function matrixColumns(schema: Schema, rootType: string, steps: Step[], count: number) {
  const result: Step[] = [];
  let source = rootType;
  for (let index = 0; index < count; index++) {
    const choices = matrixColumnChoices(schema, source);
    const authored = steps[index];
    const step =
      choices.find(
        (choice) => choice.type === authored?.type && choice.targetType === authored?.targetType,
      ) ??
      choices.find((choice) =>
        schema.relationshipTypes[choice.type].workflow?.some(
          (route) =>
            route.source === source &&
            route.target === choice.targetType &&
            route.direction === "forward",
        ),
      ) ??
      choices[0];
    if (!step) break;
    result.push(step);
    source = step.targetType;
  }
  return result;
}
