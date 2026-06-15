# Mezo — CI/CD Auto-Build + Auto-Deploy Pipeline — Design

> **Date:** 2026-06-14
> **Status:** Approved (brainstorming) → next: writing-plans
> **Driver:** mezo-wxm
> **Scope:** Close the gap between `git push main` and the live cluster. Build the missing
> **build + image-push + tag-write-back** link; the ArgoCD GitOps half already exists and is
> left untouched. CI quality-gating is in scope; multi-env / staging / PR-previews are not.

## Problem

Today `git push` only updates the GitHub repo. The live frontend/backend run from **pre-built
GHCR images** (`ghcr.io/mrkuhne/mezo-{frontend,backend}:0.0.1`), rebuilt and re-tagged **by hand**.
ArgoCD (`argocd/application.yaml`) already watches `k8s/` with `automated: prune + selfHeal`, so a
change to `k8s/` deploys itself — but nothing builds images or bumps the deployment tag. This spec
automates that missing middle.

## Source of truth

- **Deployment topology (live):** `docs/infrastructure/deployment-k3s-argocd.md` — server, GHCR
  images, secrets, the manual build/push commands this pipeline replaces.
- **GitOps contract:** `argocd/application.yaml` — ArgoCD syncs `k8s/` on `main`, automated.
- **Dockerfiles:** `frontend/Dockerfile` (nginx serving a pre-built `dist/`), `backend/Dockerfile`
  (JRE running a pre-built `target/*.jar`). Both package an **already-built artifact** — the build
  happens before `docker build`. This pipeline preserves that contract; the Dockerfiles are not changed.
- **Quality gates:** `CLAUDE.md` → Build & Test (frontend both modes; backend `clean test` with
  `-Dmezo.test.use-testcontainers=true` for CI).
- **Decision rationale for the host stack:** ADR 0001 (k3s + ArgoCD learning track).

## Approved decisions

| Decision | Choice |
|---|---|
| CI platform | **GitHub Actions** (repo on GitHub, GHCR-native, built-in `GITHUB_TOKEN`) |
| Versioning | **Auto-semver from conventional commits** — `BREAKING`/`feat!` → major, `feat` → minor, else patch |
| Version scope | **One shared semver line** for the whole repo (single `vX.Y.Z` git tag) |
| What gets built | **Only the changed component** — path-filter: `frontend/**` → frontend; `backend/**` or `api/**` → backend |
| Deploy trigger | **CI commit-back** — workflow rewrites the changed `k8s/<comp>/deployment.yaml` tag and pushes to `main`; ArgoCD syncs |
| Quality gate | **Tests before build** — frontend both modes (vitest), backend `clean verify` on Testcontainers PG |
| Build arch | **Native amd64** on `ubuntu-latest` (server is x86) — no `buildx` cross-emulation |

## The full chain

```
git push main ─▶ GitHub Actions (.github/workflows/deploy.yml)
                   │
                   ├─ job: version    → next semver from conventional commits since last tag
                   │                    + frontend_changed / backend_changed flags (git diff)
                   │
                   ├─ job: build-frontend  [if frontend_changed]
                   │     pnpm test (real) + VITE_USE_MOCK=true pnpm test  → pnpm build
                   │     → docker build -t ghcr.io/mrkuhne/mezo-frontend:<ver> frontend --push
                   │
                   ├─ job: build-backend   [if backend_changed]
                   │     ./mvnw -B clean verify -Dmezo.test.use-testcontainers=true  (tests + JAR)
                   │     → docker build -t ghcr.io/mrkuhne/mezo-backend:<ver> backend --push
                   │
                   └─ job: release
                         yq: k8s/<changed>/deployment.yaml image tag → <ver>
                         commit "chore(release): v<ver> [skip ci]" + push main
                         git tag v<ver> + push
                         │
                         ▼
                   ArgoCD automated sync (~3 min) ─▶ LIVE
```

## Components (jobs)

