import type { ConfigurationHandoff } from "../configuration-handoff.ts";
import type { VerificationSubjectRequest } from "./subject.ts";
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
  subjectRequest,
}: {
  subjectRequest?: VerificationSubjectRequest;
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
    requirement?: Entity;
    acceptedSubjectSequence: number;
  }>({
    selected: "",
    creating: Boolean(subjectRequest),
    editor: 0,
    acceptedSequence: 0,
    requirement: subjectRequest?.requirement,
    acceptedSubjectSequence: subjectRequest?.sequence ?? 0,
  });
  const {
    selected,
    creating,
    editor,
    target,
    acceptedSequence,
    requirement,
    acceptedSubjectSequence,
  } = navigation;
  const [dirty, setDirty] = useState(false),
    [epoch, setEpoch] = useState(0);
  const models = applicationModelChoices(entities, schema, "requirement_verification"),
    cases = entities.filter((e) =>
      Object.values(e.fields).some((x) => record(x) && x.contract === "verification_case_scope"),
    );
  useApplicationDirty(dirty, onDirty);
  function navigate(
    id: string,
    create: boolean,
    target?: ConfigurationHandoff,
    request?: VerificationSubjectRequest,
  ) {
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
      requirement: request?.requirement,
      acceptedSubjectSequence: request?.sequence ?? previous.acceptedSubjectSequence,
    }));
  }
  function refresh() {
    setEpoch((x) => x + 1);
    changed();
  }
  function renderSelectedCase() {
    return creating ? (
      <VerificationBasisEditor
        key={editor}
        intent={target}
        initialRequirement={requirement}
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
    );
  }
  return (
    <section
      className="verification-workspace"
      aria-label="Requirement verification"
      hidden={!active}
    >
      <ApplicationTaskHeader
        title="Verification"
        description="Explicit criteria, actual results and supporting evidence."
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
      <IncomingVerificationSubject
        request={subjectRequest}
        acceptedSequence={acceptedSubjectSequence}
        busy={editing.busy}
        onStart={(request) => navigate("", true, undefined, request)}
      />
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
        <main>{renderSelectedCase()}</main>
      </div>
    </section>
  );
}
function IncomingVerificationSubject({
  request,
  acceptedSequence,
  busy,
  onStart,
}: {
  request?: VerificationSubjectRequest;
  acceptedSequence: number;
  busy: boolean;
  onStart(request: VerificationSubjectRequest): void;
}) {
  if (!request || request.sequence === acceptedSequence) return null;
  return (
    <section aria-label="Incoming requirement verification">
      <p>
        Selected requirement: {request.requirement.key ?? request.requirement.id} · v
        {request.requirement.version} · investigation r{request.projectRevision}.
      </p>
      <p>
        The current case and drafts are retained until you deliberately start another verification.
        Model resolution and exact basis preparation are still required.
      </p>
      <button disabled={busy} onClick={() => onStart(request)}>
        Start verification for selected requirement
      </button>
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
