# 0002 — CI/CD: GitHub Actions auto-deploy on push to main

- **Status:** Accepted
- **Date:** 2026-06-14
- **Driver:** mezo-wxm

## Context

mezo runs on a single-VPS k3s cluster where **ArgoCD already auto-syncs the `k8s/` directory**
(`automated: prune + selfHeal`, see [ADR 0001](0001-deploy-on-k3s-argocd-learning-track.md)). The
*deploy* half is therefore solved: whatever image tag is committed in `k8s/<comp>/deployment.yaml`
lands on the cluster automatically.

The *build* half was still manual. Shipping a change meant locally running tests, building each
image with `docker buildx`, pushing to GHCR with a hand-picked tag, hand-editing the deployment
manifest, and remembering to git-tag the release. This is slow, error-prone, and easy to get
out of order — exactly the toil GitOps is supposed to remove. The repo already uses conventional
commits, so the version a change *deserves* is derivable, not a judgement call.

Goal: a `git push` to `main` should build, test, and roll out the changed component end-to-end,
with a sensible semver tag, without touching ArgoCD.

See the design spec [`docs/superpowers/specs/2026-06-14-ci-cd-auto-deploy-design.md`](../superpowers/specs/2026-06-14-ci-cd-auto-deploy-design.md)
and the implementation plan [`docs/superpowers/plans/2026-06-14-ci-cd-auto-deploy.md`](../superpowers/plans/2026-06-14-ci-cd-auto-deploy.md).

## Decision

Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that fires on push to `main` and,
between the push and ArgoCD, fills the build-and-tag gap. Five decisions shape it:

- **GitHub Actions as the CI platform.** The repo is on GitHub, GHCR is the registry, and the
  built-in `GITHUB_TOKEN` covers both pushing images and committing back — no extra PAT or
  third-party CI to provision.
- **Auto-semver from conventional commits.** `.github/scripts/compute-release.sh` derives the next
  version from the commits since the last `v*` tag: `feat` → minor, `feat!` / `BREAKING CHANGE:`
  → major, anything else → patch. The repo already commits this way, so the tag is free.
- **One shared version line for the whole repo.** A single `vX.Y.Z` tag covers both components; the
  workflow path-filters `git diff` (`frontend/**` → FE, `backend/**` or `api/**` → BE) and **builds
  only the changed image**, but stamps it with the one repo version.
- **CI commit-back into `k8s/` as the deploy trigger.** The `release` job rewrites the changed
  `k8s/<comp>/deployment.yaml` image tag and commits it back to `main`. That commit is the GitOps
  trigger; ArgoCD (unchanged) syncs it. No new infrastructure in the cluster.
- **Test-gate before build.** Frontend runs `pnpm test` in both real (MSW) and mock modes; backend
  runs `./mvnw -B clean verify` against a throwaway Testcontainers Postgres. Images are built and
  pushed only after tests pass.

Job graph: `version` → (`build-frontend` ⋁ `build-backend`, each conditional on its path flag) →
`release` (runs when nothing failed and at least one component shipped).

## Consequences

**Makes easy / good:**
- `git push` to `main` is now the entire release: correct semver, tested image, rolled out via the
  existing ArgoCD automation. No manual `docker buildx` / tag bookkeeping.
- FE-only pushes (the common case) skip the multi-minute backend build entirely.

**Deviations from the design spec (intentional):**
- **Tag rewrite uses `sed`, not `yq`.** Same effect (rewrite the image tag in the deployment YAML)
  without depending on `yq` being installed on the runner.
- **Added `git pull --rebase origin main` before the commit-back push.** Guards against a
  non-fast-forward if `main` advances mid-run; without it the release push could be rejected.

**Things to maintain / watch:**
- **`[skip ci]` loop-break guard.** The `release` commit is `chore(release): v<ver> [skip ci]`; the
  `version` job is gated `if: !contains(head_commit.message, '[skip ci]')`, so the release commit
  does not re-trigger the workflow. If that token is ever dropped, the pipeline loops.
- **One-time manual bootstrap** (not automated):
  - seed a baseline `v0.0.1` git tag (the semver math needs a starting point);
  - repo **Settings → Actions → Workflow permissions → "Read and write permissions"**;
  - repo **Variables** `VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` (the demo-owner creds baked into
    the frontend build — demo values, not real secrets).
- **`GITHUB_TOKEN` permissions:** the workflow declares `contents: write` (commit + tag back) and
  `packages: write` (push to GHCR). The cluster still pulls private images with the existing
  `ghcr-pull` secret — that is unchanged.
- **Branch-protection caveat:** if `main` ever gains PR-required protection, the default
  `GITHUB_TOKEN` commit-back push will be rejected; it would then need a PAT / GitHub App token or
  a protection bypass.

## Alternatives considered

- **ArgoCD Image Updater** (instead of the CI commit-back) — rejected: the conventional-commit
  semver derivation has to live in CI regardless, so Image Updater would only swap the cheap
  commit-back for heavier in-cluster infra plus private-GHCR auth, buying nothing.
- **Always build both images** — rejected: wasteful; every FE-only push (the majority) would run
  the multi-minute backend build for no reason. The path-filter avoids it.
- **Per-component versions** (separate FE/BE tags) — rejected: mapping commit scope → component is
  brittle (`fix(train)` is which side? `chore(bd)` is neither), and the repo is almost entirely
  frontend commits, so a single shared version is simpler and accurate enough.
