import { writeFileSync } from "node:fs";
import { renderApiReference } from "./api-reference.ts";

writeFileSync(
  new URL("../../docs/reference/api-reference.md", import.meta.url),
  renderApiReference(),
);
