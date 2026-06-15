# CI/CD Auto-Build + Auto-Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `git push` to `main` builds the changed image, runs its tests, pushes it to GHCR, bumps the `k8s/` deployment tag via a `[skip ci]` commit, and lets the existing ArgoCD sync deploy it — with no human action.

**Architecture:** One GitHub Actions workflow (`.github/workflows/deploy.yml`) with four jobs — `version` (auto-semver from conventional commits + path-change flags, computed by a unit-tested shell script), conditional `build-frontend` / `build-backend` (test → build → push), and `release` (rewrite the deployment tag, commit-back, git tag). The Dockerfiles and ArgoCD config are unchanged.

**Tech Stack:** GitHub Actions, Bash (semver/path script), Docker + GHCR, pnpm/vitest (FE), Maven/Testcontainers (BE), sed (tag rewrite), actionlint (workflow linting).

**Spec:** `docs/superpowers/specs/2026-06-14-ci-cd-auto-deploy-design.md` · **Driver:** mezo-wxm · **Branch:** `feat/ci-cd-auto-deploy` (already created, spec committed)

---

## File structure

| File | Responsibility |
|---|---|
| `.github/scripts/compute-release.sh` | Pure fns `compute_bump` (commit subjects → major/minor/patch) + `next_version`; `main` reads git, writes `version`/`frontend_changed`/`backend_changed` to `GITHUB_OUTPUT`. |
| `.github/scripts/compute-release.test.sh` | Sources the script, asserts the pure functions. Runnable locally with no GitHub context. |
| `.github/workflows/deploy.yml` | The pipeline: trigger + `[skip ci]` guard + 4 jobs. |
| `docs/decisions/0002-ci-cd-github-actions-auto-deploy.md` | ADR — why CI commit-back over Image Updater, why auto-semver. |
| `docs/infrastructure/deployment-k3s-argocd.md` | Add a "CI/CD pipeline" section (modify). |

---

## Task 1: Semver + path-change script (unit-tested)

**Files:**
- Test: `.github/scripts/compute-release.test.sh`
- Create: `.github/scripts/compute-release.sh`

- [ ] **Step 1: Write the failing test**

Create `.github/scripts/compute-release.test.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=compute-release.sh
source "$DIR/compute-release.sh"

fail=0
assert_eq() { # <actual> <expected> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi
}

assert_eq "$(printf 'fix: a\nchore: b\n'            | compute_bump)" "patch" "fix+chore => patch"
assert_eq "$(printf 'feat: a\nfix: b\n'             | compute_bump)" "minor" "feat => minor"
assert_eq "$(printf 'feat(fe): a\n'                 | compute_bump)" "minor" "scoped feat => minor"
assert_eq "$(printf 'feat!: a\n'                    | compute_bump)" "major" "feat! => major"
assert_eq "$(printf 'refactor: a\n\nBREAKING CHANGE: x\n' | compute_bump)" "major" "BREAKING body => major"
assert_eq "$(next_version 0.0.1 patch)" "0.0.2" "patch bump"
assert_eq "$(next_version 0.1.3 minor)" "0.2.0" "minor resets patch"
assert_eq "$(next_version 1.2.3 major)" "2.0.0" "major resets minor+patch"
exit $fail
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `bash .github/scripts/compute-release.test.sh`
Expected: FAIL — `compute-release.sh: No such file or directory` (source fails).

- [ ] **Step 3: Write the script**

Create `.github/scripts/compute-release.sh`:

```bash
#!/usr/bin/env bash
# Computes the next semver and which components changed, for the deploy workflow.
# Pure fns (compute_bump, next_version) are unit-tested; main() reads git + writes GITHUB_OUTPUT.
set -euo pipefail

# stdin: conventional-commit lines (subjects + bodies). stdout: major | minor | patch.
compute_bump() {
  local level="patch" line
  while IFS= read -r line; do
    if printf '%s' "$line" | grep -qE '^[a-z]+(\([^)]*\))?!:' \
       || printf '%s' "$line" | grep -qiE 'BREAKING[ -]CHANGE'; then
      echo "major"; return 0
    fi
    if printf '%s' "$line" | grep -qE '^feat(\([^)]*\))?:'; then
      level="minor"
    fi
  done
  echo "$level"
}

