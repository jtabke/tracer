import type { Graph } from "../../../src/application/views.ts";

const statusText = {
  changed: "Inputs changed",
  unknown: "Unknown input",
  current: "Inputs current",
  connected: "Connected",
};

function inputState(states: string[]): keyof typeof statusText {
  if (states.includes("unknown")) return "unknown";
  if (states.includes("changed")) return "changed";
  return states.length ? "current" : "connected";
}

export function nodeStatus(graph: Graph, id: string) {
  if (graph.temporal) {
    const state = graph.differences?.nodes.find((value) => value.id === id)?.state ?? "snapshot";
    return {
      state,
      text: state === "snapshot" ? "Native snapshot" : state[0].toUpperCase() + state.slice(1),
    };
  }
  const active = graph.evaluations.filter((value) => !value.comparison.supersededBy.length);
  const outputs = active.filter((value) => value.receipt.output.id === id);
  const states = [
    ...outputs.map((value) => value.comparison.state),
    ...active.flatMap((value) =>
      value.comparison.inputs.filter((input) => input.entityId === id).map((input) => input.state),
    ),
  ];
  if (
    graph.external.some(
      (value) => value.identity.id === id && value.observation?.availability !== "available",
    )
  )
    states.push("unknown");
  const state = inputState(states);
  const accepted =
    outputs.length > 0 && outputs.every((value) => value.comparison.review.state === "accepted");
  return {
    state,
    text: state === "changed" && accepted ? "Input drift · accepted" : statusText[state],
  };
}
