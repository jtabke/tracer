import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { VerificationBasis } from "../core/verification-basis.ts";
import type {
  VerificationCaseScope,
  VerificationConfigurationTarget,
  VerificationTargetPolicy,
} from "../core/verification-case.ts";
import type { Transaction } from "./ports/repository.ts";
import { configurationEngineeringState, currentEngineeringState } from "./engineering-state.ts";
import type { EngineeringStateReader } from "./engineering-state.ts";
import { referenceEngineeringState } from "./reference-engineering-state.ts";

function targetBasis(
  state: EngineeringStateReader & { kind: "configuration" },
  basis: VerificationBasis,
) {
  const members = new Map(
    state.configuration.members.map((pin) => [pin.entity.id, pin.entity.version]),
  );
  const required = [
    { entityId: basis.model.entityId, version: basis.model.version },
    { entityId: basis.requirement.entityId, version: basis.requirement.version },
    ...basis.methods,
  ];
  ensure(
    required.every((pin) => members.get(pin.entityId) === pin.version),
    "validation",
    "Target configuration must select the exact interpretation model, requirement and method revisions",
  );
  const links = new Map(
    state.configuration.relationships!.map((pin) => [pin.relationship.id, pin.relationship]),
  );
  ensure(
    basis.methods.every(
      (method) =>
        canonical(links.get(method.relationship.id) ?? null) === canonical(method.relationship),
    ),
    "validation",
    "Target configuration must select every exact requirement-to-method mapping",
  );
}
export async function bindVerificationTarget(
  tx: Transaction,
  configurationId: string | undefined,
  basis: VerificationBasis,
  policy?: VerificationTargetPolicy,
): Promise<VerificationConfigurationTarget | undefined> {
  if (configurationId === undefined) {
    ensure(policy === undefined, "validation", "Target policy requires a selected configuration");
    return undefined;
  }
  const state = await configurationEngineeringState(tx, configurationId);
  targetBasis(state, basis);
  return {
    configurationId,
    digest: state.digest,
    policy: policy ?? "target-input-correspondence-v1",
  };
}
export async function verificationEngineeringState(
  tx: Transaction,
  scope: VerificationCaseScope,
): Promise<EngineeringStateReader> {
  if (!scope.target) return currentEngineeringState(tx);
  const state = await configurationEngineeringState(tx, scope.target.configurationId);
  ensure(
    state.digest === scope.target.digest,
    "conflict",
    "Verification target capture differs from its controlled genesis",
  );
  targetBasis(state, scope.basis);
  return scope.target.policy === "target-reference-uses-v2"
    ? referenceEngineeringState(tx, state)
    : state;
}