# args: <current X.Y.Z> <major|minor|patch>. stdout: bumped X.Y.Z.
next_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"
  case "$2" in
    major) major=$((major+1)); minor=0; patch=0 ;;
    minor) minor=$((minor+1)); patch=0 ;;
    patch) patch=$((patch+1)) ;;
  esac
  echo "${major}.${minor}.${patch}"
}

main() {
  git fetch --tags --quiet || true
  local last_tag base_ref base_ver
  last_tag=$(git tag -l 'v*' --sort=-v:refname | head -n1)
  if [ -z "$last_tag" ]; then
    base_ref=$(git rev-list --max-parents=0 HEAD | tail -n1)   # root commit
    base_ver="0.0.0"
  else
    base_ref="$last_tag"; base_ver="${last_tag#v}"
  fi

  local level version changed fe="false" be="false"
  level=$(git log "${base_ref}..HEAD" --format='%s%n%b' | compute_bump)
  version=$(next_version "$base_ver" "$level")
  changed=$(git diff --name-only "${base_ref}..HEAD")
  printf '%s\n' "$changed" | grep -qE '^frontend/'      && fe="true"
  printf '%s\n' "$changed" | grep -qE '^(backend|api)/' && be="true"

  {
    echo "version=${version}"
    echo "frontend_changed=${fe}"
    echo "backend_changed=${be}"
  } >> "${GITHUB_OUTPUT:-/dev/stdout}"
  echo "Resolved v${version} (level=${level}, fe=${fe}, be=${be}) since ${base_ref}" >&2
}

# Run main only when executed directly, so the test can source the pure fns.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then main "$@"; fi
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `bash .github/scripts/compute-release.test.sh`
Expected: 8 `ok` lines, exit 0.

- [ ] **Step 5: Local smoke of `main` against real history**

Run: `GITHUB_OUTPUT=/dev/stdout bash .github/scripts/compute-release.sh`
Expected (no `v*` tag exists yet): prints `version=…`, `frontend_changed=…`, `backend_changed=…` and a `Resolved …` line on stderr. Sanity-check the values look right for the current branch (feat commits present → minor; `.github/` + `docs/` only so far → fe/be both `false` unless run after a FE/BE change).

- [ ] **Step 6: Commit**

```bash
chmod +x .github/scripts/compute-release.sh .github/scripts/compute-release.test.sh
git add .github/scripts/compute-release.sh .github/scripts/compute-release.test.sh
git commit -m "feat(ci): semver + path-change script for deploy pipeline (mezo-wxm)"
```

---

## Task 2: Workflow skeleton + `version` job

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow with trigger, guard, permissions, and the `version` job**

Create `.github/workflows/deploy.yml`:

```yaml
name: deploy
# git push to main -> build the changed image, test it, push to GHCR, bump the
# k8s tag via a [skip ci] commit. ArgoCD (already automated) deploys the result.
on:
  push:
    branches: [main]

concurrency:
  group: deploy-main
  cancel-in-progress: false   # never abort a half-done release; queue instead

permissions:
  contents: write   # commit the tag bump back + push the git tag
  packages: write   # push images to GHCR

jobs:
  version:
    # Skip the release-commit's own push, breaking the loop.
    if: ${{ !contains(github.event.head_commit.message, '[skip ci]') }}
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
      frontend_changed: ${{ steps.calc.outputs.frontend_changed }}
      backend_changed: ${{ steps.calc.outputs.backend_changed }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # full history + tags for semver + diff
      - id: calc
        run: bash .github/scripts/compute-release.sh
```

