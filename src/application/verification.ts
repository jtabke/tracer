import type { ApplicationModelPin } from "../core/application-model.ts";
import type { PrepareVerificationBasis } from "../core/verification-basis.ts";
import type { Repository } from "./ports/repository.ts";
import { prepareModelPin } from "./application-models.ts";
import { resolveVerificationModel } from "./verification-models.ts";
import { prepareVerificationBasis, resolveVerificationBasis } from "./verification-basis.ts";

/** Shared verification meaning. Native storage, evidence and transport retain their own contracts. */
export class Verification {
  private repository: Repository;
  constructor(repository: Repository) {
    this.repository = repository;
  }
  async resolveModel(input: ApplicationModelPin) {
    input = prepareModelPin(input);
    return this.repository.transaction((tx) => resolveVerificationModel(tx, input));
  }
  async prepareBasis(input: PrepareVerificationBasis) {
    input = prepareVerificationBasis(input);
    return this.repository.transaction((tx) => resolveVerificationBasis(tx, input));
  }
}
