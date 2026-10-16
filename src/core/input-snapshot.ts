import { ensure, json } from "./model.ts";

const message = "Inputs must be ordinary data without accessors, cycles or unsupported values";
function properties(value: object) {
  ensure(Object.getOwnPropertySymbols(value).length === 0, "validation", message);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const array = Array.isArray(value);
  for (const [key, property] of Object.entries(descriptors)) {
    ensure(json(key) && Object.hasOwn(property, "value"), "validation", message);
    ensure(property.enumerable || (array && key === "length"), "validation", message);
  }
  const keys = Object.keys(value);
  if (array)
    ensure(
      keys.length === value.length && keys.every((key, index) => key === String(index)),
      "validation",
      "Input arrays must be dense and contain only indexed elements",
    );
  return keys.map((key) => [key, descriptors[key].value] as const);
}
function container(value: object): object {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    ensure(prototype === Array.prototype, "validation", message);
    return [];
  }
  ensure(prototype === Object.prototype || prototype === null, "validation", message);
  return Object.create(prototype);
}
function primitive(value: unknown) {
  ensure(
    value === undefined || (typeof value !== "object" && json(value)) || value === null,
    "validation",
    message,
  );
  return value;
}
/** Own the request data before validation/enqueue. Optional undefined properties remain intact. */
export function snapshotInput<T>(input: T): T {
  const copies = new WeakMap<object, object>(),
    active = new WeakSet<object>();
  const copy = (value: unknown, depth: number): unknown => {
    ensure(depth <= 256, "validation", "Input nesting must not exceed 256 levels");
    if (value === null || typeof value !== "object") return primitive(value);
    ensure(!active.has(value), "validation", message);
    const existing = copies.get(value);
    if (existing) return existing;
    const result = container(value),
      entries = properties(value);
    copies.set(value, result);
    active.add(value);
    for (const [key, child] of entries)
      Object.defineProperty(result, key, {
        value: copy(child, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    active.delete(value);
    return result;
  };
  return copy(input, 0) as T;
}