- [ ] **Step 2: Lint the workflow**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: no errors (if Docker-less, install actionlint and run `actionlint`).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): deploy workflow skeleton + version job (mezo-wxm)"
```

---

## Task 3: `build-frontend` job

**Files:**
- Modify: `.github/workflows/deploy.yml` (add a job under `jobs:`)

- [ ] **Step 1: Add the job**

Append under `jobs:` in `.github/workflows/deploy.yml`:

```yaml
  build-frontend:
    needs: version
    if: ${{ needs.version.outputs.frontend_changed == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - name: Test (real mode, MSW)
        run: pnpm test
      - name: Test (mock mode)
        run: VITE_USE_MOCK=true pnpm test
      - name: Build (real mode, owner baked in)
        env:
          VITE_USE_MOCK: "false"
          VITE_API_URL: ""
          VITE_OWNER_EMAIL: ${{ vars.VITE_OWNER_EMAIL }}
          VITE_OWNER_PASSWORD: ${{ vars.VITE_OWNER_PASSWORD }}
        run: pnpm build
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: frontend
          platforms: linux/amd64
          push: true
          tags: ghcr.io/mrkuhne/mezo-frontend:${{ needs.version.outputs.version }}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): build-frontend job (test both modes -> GHCR) (mezo-wxm)"
```

---

## Task 4: `build-backend` job

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add the job**

Append under `jobs:` in `.github/workflows/deploy.yml`:

```yaml
  build-backend:
    needs: version
    if: ${{ needs.version.outputs.backend_changed == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4    # full repo so ../api contract is present
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
          cache: maven
      - name: Test + package (throwaway Testcontainers PG)
        run: ./mvnw -B clean verify -Dmezo.test.use-testcontainers=true
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: backend
          platforms: linux/amd64
          push: true
          tags: ghcr.io/mrkuhne/mezo-backend:${{ needs.version.outputs.version }}
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): build-backend job (verify on Testcontainers -> GHCR) (mezo-wxm)"
```

---

## Task 5: `release` job — commit-back + tag

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add the job**

Append under `jobs:` in `.github/workflows/deploy.yml`:

```yaml
  release:
    needs: [version, build-frontend, build-backend]
    # Run if nothing failed/cancelled and at least one component shipped.
    # (skipped build jobs are not "failure", so this still fires for FE-only or BE-only.)
    if: >-
      ${{ !failure() && !cancelled() &&
          (needs.version.outputs.frontend_changed == 'true' ||
           needs.version.outputs.backend_changed == 'true') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Bump deployment image tags
        env:
          VERSION: ${{ needs.version.outputs.version }}
          FE: ${{ needs.version.outputs.frontend_changed }}
          BE: ${{ needs.version.outputs.backend_changed }}
        run: |
          if [ "$FE" = "true" ]; then
            sed -i -E "s|(ghcr\.io/mrkuhne/mezo-frontend:).*|\1${VERSION}|" k8s/frontend/deployment.yaml
          fi
          if [ "$BE" = "true" ]; then
            sed -i -E "s|(ghcr\.io/mrkuhne/mezo-backend:).*|\1${VERSION}|" k8s/backend/deployment.yaml
          fi
          git diff --stat
      - name: Commit-back + tag
        env:
          VERSION: ${{ needs.version.outputs.version }}
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add k8s/frontend/deployment.yaml k8s/backend/deployment.yaml
          git commit -m "chore(release): v${VERSION} [skip ci]"
          git tag -a "v${VERSION}" -m "release v${VERSION}"
          git push origin HEAD:main
          git push origin "v${VERSION}"
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): release job — tag bump commit-back + git tag (mezo-wxm)"
```

---

## Task 6: ADR + infra doc + final lint

**Files:**
- Create: `docs/decisions/0002-ci-cd-github-actions-auto-deploy.md`
- Modify: `docs/infrastructure/deployment-k3s-argocd.md`

- [ ] **Step 1: Write the ADR**

Create `docs/decisions/0002-ci-cd-github-actions-auto-deploy.md` (follow the ADR template in `docs/README.md`; cover: context = manual build/tag today; decision = GitHub Actions, auto-semver from conventional commits, one shared version, build only the changed image, CI commit-back into `k8s/`, test-gate before build; alternatives rejected = ArgoCD Image Updater (semver still in CI; heavier infra), always-build-both (wasteful), per-component versions (scope→component mapping brittle); consequences = `[skip ci]` loop guard, baseline tag seeding, `GITHUB_TOKEN` perms). Driver: mezo-wxm.

- [ ] **Step 2: Add a "CI/CD pipeline" section to the infra doc**

In `docs/infrastructure/deployment-k3s-argocd.md`, update the status line near the top (GitOps no longer "manual") and add a section after "Current deployment" describing the `deploy.yml` flow, the four jobs, the `[skip ci]` loop guard, and the one-time bootstrap (baseline tag, repo Actions write permission, `VITE_OWNER_*` repo variables). Point to ADR 0002 and this plan.

- [ ] **Step 3: Final lint of the complete workflow**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: no errors across all four jobs.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0002-ci-cd-github-actions-auto-deploy.md docs/infrastructure/deployment-k3s-argocd.md
git commit -m "docs(ci): ADR 0002 + infra CI/CD section (mezo-wxm)"
```

---

## Task 7: Bootstrap, merge, and end-to-end verification

> Steps 1–2 are **human actions in the GitHub UI / git** — the agent cannot do them. The workflow only runs once it is on `main`.

- [ ] **Step 1 (human): repo settings**

- GitHub → repo → Settings → Actions → General → Workflow permissions → **Read and write permissions**.
- Settings → Secrets and variables → Actions → **Variables** → add `VITE_OWNER_EMAIL = owner@mezo.local`, `VITE_OWNER_PASSWORD = owner`.

- [ ] **Step 2: Seed the baseline tag (decides what the first run deploys)**

**Recommended — also ship the already-committed Futás work:** put the baseline *before* the Futás slice so the first automatic run rebuilds the frontend. Identify the commit just before the earliest Futás commit (the `mezo-axi`/`mezo-ijm` run-slice work) and tag its parent:

```bash
git log --oneline -20            # find the first run-slice commit; note its parent SHA
git tag -a v0.0.1 -m "baseline (pre-CI live image)" <parent-SHA>
git push origin v0.0.1
```

**Alternative — pipeline only, no immediate redeploy:** if the Futás change was already deployed by hand, tag the current `main` HEAD instead (`git tag -a v0.0.1 -m baseline main && git push origin v0.0.1`); the first run is then a no-op until the next FE/BE change.

- [ ] **Step 3: Run quality gates locally before merge**

Run (frontend): `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Run (backend, only if backend changed — it did not here, so optional): `cd backend && ./mvnw clean test`
Expected: all green. (Backend untouched by this branch, so its gate is informational.)

- [ ] **Step 4: Merge the feature branch into main (no-ff) and push**

```bash
git checkout main
git pull --rebase
git merge --no-ff feat/ci-cd-auto-deploy -m "feat(ci): GitHub Actions auto-build + auto-deploy (mezo-wxm)"
git branch -d feat/ci-cd-auto-deploy
bd dolt push && git push
```

- [ ] **Step 5: Observe the first pipeline run end-to-end**

- `gh run watch` (or GitHub → Actions). Confirm: `version` resolves a sane `vX.Y.Z`; the changed build job runs tests then pushes the image; `release` commits `chore(release): vX.Y.Z [skip ci]` and pushes the tag.
- Confirm the `[skip ci]` commit did **not** trigger a second run.
- `export KUBECONFIG=~/.kube/mezo-k3s.yaml && kubectl -n mezo get pods -w` — watch the new image roll out (ArgoCD picks up the tag within ~3 min; `kubectl -n mezo describe deploy/frontend | grep Image` should show the new tag).
- Open the live URL and confirm the Futás changes are visible.

- [ ] **Step 6: Close the issue**

```bash
bd close mezo-wxm "CI/CD pipeline live: push->test->build->GHCR->tag commit-back->ArgoCD deploy"
git push && bd dolt push
```

---

## Self-review notes

- **Spec coverage:** version job (Task 2) ↔ "version" component; build-frontend/backend (Tasks 3–4) ↔ conditional build + test-gate; release (Task 5) ↔ commit-back + `[skip ci]` + tag; guardrails (concurrency, `[skip ci]`, perms, repo variables) ↔ Tasks 2/5/7; bootstrap ↔ Task 7; docs (ADR + infra) ↔ Task 6. All spec sections mapped.
- **Deviation from spec (intentional):** the spec mentioned `yq` for the tag rewrite; the plan uses `sed -i -E` to avoid depending on `yq` being present on the runner. Same effect, fewer moving parts — noted in ADR 0002.
- **Type/name consistency:** job outputs `version` / `frontend_changed` / `backend_changed` are produced once in `compute-release.sh` and referenced unchanged in every downstream `needs.version.outputs.*`. Image names `ghcr.io/mrkuhne/mezo-{frontend,backend}` match the Dockerfiles, the existing `k8s/*/deployment.yaml`, and the `sed` patterns.
- **Placeholder scan:** the ADR (Task 6 Step 1) is described by required content, not pre-written, because it must follow the repo's ADR template — its required sections are enumerated, not left as "TODO".
