import type { ConfigurationPair } from "../src/core/configuration-comparison.ts";
/** An in-session navigation request. Services still validate the exact captured source. */
export type ConfigurationHandoff = { pair: ConfigurationPair; rootId: string; sequence: number };
