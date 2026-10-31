# Historical development material

The public project carries maintained product code, user/reference docs, selected specifications and reproducible checks—not alternate prototype implementations or every internal iteration receipt.

## Current owners

- [Architecture](../architecture.md) and its focused reference pages own implemented contracts.
- [Development direction](README.md) separates active needs/design conventions from delivered features.
- [test/workbench/](../../test/workbench/README.md) owns the maintained production-backed regression harness.
- [Private register](register.md) explains local structured delivery/evidence ownership and recovery.

The former `docs/ux-artifacts/` pointer directories are removed. Earlier app/model/layout prototypes, rejected system-neighborhood experiments, image studies and simulated reviews are historical evidence, not candidate product surfaces. Their original status/limitations must be read before reuse.

## Recover a published study or plan

From the repository root:

```sh
mkdir -p output/historical-development
git archive debc6cbf15ea2ff86a2e3036cab3188c7dcf979a docs/ux-artifacts/system-neighborhood \
  | tar -x -C output/historical-development
```

Replace that path with a historical study or plan, such as `docs/development-model-plan.md`. Recovery does not make old commands, proposals or acceptance claims current. Git history has not been rewritten; existing clone history is not made smaller by current-tree cleanup.

## Engineering history

The old long `docs/architecture.md` and `docs/checkpoint.md` mixed current contracts with dated slice progress and superseded designs. Exact pre-reorganization working copies are preserved in `.local/tracer-development/archive/docs/` and in the checksum-verified `output/public-project-cleanup/originals/` snapshot. Superseded slice plans and iteration/review documents are preserved alongside them. Published older versions remain recoverable from Git.

Historical checkpoint paths/hashes name their original candidate, not files promised in a fresh clone. The [private register guide](register.md#historical-evidence) maps former report locations without rewriting immutable captures. The earlier study-only archive remains in ignored `output/repo-cleanup-studies/`.

New studies belong in ignored `studies/`, `experiments/` or `output/`. Promote only selected user-facing images into `docs/images/` or genuinely reused fixture/check source into `test/`. Do not add galleries, generated review exports or internal backup chains to future commits by default.
