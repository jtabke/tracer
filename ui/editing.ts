import type { Operation } from "../src/application/commands.ts";
import type { Entity } from "../src/core/model.ts";
import type { MutationExecutor } from "./mutation-controller.ts";

export type Focus = Pick<Entity, "id" | "type">;
export type Editing = {
  busy: boolean;
  error?: string;
  epoch: number;
  mutate: MutationExecutor;
  commit(operations: Operation[], schemaVersion: number): Promise<boolean>;
  report(error: unknown, attempted?: unknown): void;
};

import type { WriteInput, WritePath } from "../src/interfaces/api-contract.ts";
export type Save = <K extends WritePath>(path: K, input: WriteInput<K>) => Promise<boolean>;
