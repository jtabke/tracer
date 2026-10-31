import { createPortal } from "react-dom";
import "./page.css";
import type { VerificationReturnContext } from "./subject.ts";

export function VerificationPage({
  active,
  visited,
  target,
  origin,
  error,
  onClose,
  render,
  kind = "verification",
}: {
  kind?: "verification" | "assessments";
  active: boolean;
  visited: boolean;
  target: HTMLElement;
  origin?: VerificationReturnContext;
  error?: string;
  onClose(): void;
  render(): React.ReactNode;
}) {
  const page = (
    <section
      className={`native-task verification-page ${kind === "assessments" ? "assessment-page" : ""}`}
      hidden={!active}
      aria-label={
        kind === "assessments" ? "Change assessments workspace page" : "Verification workspace page"
      }
      tabIndex={-1}
    >
      <header className="verification-page-header">
        <button onClick={onClose}>← Back to investigation</button>
        <span className="verification-return-context">
          {origin
            ? `${origin.key || "Project"} · opened r${origin.revision} · ${origin.perspective}`
            : "Retained workspace"}
        </span>
      </header>
      {error && <p role="alert">{error}</p>}
      {visited && render()}
    </section>
  );
  return createPortal(page, target);
}
