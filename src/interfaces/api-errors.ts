import { errorCodes } from "../core/model.ts";
import { literal, object, text, optional, array, union, number } from "./decode.ts";
export const errorResponse = object({
  error: literal(...errorCodes),
  message: text,
  details: optional(
    object({
      kind: optional(literal("schema", "entity", "relationship")),
      id: optional(text),
      expectedVersion: optional(number),
      actualVersion: optional(number),
      path: optional(array(union(text, number))),
    }),
  ),
});
