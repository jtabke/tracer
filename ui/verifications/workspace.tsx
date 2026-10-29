import type { ConfigurationHandoff } from "../configuration-handoff.ts";
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
  intent,
  returnToAssessments,
}: {
  intent?: ConfigurationHandoff;
  returnToAssessments?(): void;
  entities: Entity[];
  schema: SchemaObject | null;
  editing: Editing;
  active: boolean;
  changed(): void;
  onDirty(value: boolean): void;
}) {
  const [navigation, setNavigation] = useState<{
    selected: string;
    creating: boolean;
    editor: number;
    target?: ConfigurationHandoff;
    acceptedSequence: number;
  }>({ selected: "", creating: false, editor: 0, acceptedSequence: 0 });
  const { selected, creating, editor, target, acceptedSequence } = navigation;
  const [dirty, setDirty] = useState(false),
    [epoch, setEpoch] = useState(0);
  const models = applicationModelChoices(entities, schema, "requirement_verification"),
    cases = entities.filter((e) =>
      Object.values(e.fields).some((x) => record(x) && x.contract === "verification_case_scope"),
    );
  useApplicationDirty(dirty, onDirty);
  function navigate(id: string, create: boolean, target?: ConfigurationHandoff) {
    if (editing.busy) return;
    if (dirty && !window.confirm("Discard this verification draft to choose another case?")) return;
    setDirty(false);
    setNavigation((previous) => ({
      ...previous,
      selected: id,
      creating: create,
      editor: previous.editor + 1,
      target,
      acceptedSequence: target?.sequence ?? previous.acceptedSequence,
    }));
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
      {active && <ApplicationRecovery report={editing.report} refresh={refresh} />}
      {returnToAssessments && (
        <button onClick={returnToAssessments}>Return to change assessments</button>
      )}
      {intent && intent.sequence !== acceptedSequence && (
        <section aria-label="Incoming verification target">
          <p>
            The after configuration is available for a new verification. Existing drafts are
            retained until you explicitly start another case.
          </p>
          <p>
            {intent.pair.afterId} · investigation root {intent.rootId}
          </p>
          <button disabled={editing.busy} onClick={() => navigate("", true, intent)}>
            Start verification for after configuration
          </button>
        </section>
      )}
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
              intent={target}
              models={models}
              entities={entities}
              editing={editing}
              epoch={epoch}
              onDirty={setDirty}
              saved={(id) => {
                setDirty(false);
                setNavigation((previous) => ({ ...previous, creating: false, selected: id }));
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
