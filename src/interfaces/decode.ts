import { json, record } from "../core/model.ts";
import type { Fields } from "../core/model.ts";

export type Decoder<T> = (value: unknown) => T;
function invalid(): never {
  throw new Error("Invalid API response");
}
export const text: Decoder<string> = (value) => (typeof value === "string" ? value : invalid());
export const number: Decoder<number> = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : invalid();
export const boolean: Decoder<boolean> = (value) =>
  typeof value === "boolean" ? value : invalid();
export function integer(minimum = 0): Decoder<number> {
  return (value) => {
    const result = number(value);
    return Number.isSafeInteger(result) && result >= minimum ? result : invalid();
  };
}
export const fields: Decoder<Fields> = (value) =>
  record(value) && json(value) ? (value as Fields) : invalid();
export function literal<const T extends string | number | boolean>(...choices: T[]): Decoder<T> {
  return (value) => (choices.some((choice) => choice === value) ? (value as T) : invalid());
}
export function optional<T>(decode: Decoder<T>): Decoder<T | undefined> {
  return (value) => (value === undefined ? undefined : decode(value));
}
export function nullable<T>(decode: Decoder<T>): Decoder<T | null> {
  return (value) => (value === null ? null : decode(value));
}
export function array<T>(decode: Decoder<T>): Decoder<T[]> {
  return (value) => (Array.isArray(value) ? value.map(decode) : invalid());
}
type Decoded<S> = { [K in keyof S]: S[K] extends Decoder<infer T> ? T : never };
export function object<S extends Record<string, Decoder<unknown>>>(shape: S): Decoder<Decoded<S>> {
  return (value) => {
    if (!record(value)) return invalid();
    for (const [key, decode] of Object.entries(shape))
      decode(Object.hasOwn(value, key) ? value[key] : undefined);
    // This assertion follows validation of every declared property; extras remain intact.
    return value as Decoded<S>;
  };
}
export function union<A, B>(first: Decoder<A>, second: Decoder<B>): Decoder<A | B> {
  return (value) => {
    try {
      return first(value);
    } catch {
      return second(value);
    }
  };
}
export function page<T>(decode: Decoder<T>) {
  return object({ items: array(decode), nextAfter: optional(text) });
}
