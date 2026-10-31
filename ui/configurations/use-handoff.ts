import { useState } from "react";
import type { ConfigurationHandoff } from "./handoff.ts";

export function useConfigurationHandoff(
  navigate: ((task: "assessments" | "verification" | "configurations") => void) | undefined,
) {
  const [requests, setRequests] = useState<{
    sequence: number;
    assessment?: ConfigurationHandoff;
    verification?: ConfigurationHandoff;
    configuration?: { id: string; sequence: number };
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
    configuration: requests.configuration,
    openConfiguration: (id: string) => {
      setRequests((previous) => ({
        ...previous,
        sequence: previous.sequence + 1,
        configuration: { id, sequence: previous.sequence + 1 },
      }));
      navigate?.("configurations");
    },
    assessment: requests.assessment,
    verification: requests.verification,
    assess: (value: Omit<ConfigurationHandoff, "sequence">) => send("assessment", value),
    verify: (value: Omit<ConfigurationHandoff, "sequence">) => send("verification", value),
  };
}
