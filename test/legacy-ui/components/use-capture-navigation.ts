import { useState } from "react";

type Capture = {
  receiptId: string;
  focusInputId?: string;
  subjectId?: string;
  origin: string;
  returnLabel: string;
};
type CaptureContext = { subjectId: string; returnLabel: string };

/** Presentation navigation retains one mounted review owner; changing receipt requires deliberate discard. */
export function useCaptureNavigation(
  tab: string,
  activate: (name: string) => void,
  findItems: () => void,
  labels: Record<string, string>,
) {
  const [capture, setCapture] = useState<Capture>();
  const [active, setActive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardRevision, setDiscardRevision] = useState(0);
  const confirmReplacement = (receiptId: string, question: string) => {
    if (capture?.receiptId !== receiptId && dirty) {
      if (!window.confirm(question)) return false;
      setDiscardRevision((value) => value + 1);
      setDirty(false);
    }
    return true;
  };
  const openReceipt = (receiptId: string, focusInputId?: string, context?: CaptureContext) => {
    if (
      !confirmReplacement(receiptId, "Discard the retained review draft to inspect another result?")
    )
      return false;
    setCapture((previous) =>
      captureIntent(previous, receiptId, focusInputId, context, tab, labels),
    );
    setActive(true);
    return true;
  };
  const navigate = (name: string) => {
    setActive(false);
    activate(name);
  };
  const find = () => {
    setActive(false);
    findItems();
  };
  const returnToOrigin = () => {
    setActive(false);
    if (capture) activate(capture.origin);
  };
  const receiptChangeBlocked = (receiptId: string) =>
    setCapture((value) => (value ? { ...value, receiptId } : value));
  const restoreCapture = (value: Capture) => {
    if (
      !confirmReplacement(
        value.receiptId,
        "Discard the retained review draft to return to this result?",
      )
    )
      return false;
    setCapture(value);
    setActive(true);
    return true;
  };
  return {
    capture,
    active,
    dirty,
    discardRevision,
    openReceipt,
    navigate,
    find,
    returnToOrigin,
    receiptChangeBlocked,
    restoreCapture,
    setDirty,
    resume: () => setActive(true),
    visibleTab: active ? "captured-result" : tab,
    title: active ? "Captured result" : labels[tab],
    resumeLabel: dirty ? "Return to review draft" : "Return to captured result",
  };
}
function captureIntent(
  previous: Capture | undefined,
  receiptId: string,
  focusInputId: string | undefined,
  context: CaptureContext | undefined,
  tab: string,
  labels: Record<string, string>,
): Capture {
  const retainedFocus = previous?.receiptId === receiptId ? previous.focusInputId : undefined;
  return {
    receiptId,
    focusInputId: focusInputId ?? (context ? undefined : retainedFocus),
    subjectId: context?.subjectId,
    origin: tab,
    returnLabel: context?.returnLabel ?? `Return to ${labels[tab]}`,
  };
}
