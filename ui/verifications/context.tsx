import type { Entity } from "../../src/core/model.ts";
import type { VerificationAnalysis } from "../../src/core/verification-lifecycle.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";

export function VerificationContext({
  kind,
  requirement,
  revision,
  target,
  inline = false,
}: {
  kind: "Recorded basis" | "Prepared basis" | "Proposed basis";
  inline?: boolean;
  requirement?: { id: string; key?: string; version: number; title: string };
  revision?: number;
  target?: { id: string; name?: string; policy?: string };
}) {
  return (
    <section
      className={`verification-context${inline ? " verification-context-inline" : ""}`}
      aria-label={inline ? "Proposed verification context" : "Verification context"}
    >
      <strong>{kind}</strong>
      <span>
        {requirement ? (
          <>
            Requirement <code title={requirement.id}>{requirement.key ?? requirement.id}</code> · v
            {requirement.version} · {requirement.title}
          </>
        ) : (
          "Choose an explicit requirement"
        )}
      </span>
      <span>
        {revision === undefined ? "Native basis not prepared" : `Native basis r${revision}`}
      </span>
      <span>
        {target ? (
          <>
            Configuration: {target.name ?? target.id}{" "}
            <code>{target.name && target.name !== target.id ? `(${target.id})` : ""}</code>
            {target.policy ? ` · ${target.policy}` : ""}
          </>
        ) : (
          "Engineering target: current project head"
        )}
      </span>
    </section>
  );
}

export function RecordedVerificationContext({
  analysis,
  entities,
  editing,
  epoch,
}: {
  analysis: VerificationAnalysis;
  entities: Entity[];
  editing: Editing;
  epoch: number;
}) {
  const basis = analysis.view.scope.basis;
  const target = analysis.view.scope.target;
  const configuration = useProjection(
    "/api/configuration",
    target ? { id: target.configurationId } : undefined,
    editing.epoch + epoch,
    editing.report,
  );
  const identity = entities.find((entity) => entity.id === basis.requirement.entityId);
  return (
    <VerificationContext
      kind="Recorded basis"
      requirement={{
        id: basis.requirement.entityId,
        key: identity?.key,
        version: basis.requirement.version,
        title: basis.requirement.title,
      }}
      revision={basis.at.projectRevision}
      target={
        target
          ? {
              id: target.configurationId,
              name:
                configuration.retained?.id === target.configurationId
                  ? configuration.retained.name
                  : undefined,
              policy: target.policy,
            }
          : undefined
      }
    />
  );
}
