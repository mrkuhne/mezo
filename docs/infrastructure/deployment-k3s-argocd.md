# Deployment architecture — single-VPS k3s + ArgoCD + pgAdmin

**Status:** LIVE (built 2026-06-14) · ArgoCD GitOps active on `k8s/`; **deploy half is CI-driven** — `git push` to `main` builds + tags + rolls out (see [CI/CD pipeline](#cicd-pipeline-git-push--live) + [ADR 0002](../decisions/0002-ci-cd-github-actions-auto-deploy.md)). · **Driver:** mezo-ht3 · **Decision:** [ADR 0001](../decisions/0001-deploy-on-k3s-argocd-learning-track.md)

This is where and how mezo is meant to run in production-for-learning. The primary goal is to
practice the **client stack (Kubernetes + ArgoCD + pgAdmin)** while hosting the app. See ADR 0001
for *why* this path over a managed/Coolify deploy. For day-to-day operation, access, logins,
troubleshooting, and recovery, see the **[operational runbook](runbook.md)**.

## Topology (one box)

```
                         Internet
                            │  (443/80, mezo.<domain>)
                            ▼
              ┌─────────────────────────────────┐
              │  Hetzner VPS (CX32, ~8GB, Ubuntu │
              │  24.04)  —  k3s single node       │
              │                                   │
              │  Traefik ingress (bundled in k3s) │
              │     ├── /      → frontend Service  │
              │     └── /api   → backend Service   │
              │                                   │
              │  namespace: mezo                  │
              │   ├ frontend  Deployment + Service (nginx, static build)
              │   ├ backend   Deployment + Service (Spring Boot :8090, profile=demodata)
              │   ├ postgres  StatefulSet + PVC + Secret (local-path storage)
              │   └ pgadmin   Deployment + Service  ← PRIVATE (no ingress)
              │                                   │
              │  namespace: argocd                │
              │   └ ArgoCD  → watches git repo k8s/ dir (GitOps)
              └─────────────────────────────────┘
                            ▲
              Tailscale / kubectl port-forward (admin: pgAdmin, ArgoCD UI)
```

## Components

| Component | k8s object(s) | Notes |
|---|---|---|
| **k3s** | — | Lightweight Kubernetes. Bundles Traefik ingress + `local-path` storage + `kubectl`. Install via `curl -sfL https://get.k3s.io \| sh -`. |
| **Ingress** | `Ingress` (Traefik) | HTTPS via Let's Encrypt. Host routes: `/` → frontend, `/api` → backend. |
| **frontend** | `Deployment` + `Service` | `pnpm build` output served by nginx. Image in GHCR. REAL mode (targets `/api`). |
| **backend** | `Deployment` + `Service` | Spring Boot, container on :8090. Profile `demodata` (owner seed). Env/secrets from `Secret`/`ConfigMap`. Image in GHCR. |
| **postgres** | `StatefulSet` + `PVC` + `Secret` | Postgres 16 — image `pgvector/pgvector:pg16` since 2026-07-03 (companion V2.1 vector layer; same PG16 major, data kept on the PVC). `local-path` PVC for data. Credentials in a `Secret`. Not exposed outside the cluster. |
| **pgAdmin** | `Deployment` + `Service` | DB GUI. **No Ingress** — reach via `kubectl port-forward` or Tailscale only. |
| **DB backup** | `CronJob` + `PVC` | Nightly `pg_dump -Fc` → `postgres-backup` PVC (14-day rotation) + daily offsite pull to the admin Mac (`scripts/backup-live-db.sh`, launchd). [ADR 0009](../decisions/0009-postgres-backup-cronjob-plus-mac-pull.md), runbook §6. |
| **ArgoCD** | install + `Application` | GitOps controller in `argocd` namespace; `Application` points at the repo's `k8s/` directory. |

## Repository layout (target)

```
k8s/
├── namespace.yaml
├── postgres/        statefulset.yaml, service.yaml, secret.yaml, pvc.yaml
├── backend/         deployment.yaml, service.yaml, configmap.yaml
├── frontend/        deployment.yaml, service.yaml
├── ingress.yaml
└── pgadmin/         deployment.yaml, service.yaml
argocd/
└── application.yaml   # ArgoCD Application pointing at k8s/
```

## Security baseline (mandatory)

- **pgAdmin and ArgoCD UI are never publicly exposed.** Admin access only over Tailscale or `kubectl port-forward`.
- Host hardening: SSH key only, `ufw` (allow 22 from Tailscale, 80/443 public), automatic OS security updates.
- Secrets live in k8s `Secret` objects (graduate to Sealed Secrets / SOPS before committing any secret to git — never commit plaintext secrets).
- DB has no public port; only reachable inside the cluster network.
- **No NetworkPolicy exists today — every pod has unrestricted egress.** Recorded explicitly here
  because the push-notification backend (`techcore/webpush`, [`_platform-notifications.md`](../features/_platform-notifications.md))
  depends on it: the backend pod needs outbound HTTPS to the push services themselves —
  **`*.push.apple.com`** (Apple's Web Push relay, required for iOS home-screen PWAs) and
  **`fcm.googleapis.com`** (the transport some Web Push subscriptions route through). If a
  NetworkPolicy is ever introduced, it **must** allowlist this egress explicitly, or push silently
  stops working with no error surfaced anywhere (a `WebPushClient.send` connection failure just
  maps to `WebPushResult.FAILED`, logged, and the fan-out moves on).

## Cost

| Item | Cost |
|---|---|
| Kubernetes (k3s), ArgoCD, pgAdmin | **Free** (OSS) |
| GHCR image hosting | Free |
| Hetzner CX32 VPS (~8 GB) | ~EUR 9–14 / month |
| Domain | existing |

## Build / learn sequence (maps to mezo-ht3)

0. Provision VPS + harden (SSH key, `ufw`, Tailscale).
1. Install k3s; verify `kubectl get nodes`. Learn: node, pod, `get/describe/logs`.
2. Write mezo manifests (namespace → Postgres → backend → frontend → Ingress). Hand-apply with `kubectl apply`.
3. Add pgAdmin (private). Learn why DB admin is never on the public internet.
4. Install ArgoCD; create the `Application`; switch to push-to-deploy. Learn the manual-vs-GitOps contrast.
5. Build FE/BE images → GHCR; wire `imagePullSecret`.

Tip: steps 1–3 can be rehearsed locally on **k3d/minikube** with zero VPS cost before touching the real box.

## Current deployment (live as of 2026-06-14)

| Fact | Value |
|---|---|
| Server | Hetzner CX33, 8 GB, x86, **Ubuntu 26.04 LTS**, Nuremberg |
| Public IP | `46.225.112.172` |
| Tailscale (private admin) | server `mezo-k3s` = `100.75.51.113`; admin Mac = `100.68.26.113` |
| k3s | `v1.35.5+k3s1` (Traefik ingress + local-path storage bundled) |
| Public URL | `https://46.225.112.172.sslip.io/` (Let's Encrypt via cert-manager) |
| Images | `ghcr.io/mrkuhne/mezo-backend:0.0.1`, `ghcr.io/mrkuhne/mezo-frontend:0.0.1` (private; pulled with `ghcr-pull` secret) |
| Owner login | `owner@mezo.local` / `MEZO_OWNER_PASSWORD` (demodata seed; entered through the app's own login screen — no longer baked into the frontend build, since `mezo-qw37` S1) |
| Backend timezone | `TZ=Europe/Budapest` on the backend Deployment env (`k8s/backend/deployment.yaml:34`) — pins the JVM default zone so business-date columns (`level_up_event.occurred_on`, gamification streak/coin rollover) and every `@Scheduled` cron run on Budapest wall-clock, not the eclipse-temurin UTC default. Without it, a 00:00–02:00 log lands on the previous business date (mezo-k0t2) and the crons fire 1–2 h off their intended local time. Matches `k8s/postgres/backup-cronjob.yaml`'s `timeZone`. **Now also load-bearing for push-notification timing** ([`_platform-notifications.md`](../features/_platform-notifications.md) §8) — mezo has no per-user `Profile.timezone`, so the (not-yet-built, N2) per-minute notification dispatcher will resolve every anchor (gym start, sleep wind-down, Napzárás window, check-ins) off this same server zone; changing or unsetting `TZ` would silently shift every notification's send time, not just date bucketing. |
| Secrets (NOT in git) | `mezo-db` (DB creds), `mezo-app` (JWT + owner), `ghcr-pull` (registry), `mezo-tls` (cert, cert-manager-managed). Planned: `GEMINI_API_KEY` joins `mezo-app` + the backend Deployment env when the Phase-3 companion first deploys (ADR 0008) — until then the backend boots on its dummy-key default. **Same pattern for push notifications:** `VAPID_PUBLIC`/`VAPID_PRIVATE` (the Web Push VAPID keypair — [`_platform-notifications.md`](../features/_platform-notifications.md), [ADR 0014](../decisions/0014-own-webpush-implementation.md)) join the existing `mezo-app` SealedSecret + the backend Deployment env once a real keypair is generated; until then the backend boots on `application.yml`'s `dummy-vapid-public`/`dummy-vapid-private` defaults, which now **fail loudly** on the first real send (`VapidSigner.decodePrivateKey` rejects a malformed scalar) rather than silently minting a well-formed-but-useless token. **DONE 2026-07-29** (`mezo-7kr3`): a real P-256 pair is sealed into `mezo-app` and wired into the backend env; the public half is also the `VITE_VAPID_PUBLIC` repo variable (see the gotcha below). |

Local admin access:
- `kubectl` from the Mac: `export KUBECONFIG=~/.kube/mezo-k3s.yaml` (context `mezo`, server `https://100.75.51.113:6443` over Tailscale).
- SSH: `ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113` (or the public IP).

Build/push images (arm64 Mac → amd64 server):
```bash
# backend
cd backend && ./mvnw -B clean package -DskipTests
docker buildx build --platform linux/amd64 -t ghcr.io/mrkuhne/mezo-backend:<tag> backend --push
# frontend
cd frontend && VITE_USE_MOCK=false VITE_API_URL= pnpm build
docker buildx build --platform linux/amd64 -t ghcr.io/mrkuhne/mezo-frontend:<tag> frontend --push
```

pgAdmin (step 3): deployed, private. Reachable on the tailnet at
**https://pgadmin.tail8ce56d.ts.net** (always on, no port-forward, never public).

ArgoCD (step 4): installed in `argocd` ns; manages the `k8s/` dir via
`argocd/application.yaml` (GitOps). UI on the tailnet at
**https://argocd.tail8ce56d.ts.net** (argocd-server runs `--insecure`; TLS terminated
by the Tailscale proxy).

Private admin access (Tailscale operator):
- Installed via Helm (`tailscale/tailscale-operator`, ns `tailscale`) with an OAuth
  client (scopes Devices Core + Auth Keys write, tag `tag:k8s-operator`). OAuth creds
  live in the `operator-oauth` Secret, not git; rotate in the Tailscale admin console.
- **`proxyConfig.defaultTags=tag:k8s-operator`** (override) — the default `tag:k8s`
  failed to mint auth keys; the OAuth client can only assign `tag:k8s-operator`.
- Exposed via Tailscale `Ingress` (ingressClassName `tailscale`): `k8s/pgadmin/ingress-tailscale.yaml`
  (ArgoCD-managed) and `argocd/ingress-tailscale.yaml` (applied manually, argocd ns).
- Tailnet ACL needs `tagOwners` for `tag:k8s-operator` (and `tag:k8s`); HTTPS enabled on the tailnet.

Sealed Secrets: DONE. `mezo-db`, `mezo-app`, `ghcr-pull`, `pgadmin-auth` now live in git
as encrypted SealedSecrets (`k8s/**/sealedsecret*.yaml`), decrypted by the sealed-secrets
controller (kube-system, Helm). No more imperative `kubectl create secret`. See k8s/README.md.

Still TODO: HTTP→HTTPS redirect (optional).

## CI/CD pipeline (`git push` → live)

A `git push` to `main` now builds, tags, and rolls out the changed component automatically —
no manual `docker buildx` / tag bookkeeping. **Tests are intentionally NOT run in CI** (mezo-oa3):
the suite is a **local pre-push gate** (see CLAUDE.md "Session Completion"), so the deploy path goes
straight to build → push → release for speed. The build half lives in
**`.github/workflows/deploy.yml`** (GitHub Actions); the deploy half is the **unchanged** ArgoCD
auto-sync on `k8s/`. See [ADR 0002](../decisions/0002-ci-cd-github-actions-auto-deploy.md) for the
*why* and [`docs/superpowers/plans/2026-06-14-ci-cd-auto-deploy.md`](../superpowers/plans/2026-06-14-ci-cd-auto-deploy.md)
for the build-out steps.

**Flow** — four jobs, fired on push to `main`:

1. **`version`** — runs `.github/scripts/compute-release.sh`: computes the next semver from the
   conventional commits since the last `v*` tag (`feat` → minor, `feat!` / `BREAKING CHANGE:` →
   major, else patch) and derives `frontend_changed` / `backend_changed` by comparing each
   top-level directory's **tree-object hash** between the base and HEAD (`frontend` → FE;
   `backend` or `api` → BE). Tree hashes are used rather than `git diff base..HEAD`, which proved
   unreliable under `actions/checkout`'s merge-commit checkout — it silently reported the backend
   as unchanged on the first run and skipped its deploy (fixed in mezo-7n5).
2. **`build-frontend`** (only if FE changed) — `pnpm build` (no owner creds baked in since
   `mezo-qw37` S1 — login happens at runtime) → docker build/push
   `ghcr.io/mrkuhne/mezo-frontend:<ver>`. No test step (mezo-oa3).
3. **`build-backend`** (only if BE changed) — `./mvnw -B clean package -DskipTests` (no
   Testcontainers/Docker needed since tests are skipped) → docker build/push
   `ghcr.io/mrkuhne/mezo-backend:<ver>`.
4. **`release`** (if nothing failed and ≥1 component shipped) — runs
   `.github/scripts/release-commit.sh`: rewrites the changed `k8s/<comp>/deployment.yaml` image
   tag to `<ver>`, commits it back as `chore(release): v<ver> [skip ci]`,
   `git pull --rebase origin main` (non-fast-forward guard), tags **`v<ver>` on the commit the
   images were built from** (`github.sha`, *not* the rebased manifest commit — see the
   concurrency invariant below), and pushes. **ArgoCD then syncs that commit and deploys it.**

**Loop guard:** the release commit carries `[skip ci]`, and the `version` job is gated
`if: !contains(head_commit.message, '[skip ci]')`, so the release commit does not re-trigger the
workflow.

**Convention + test gates — `.github/workflows/ci.yml` (separate workflow; mezo-ah18.4 + .5):**
runs on every push to `main` and on PRs, parallel to `deploy.yml` and **not blocking it**
(decision in ADR 0007: fix-forward beats slowing every release). Four jobs:
`lint` (`node scripts/lint-docs.mjs --errors-only` — doc errors block, 🔶 staleness advisory;
`node scripts/lint-liquibase.mjs` — migration filename/constraint-prefix/seed-SQL rules),
`contract-drift` (regenerates the OpenAPI fragment merge + FE `api.gen.ts` and fails on
`git diff` vs the committed artifacts), `test-frontend` (vitest in real AND mock mode) and
`test-backend` (full IT suite on Testcontainers Postgres). Rationale and the phased plan
(→ ESLint → ArchUnit next) in [ADR 0007](../decisions/0007-machine-enforcement-of-conventions.md).

**Workflow permissions:** `contents: write` (commit + tag back) and `packages: write` (push to
GHCR), both via the built-in `GITHUB_TOKEN`. The cluster still pulls private images with the
existing `ghcr-pull` secret (unchanged).

**One-time bootstrap (manual, already done):**
- Repo **Settings → Actions → Workflow permissions → "Read and write permissions"** (so the
  commit-back + tag push are allowed).
- Repo **Variables** `VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` — **OBSOLETE since `mezo-qw37` S1**:
  the frontend no longer reads them at build time (login happens at runtime through the app's own
  login screen). Nothing in CI or the build references them anymore; remove them from
  **Settings → Secrets and variables → Actions → Variables** the next time someone is in there.
- **GHCR package → Actions access** for each private package (`mezo-frontend`, `mezo-backend`):
  package **Settings → "Manage Actions access" → Add Repository → `mrkuhne/mezo` → Write**. The
  packages were first created by hand with a PAT, so they are not auto-linked to the repo; without
  this the `GITHUB_TOKEN` push fails with `denied: permission_denied: write_package`.
- **No baseline tag was seeded** — with no `v*` tag the first run computes from the repo root
  (`feat` history → **v0.1.0**) and builds both images; the `release` job then creates the `v*`
  tag, so later runs bump from there.

**Caveat:** if `main` ever gains PR-required branch protection, the default `GITHUB_TOKEN`
commit-back push is rejected — it would then need a PAT / GitHub App token or a protection bypass.

### Concurrency invariant — the tag names what was BUILT, never what main has become (mezo-pl7d)

`concurrency: deploy-main` queues deploys, so a run can finish long after its own merge. That
opens a race:

1. merge **M1** lands; its run builds images from M1;
2. merge **M2** lands while those images build (GitHub cancels the *pending* run for any
   intermediate merge, so only the newest queued run survives);
3. M1's `release` job rebases its manifest commit onto the new main — which now contains M2 —
   and *used to tag there*.

Tag `vX` therefore described **M2's** `frontend`/`backend`/`api` trees, which were never in any
image. The next run takes `vX` as its base, compares tree hashes, sees no difference, reports
`fe=false/be=false` and **skips the build entirely**. M2 ships never, and nothing goes red.
Observed 2026-09-04 (run 33920695717 built `ca82135`, released `v2.163.0` rebased onto
`58608d47` which already contained PRs #436 and #435).

**Invariant:** the manifest commit *must* rebase (main moves), but the **tag must stay on
`github.sha`** — the commit the images were built from. `release-commit.sh` tags
`git tag -a "v$VERSION" "$BUILT_SHA"`, so tag provenance matches image provenance by
construction, and the queued run for M2 correctly still sees M2 as unbuilt.

`release-commit.test.sh` (run by `ci.yml`) replays exactly this two-merge sequence against a
throwaway repo with a local bare origin, and asserts both halves: the tag's per-directory tree
hashes equal the built commit's, *and* the next `compute-release.sh` run still reports
`backend_changed=true`. Against the pre-fix logic it fails on both.

**Recovery**, if a component was skipped this way: re-run `deploy.yml` via
`workflow_dispatch` with `force_frontend` / `force_backend`, which ORs past the tree-hash
detection. Then hard-refresh ArgoCD and confirm the pod's image tag.

### Gotcha — SIGPIPE in `compute-release.sh` silently stopped every deploy (mezo-0j9n)

Between 2026-09-04 and 2026-09-05, **14 of 15 consecutive `main` deploys failed** on the
`version` job with `exit 141` and **not one line of output** — while `ci.yml` stayed green, so
nothing surfaced it (deploys are deliberately not gated on CI, ADR 0007).

`141 = 128 + 13 = SIGPIPE`. The culprit was

```bash
last_tag=$(git tag -l 'v*' --sort=-v:refname | head -n1)   # under `set -euo pipefail`
```

`head -n1` prints line 1 and **exits**, closing the pipe. What matters is *not* the 64 KiB pipe
buffer (the tag list is only ~4 KiB) but git's **4 KiB stdio buffer**: once the repo passed
**500 tags = 4130 bytes**, git needed a *second* `write(2)`, which hit the closed pipe →
`SIGPIPE` → git exits 141 → `pipefail` promotes 141 to the pipeline's status → `set -e` kills
the script before its first `echo`. Below 4096 bytes git wrote once and the bug did not exist —
which is why the failure appeared suddenly and then became 100% reproducible as tags accrued.
It reproduces only on the Linux/glibc runner, never on macOS.

**Fix:** `git for-each-ref --count=1 --sort=-v:refname --format='%(refname:short)' 'refs/tags/v*'`
— the limit happens inside git, so there is no pipe and no reader to race. The same hazard was
removed from `compute_bump` (it used to `return 0` on the first breaking-change line while
`git log` was still writing into it) and from its per-line `printf | grep -q` pairs, now bash
`=~`. An `ERR` trap makes any future abort print `::error::… at: <command>` instead of dying mute.

**Gate:** `.github/scripts/compute-release.test.sh` existed but **no workflow ran it**. Both it
and the new `compute-release.sigpipe.test.sh` now run in `ci.yml`'s `lint` job. The SIGPIPE test
drives `main()` against a fake `git` that streams a >64 KiB, line-flushed tag list, so any
early-exiting pipe reader fails it deterministically on every platform, macOS included.

### Gotcha — a changed `VITE_*` repo variable does NOT trigger a frontend rebuild

`deploy.yml` decides what to build from **tree-hash path detection** (`.github/scripts/compute-release.sh`
compares each top-level dir's tree object base→HEAD). Every `VITE_*` is **inlined into the bundle at
build time**, so changing a repo *variable* alters what the bundle must contain while leaving
`frontend/` byte-identical: the push-triggered run skips `build-frontend`, ArgoCD sees no new image,
and **the stale bundle stays live — silently, with a green 13-second "success"**.

Found while wiring the VAPID keypair (`mezo-7kr3`): `VITE_VAPID_PUBLIC` was set, the deploy went green,
and the deployed bundle still carried an empty key — which on a real device surfaces only as
`pushManager.subscribe()` rejecting with `InvalidAccessError`.

**The escape hatch:** `deploy.yml` has a `workflow_dispatch` with `force_frontend` / `force_backend`,
OR'd into the `version` job's outputs so every downstream condition keeps reading one pair of flags.

```bash
gh workflow run deploy.yml -r main -f force_frontend=true
```

**Use it whenever you change a `VITE_*` repo variable** (`gh variable set …`) — rotating the VAPID
keypair is the case that will recur. Verify the result rather than trusting the green check:

```bash
B=$(curl -sk https://<host>/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -sk "https://<host>$B" | grep -c '<the expected public key>'   # must print 1
```

## Out of scope (future, would each warrant its own ADR/doc)

- Multi-node cluster / real HA.
- Postgres operator (CloudNativePG) instead of a hand-rolled StatefulSet.
- Sealed Secrets / SOPS for git-committed secrets.
- Observability (Prometheus + Grafana), log aggregation. (Backups automation DONE 2026-07-05 — ADR 0009; a CloudNativePG move would supersede it.)
