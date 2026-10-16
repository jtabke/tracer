import type { RefObject } from "react";
import { useState } from "react";
import type { Schema } from "../src/core/model.ts";
import type { DefinitionSelection } from "./schema-guided.tsx";
import { GuidedDefinitions } from "./schema-guided.tsx";
import { SchemaVisualCanvas } from "./schema-visual-canvas.tsx";

type SurfaceProps = {
  draft: Schema;
  version: number;
  advanced: boolean;
  invalid: string;
  text: string;
  jsonInput: RefObject<HTMLTextAreaElement | null>;
  onAdvanced(value: boolean): void;
  onText(value: string): void;
  onChange(value: Schema): void;
  initialSelection?: DefinitionSelection;
};

export function SchemaEditingSurface(props: SurfaceProps) {
  const { draft, version, invalid, jsonInput, onChange, initialSelection } = props;
  const [visual, setVisual] = useState(true);
  const [inspecting, setInspecting] = useState(
    !!initialSelection || !Object.keys(draft.entityTypes).length,
  );
  const [selection, setSelection] = useState<DefinitionSelection>(
    initialSelection ?? { group: "entityTypes", name: "" },
  );
  const select = (value: DefinitionSelection) => {
    setSelection(value);
    setInspecting(true);
  };
  const switchMode = (next: boolean) => {
    if (invalid) {
      jsonInput.current?.focus();
      return;
    }
    setVisual(next);
  };
  return (
    <>
      <div className="schema-mode-switch" role="group" aria-label="Model editing mode">
        <button type="button" aria-pressed={visual} onClick={() => switchMode(true)}>
          Visual
        </button>
        <button type="button" aria-pressed={!visual} onClick={() => switchMode(false)}>
          Text
        </button>
        <span>One shared draft</span>
      </div>
      <div
        className={`schema-editing-surface ${visual ? "is-visual" : "is-text"} ${inspecting ? "has-properties" : ""}`}
      >
        <div hidden={!visual || inspecting}>
          <SchemaVisualCanvas
            draft={draft}
            version={version}
            selection={selection}
            onSelect={select}
            onChange={onChange}
          />
        </div>
        <SchemaDraftProperties
          source={props}
          visual={visual}
          inspecting={inspecting}
          selection={selection}
          onSelect={select}
          onBack={() => setInspecting(false)}
        />
      </div>
    </>
  );
}

function SchemaDraftProperties({
  source,
  visual,
  inspecting,
  selection,
  onSelect,
  onBack,
}: {
  source: SurfaceProps;
  visual: boolean;
  inspecting: boolean;
  selection: DefinitionSelection;
  onSelect(selection: DefinitionSelection): void;
  onBack(): void;
}) {
  const { draft, onChange, advanced, invalid, jsonInput, onAdvanced, text, onText } = source;
  const name = selection.name.replaceAll("_", " ");
  const toggleAdvanced = (next: boolean) => {
    if (invalid && !next) {
      jsonInput.current?.focus();
      return;
    }
    onAdvanced(next);
  };
  const returnToDefinitions = () => {
    if (!visual && advanced) {
      toggleAdvanced(false);
      if (invalid) return;
    }
    onBack();
  };
  return (
    <div className="schema-properties" hidden={visual && !inspecting}>
      <div className="schema-properties-heading" hidden={!inspecting}>
        <h3>{!visual && advanced ? "Project schema JSON" : name || "New model definition"}</h3>
        <button type="button" onClick={returnToDefinitions}>
          ← Return to {draftReturnLabel(name, visual)}
        </button>
      </div>
      <label hidden={visual}>
        <input
          type="checkbox"
          checked={advanced}
          onChange={(event) => toggleAdvanced(event.target.checked)}
        />
        Advanced JSON
      </label>
      <div hidden={!visual && advanced}>
        <GuidedDefinitions
          draft={draft}
          onChange={onChange}
          compact={visual || inspecting}
          focused={inspecting}
          selection={selection}
          onSelect={onSelect}
        />
      </div>
      <label hidden={visual || !advanced}>
        Project schema JSON
        <textarea
          aria-label="Project schema JSON"
          ref={jsonInput}
          rows={22}
          value={text}
          onChange={(event) => onText(event.target.value)}
        />
      </label>
    </div>
  );
}

function draftReturnLabel(name: string, visual: boolean) {
  if (!visual) return "draft definitions";
  return name ? `${name} draft flow` : "draft workflow overview";
}
