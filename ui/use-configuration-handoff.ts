import { useState } from "react";
import type { ConfigurationHandoff } from "./configuration-handoff.ts";

export function useConfigurationHandoff(
  navigate: ((task: "assessments" | "verification") => void) | undefined,
) {
  const [requests, setRequests] = useState<{
    sequence: number;
    assessment?: ConfigurationHandoff;
    verification?: ConfigurationHandoff;
  }>({ sequence: 0 });
  function send(
    kind: "assessment" | "verification",
    value: Omit<ConfigurationHandoff, "sequence">,
  ) {
    setRequests((previous) => ({
      ...previous,
      sequence: previous.sequence + 1,
      [kind]: { ...value, sequence: previous.sequence + 1 },
    }));
    navigate?.(kind === "assessment" ? "assessments" : "verification");
  }
  return {
    assessment: requests.assessment,
    verification: requests.verification,
    assess: (value: Omit<ConfigurationHandoff, "sequence">) => send("assessment", value),
    verify: (value: Omit<ConfigurationHandoff, "sequence">) => send("verification", value),
  };
}
