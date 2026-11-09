import { useEffect, useRef, useState } from "react";
import type { Schema } from "../src/core/model.ts";
import { ModelMap } from "./model-map.tsx";
import { modelFlow } from "./model-flow.ts";
import { endpointSummary } from "./schema-draft.ts";
import type { DefinitionSelection } from "./schema-guided.tsx";

export function SchemaModelPreview({ draft, initial }: { draft: Schema; initial: boolean }) {
  if (!initial) return null;
  const types = Object.keys(draft.entityTypes);
  if (!types.length)
    return (
      <section className="schema-model-preview schema-preview-empty" aria-label="Model preview">
        <h3>Your project starts with a model</h3>
        <p>
          A model defines the kinds of records you keep and how they connect. Choose a starter
          above, or open Customize model to create your own.
        </p>
      </section>
    );
  return (
    <section className="schema-model-preview" aria-label="Model preview">
      <header>
        <h3>Review your starting model</h3>
        <span>
          {types.length} record types · {Object.keys(draft.relationshipTypes).length} connection
          types
        </span>
      </header>
      <p>
        Follow the connected types to understand the proposed model. These are record types, not
        project records.
      </p>
      <ModelPreviewGraph draft={draft} />
      <p>
        Connections describe recorded relationships. They do not establish successful verification.
        Open Customize model to change types, fields or connections.
      </p>
    </section>
  );
}

function ModelPreviewGraph({ draft }: { draft: Schema }) {
  const [selection, setSelection] = useState<DefinitionSelection>({
    group: "entityTypes",
    name: "",
  });
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const width = Math.max(modelFlow(draft).width, modelFlow(draft, "workflow").width);
    const fit = () =>
      setScale(
        element.clientWidth >= 800
          ? Math.max(0.8, Math.min(1, (element.clientWidth - 24) / width))
          : 1,
      );
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    return () => observer.disconnect();
  }, [draft]);
  const definition = draft[selection.group][selection.name];
  const relationship =
    selection.group === "relationshipTypes" ? draft.relationshipTypes[selection.name] : undefined;
  return (
    <>
      <div ref={viewport} className="schema-preview-graph">
        <ModelMap
          scale={scale}
          schema={draft}
          focus=""
          linking={false}
          source=""
          selectedType={definition && selection.group === "entityTypes" ? selection.name : ""}
          relationship={definition && selection.group === "relationshipTypes" ? selection.name : ""}
          onSelectType={(name) => setSelection({ group: "entityTypes", name })}
          onSelectRelationship={(name) => setSelection({ group: "relationshipTypes", name })}
        />
      </div>
      <div className="schema-preview-selection" aria-live="polite">
        {definition ? (
          <>
            <strong>{selection.name.replaceAll("_", " ")}</strong>
            {relationship && (
              <p>
                Recorded direction: {endpointSummary(relationship.source, "source")} →{" "}
                {selection.name.replaceAll("_", " ")} →{" "}
                {endpointSummary(relationship.target, "target")}
              </p>
            )}
            <p>
              {Object.keys(definition.fields).length
                ? `Fields: ${Object.keys(definition.fields).join(", ").replaceAll("_", " ")}`
                : "No fields defined."}
            </p>
          </>
        ) : (
          <p>
            Select a type to review its fields, or a connection to inspect its recorded direction.
            Scroll horizontally to follow the graph.
          </p>
        )}
      </div>
    </>
  );
}
