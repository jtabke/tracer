import { useRef, useState } from "react";
import type { useCaptureNavigation } from "./use-capture-navigation.ts";

type CaptureNavigation = ReturnType<typeof useCaptureNavigation>;
type Origin = NonNullable<CaptureNavigation["capture"]>;
type Intent = { id: string; sequence: number; origin?: Origin };

/** An exact capture read is presentation navigation; its review owner remains mounted. */
export function useConfigurationNavigation(capture: CaptureNavigation) {
  const [intent, setIntent] = useState<Intent>();
  const request = useRef(0);
  const open = (id: string) => {
    setIntent({
      id,
      sequence: ++request.current,
      origin: capture.capture,
    });
    capture.navigate("configurations");
  };
  const returnToResult = intent?.origin
    ? () => {
        if (capture.restoreCapture(intent.origin!)) setIntent(undefined);
      }
    : undefined;
  return { intent, open, returnToResult };
}
