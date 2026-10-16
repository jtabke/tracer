import type { MermaidConfig } from "mermaid";
import { useEffect, useRef, useState } from "react";
import type { Jsonify } from "type-fest";

/** Static JSON configuration also satisfies Mermaid's published JSON configuration types. */
const documentationDiagramConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: "system-ui, sans-serif",
  themeVariables: {
    primaryColor: "#202e27",
    primaryTextColor: "#e3eee8",
    primaryBorderColor: "#6a9d7e",
    lineColor: "#9bc7ad",
    secondaryColor: "#17251d",
    tertiaryColor: "#17251d",
    background: "#111914",
    fontFamily: "system-ui, sans-serif",
  },
} satisfies Jsonify<
  Pick<MermaidConfig, "startOnLoad" | "securityLevel" | "theme" | "fontFamily" | "themeVariables">
>;

let renderer: Promise<(typeof import("mermaid"))["default"]> | undefined;
function diagramRenderer() {
  renderer ??= import("mermaid").then((module) => {
    module.default.initialize(documentationDiagramConfig);
    return module.default;
  });
  return renderer;
}
type Diagram = { svg: string; width: number; height: number };
export function DocumentationDiagram({ source, active }: { source: string; active: boolean }) {
  const [diagram, setDiagram] = useState<Diagram>();
  const [failure, setFailure] = useState("");
  const [scale, setScale] = useState(1);
  const [sourceVisible, setSourceVisible] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || diagram) return;
    let mounted = true;
    void diagramRenderer()
      .then(async (mermaid) => {
        const result = await mermaid.render(`docs-diagram-${crypto.randomUUID()}`, source);
        const element = new DOMParser().parseFromString(
          result.svg,
          "image/svg+xml",
        ).documentElement;
        const box = element.getAttribute("viewBox")!.split(/\s+/).map(Number);
        if (mounted) setDiagram({ svg: result.svg, width: box[2], height: box[3] });
      })
      .catch((error) => {
        if (mounted) setFailure(String(error));
      });
    return () => {
      mounted = false;
    };
  }, [active, source, diagram]);
  return (
    <figure className="documentation-diagram" aria-label="Illustrative development workflow">
      <div className="documentation-diagram-controls">
        <strong>Development workflow</strong>
        {diagram && (
          <>
            <button aria-pressed={scale === 1} onClick={() => setScale(1)}>
              100%
            </button>
            <button
              onClick={() =>
                setScale(
                  Math.min(1, (viewport.current?.clientWidth ?? diagram.width) / diagram.width),
                )
              }
            >
              Fit diagram
            </button>
            {scale !== 1 && <span>{Math.round(scale * 100)}%</span>}
          </>
        )}
      </div>
      {!diagram && !failure && <p role="status">Rendering the workflow…</p>}
      {failure && (
        <div role="status">
          <p>
            Workflow diagram could not be rendered. The article and its original diagram source
            remain available.
          </p>
          <button onClick={() => setSourceVisible((value) => !value)}>
            {sourceVisible ? "Close diagram source" : "View diagram source"}
          </button>
          {sourceVisible && <pre>{source}</pre>}
        </div>
      )}
      {diagram && (
        <figcaption>
          Scroll to follow the connections at readable size, or fit the complete workflow.
        </figcaption>
      )}
      {diagram && (
        <div
          className="documentation-diagram-viewport"
          ref={viewport}
          tabIndex={0}
          role="region"
          aria-label="Workflow diagram; scroll to follow the full process"
        >
          <div
            className="documentation-diagram-svg"
            style={{ width: diagram.width * scale, height: diagram.height * scale }}
            dangerouslySetInnerHTML={{ __html: diagram.svg }}
          />
        </div>
      )}
    </figure>
  );
}
