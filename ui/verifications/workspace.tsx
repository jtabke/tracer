import { useState } from "react";
import type { Entity, SchemaObject } from "../../src/core/model.ts";
import { record } from "../../src/core/model.ts";
import type { Editing } from "../editing.ts";
import {
  applicationModelChoices,
  RecordChoice,
  useApplicationDirty,
} from "../application-choices.tsx";
import { useProjection } from "../use-projection.ts";
import { ApplicationTaskHeader, ApplicationRecovery } from "../application-task.tsx";
import { VerificationBasisEditor } from "./basis.tsx";
import { VerificationDetail } from "./detail.tsx";
import "./workspace.css";
export function VerificationWorkspace({
  entities,
  schema,
  editing,
  active,
  changed,
  onDirty,
}: {
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  active: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [dirty, setDirty] = useState(false),
    [epoch, setEpoch] = useState(0),
    [editor, setEditor] = useState(0);
  const models = applicationModelChoices(entities, schema, "requirement_verification"),
    cases = entities.filter((e) =>
      Object.values(e.fields).some((x) => record(x) && x.contract === "verification_case_scope"),
    );
  useApplicationDirty(dirty, onDirty);
  function navigate(id: string, create: boolean) {
    if (editing.busy) return;
    if (dirty && !window.confirm("Discard this verification draft to choose another case?")) return;
    setDirty(false);
    setSelected(id);
    setCreating(create);
    setEditor((x) => x + 1);
  }
  function refresh() {
    setEpoch((x) => x + 1);
    changed();
  }
  return (
    <section
      className="verification-workspace"
      aria-label="Requirement verification"
      hidden={!active}
    >
      <ApplicationTaskHeader
        title="Verification"
        description="Declare what must be checked, retain actual results and explain whether the conclusion still applies."
        createLabel="New verification"
        refreshLabel="Refresh verification"
        busy={editing.busy}
        create={() => navigate("", true)}
        refresh={refresh}
      />
      <ApplicationRecovery report={editing.report} refresh={refresh} />
      <div className="verification-layout">
        <nav aria-label="Verification cases">
          <RecordChoice
            name="Verification case"
            entities={cases}
            value={selected}
            onChange={(id) => navigate(id, false)}
          />
          <small>
            Choices come from the current project snapshot. Opening validates controlled history.
          </small>
        </nav>
        <main>
          {creating ? (
            <VerificationBasisEditor
              key={editor}
              models={models}
              entities={entities}
              editing={editing}
              epoch={epoch}
              onDirty={setDirty}
              saved={(id) => {
                setDirty(false);
                setCreating(false);
                setSelected(id);
                refresh();
              }}
            />
          ) : selected ? (
            <LocatedVerification
              key={selected}
              caseId={selected}
              entities={entities}
              editing={editing}
              epoch={epoch}
              changed={refresh}
              onDirty={setDirty}
            />
          ) : (
            <p>
              Select a recorded case or start a verification from an explicit requirement and method
              scope. A linked plan or report alone is not a verified conclusion.
            </p>
          )}
        </main>
      </div>
    </section>
  );
}
function LocatedVerification({
  caseId,
  entities,
  editing,
  epoch,
  changed,
  onDirty,
}: {
  caseId: string;
  entities: Entity[];
  editing: Editing;
  epoch: number;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const located = useProjection(
    "/api/verification-case-locate",
    { caseId },
    epoch + editing.epoch,
    editing.report,
  );
  const analysis = useProjection(
    "/api/verification-analysis",
    located.retained ? { caseId, openingCommandId: located.retained.opening.commandId } : undefined,
    epoch + editing.epoch,
    editing.report,
  );
  return (
    <>
      {(located.loading || analysis.loading) && (
        <p role="status">Checking the complete verification scope and current evidence…</p>
      )}
      {(located.failed || analysis.failed) && (
        <p role="alert">
          Current verification could not be checked. Retained context and drafts are read only;
          refresh to try again.
        </p>
      )}
      {analysis.retained && (
        <VerificationDetail
          analysis={analysis.retained}
          entities={entities}
          editing={editing}
          ready={located.ready && analysis.ready}
          epoch={epoch}
          changed={changed}
          onDirty={onDirty}
        />
      )}
    </>
  );
}
