import type { ChainQuery } from "../../../src/application/views.ts";
import type { DemoGuide as Guide } from "../../../src/interfaces/demo-guide.ts";
import "./demo-guide.css";

/** Prepared multi-level traces complement the home workspaces; they do not repeat them. */
export function DemoGuide({
  guide,
  busy,
  onChain,
}: {
  guide?: Guide | null;
  busy: boolean;
  onChain(query: ChainQuery): void;
}) {
  if (!guide?.chains.length) return null;
  return (
    <div className="demo-guide home-traces">
      <div className="home-section-heading">
        <h2>Multi-level traces</h2>
      </div>
      {guide.chains.map((chain) => (
        <button key={chain.title} disabled={busy} onClick={() => onChain(chain.query)}>
          <span aria-hidden="true">▦</span>
          <div>
            <strong>{chain.title}</strong>
            <small>{chain.query.steps.length + 1} connected levels</small>
          </div>
          <span aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
}
