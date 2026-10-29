import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";
import type { AssessmentScope, SupportReference, CandidateKey } from "../core/change-assessment.ts";
import type { Transaction } from "./ports/repository.ts";
import { resolveSupport } from "./assessment-facts.ts";
import {
  configurationVerificationSupport,
  configurationSupportRelated,
} from "./configuration-verification-support.ts";
import type { ConfigurationVerificationSupport } from "./configuration-verification-support.ts";
import { verificationWorkBudget } from "./verification-support.ts";

/** One explicit source-resolution session per analysis/write, with fresh post-write sessions. */
export function assessmentSupportResolver(tx: Transaction, scope: AssessmentScope) {
  const work = verificationWorkBudget(),
    cache = new Map<string, Promise<ConfigurationVerificationSupport>>();
  const target = (reference: Extract<SupportReference, { mode: "configuration" }>) => {
    ensure(
      scope.version === 2,
      "validation",
      "Configuration verification support requires a pair-bound assessment",
    );
    const key = canonical(reference);
    let proof = cache.get(key);
    if (!proof) {
      ensure(
        cache.size < 25,
        "validation",
        "Assessment exceeds 25 distinct target verification proofs; narrow supporting scope",
      );
      proof = configurationVerificationSupport(tx, scope, reference, work);
      cache.set(key, proof);
    }
    return proof;
  };
  const resolve = async (reference: SupportReference, requireCurrent = false) => {
    if (reference.mode !== "configuration") return resolveSupport(tx, reference, requireCurrent);
    const proof = await target(reference);
    if (requireCurrent)
      ensure(
        proof.applicable && !proof.support.hasUnknown,
        "conflict",
        "Selected conclusion is not applicable passing verification for this after configuration",
      );
    return proof.support;
  };
  return {
    resolve,
    async resolveAll(references: SupportReference[], requireCurrent = false) {
      const results = [];
      for (const reference of references) results.push(await resolve(reference, requireCurrent));
      return results;
    },
    async verifies(subject: CandidateKey, references: SupportReference[]) {
      ensure(
        scope.version === 2,
        "validation",
        "Target verification follow-through requires pair scope",
      );
      for (const reference of references)
        if (
          reference.mode === "configuration" &&
          (await configurationSupportRelated(tx, scope, subject, await target(reference)))
        )
          return true;
      return false;
    },
  };
}
export type AssessmentSupportResolver = ReturnType<typeof assessmentSupportResolver>;