Each job has one clear purpose, communicates via job outputs, and can be reasoned about alone.

### `version` (always runs)

- Fetch tags. Last `vX.Y.Z` is the baseline (seeded `v0.0.1` on first run; `0.0.0` if no tag).
- Parse commit subjects since that tag (conventional commits) → bump level → `outputs.version`.
- `git diff <last-tag>..HEAD --name-only` → `outputs.frontend_changed` (`frontend/**`),
  `outputs.backend_changed` (`backend/**` or `api/**`).
- Tooling: a small, well-tried action or a ~20-line bash step (decided in the plan). Either way the
  semver math lives **only here**.

### `build-frontend` — `if: needs.version.outputs.frontend_changed == 'true'`

- `pnpm install` → **`pnpm test`** (real, MSW) → **`VITE_USE_MOCK=true pnpm test`** (mock) — both green.
- `VITE_USE_MOCK=false VITE_API_URL= VITE_OWNER_EMAIL=… VITE_OWNER_PASSWORD=… pnpm build`.
- `docker login ghcr.io` (GITHUB_TOKEN) → `docker build -t ghcr.io/mrkuhne/mezo-frontend:<ver> frontend --push`.
  The existing Dockerfile copies the freshly built `dist/`; not modified.

### `build-backend` — `if: needs.version.outputs.backend_changed == 'true'`

- JDK 21 → **`./mvnw -B clean verify -Dmezo.test.use-testcontainers=true`** — runs the integration
  tests on a throwaway Testcontainers Postgres (no compose in CI) **and** produces `target/*.jar`.
  A failing test means no JAR → no deploy.
- `docker login` → `docker build -t ghcr.io/mrkuhne/mezo-backend:<ver> backend --push`.

### `release` — `needs: [version, build-frontend, build-backend]`

- For each changed component: `yq` rewrites `k8s/<comp>/deployment.yaml` image tag → `<ver>`.
- Commit `chore(release): v<ver> [skip ci]`, push `main`. Push annotated tag `v<ver>`.
- No further action — ArgoCD's existing automated sync rolls it out.

## Guardrails / edge cases

- **No infinite loop:** the release commit carries `[skip ci]`; the workflow guards with
  `if: !contains(github.event.head_commit.message, '[skip ci]')`. `concurrency: deploy-main`
  (no cancel-in-progress) serializes releases.
- **Docs/k8s-only push:** neither component changed → no build, `release` is a no-op (no empty tag bump).
- **Permissions:** workflow `permissions: { contents: write, packages: write }` — `GITHUB_TOKEN`
  pushes images to GHCR and commits the tag back. No new PAT. The cluster keeps pulling with the
  existing `ghcr-pull` secret.
- **Frontend owner build-env:** `VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` come from GitHub **repo
  variables** (demo-owner creds, already documented — not real secrets), never hardcoded in YAML.

## One-time bootstrap (manual, before the first real run)

1. Seed baseline tag: `git tag -a v0.0.1 -m "baseline" <main HEAD>` + `git push origin v0.0.1`.
2. Repo → Settings → Actions → "Read and write permissions" (or rely on the workflow `permissions:` block).
3. Repo → Settings → Variables: `VITE_OWNER_EMAIL`, `VITE_OWNER_PASSWORD`.

## Out of scope (YAGNI — each its own future change)

- Staging environment, PR-preview deploys, GitHub Release changelog generation.
- ArgoCD Image Updater (considered; rejected — semver derivation stays in CI regardless, so it would
  only replace the cheap commit-back with heavier infra + private-GHCR auth).
- Multi-arch images (server is single x86 node).

## Success criteria

- A `feat:`-carrying push touching only `frontend/**` results, with no human action, in: frontend
  tests run → new minor image on GHCR → `k8s/frontend/deployment.yaml` tag bumped via `[skip ci]`
  commit → ArgoCD deploys it → the change is visible at the live URL. Backend untouched.
- A failing test aborts before any image or tag is published.
