// Only the shared mutation controller calls this adapter; editors retain its guards.
export { writeRequest as write } from "./http-transport.ts";
