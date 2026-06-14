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
| **postgres** | `StatefulSet` + `PVC` + `Secret` | Postgres 16. `local-path` PVC for data. Credentials in a `Secret`. Not exposed outside the cluster. |
| **pgAdmin** | `Deployment` + `Service` | DB GUI. **No Ingress** — reach via `kubectl port-forward` or Tailscale only. |
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
| Owner login | `owner@mezo.local` / `owner` (demodata seed; baked into the frontend build) |
| Secrets (NOT in git) | `mezo-db` (DB creds), `mezo-app` (JWT + owner), `ghcr-pull` (registry), `mezo-tls` (cert, cert-manager-managed) |

Local admin access:
- `kubectl` from the Mac: `export KUBECONFIG=~/.kube/mezo-k3s.yaml` (context `mezo`, server `https://100.75.51.113:6443` over Tailscale).
- SSH: `ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113` (or the public IP).

Build/push images (arm64 Mac → amd64 server):
```bash
# backend
cd backend && ./mvnw -B clean package -DskipTests
docker buildx build --platform linux/amd64 -t ghcr.io/mrkuhne/mezo-backend:<tag> backend --push
# frontend
cd frontend && VITE_USE_MOCK=false VITE_API_URL= VITE_OWNER_EMAIL=owner@mezo.local VITE_OWNER_PASSWORD=owner pnpm build
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

A `git push` to `main` now builds, tests, tags, and rolls out the changed component automatically —
no manual `docker buildx` / tag bookkeeping. The build half lives in
**`.github/workflows/deploy.yml`** (GitHub Actions); the deploy half is the **unchanged** ArgoCD
auto-sync on `k8s/`. See [ADR 0002](../decisions/0002-ci-cd-github-actions-auto-deploy.md) for the
*why* and [`docs/superpowers/plans/2026-06-14-ci-cd-auto-deploy.md`](../superpowers/plans/2026-06-14-ci-cd-auto-deploy.md)
for the build-out steps.

**Flow** — four jobs, fired on push to `main`:

1. **`version`** — runs `.github/scripts/compute-release.sh`: computes the next semver from the
   conventional commits since the last `v*` tag (`feat` → minor, `feat!` / `BREAKING CHANGE:` →
   major, else patch) and derives `frontend_changed` / `backend_changed` from a path-filtered
   `git diff` (`frontend/**` → FE; `backend/**` or `api/**` → BE).
2. **`build-frontend`** (only if FE changed) — `pnpm test` in real (MSW) **and** mock modes →
   `pnpm build` (owner creds baked in) → docker build/push `ghcr.io/mrkuhne/mezo-frontend:<ver>`.
3. **`build-backend`** (only if BE changed) — `./mvnw -B clean verify` against a throwaway
   Testcontainers Postgres → docker build/push `ghcr.io/mrkuhne/mezo-backend:<ver>`.
4. **`release`** (if nothing failed and ≥1 component shipped) — `sed`-rewrites the changed
   `k8s/<comp>/deployment.yaml` image tag to `<ver>`, commits it back as
   `chore(release): v<ver> [skip ci]`, `git pull --rebase origin main` (non-fast-forward guard),
   tags `v<ver>`, and pushes. **ArgoCD then syncs that commit and deploys it.**

**Loop guard:** the release commit carries `[skip ci]`, and the `version` job is gated
`if: !contains(head_commit.message, '[skip ci]')`, so the release commit does not re-trigger the
workflow.

**Workflow permissions:** `contents: write` (commit + tag back) and `packages: write` (push to
GHCR), both via the built-in `GITHUB_TOKEN`. The cluster still pulls private images with the
existing `ghcr-pull` secret (unchanged).

**One-time bootstrap (manual, already done):**
- Seed a baseline `v0.0.1` git tag — the semver math needs a starting point.
- Repo **Settings → Actions → Workflow permissions → "Read and write permissions"** (so the
  commit-back + tag push are allowed).
- Repo **Variables** `VITE_OWNER_EMAIL` / `VITE_OWNER_PASSWORD` — the demo-owner creds baked into
  the frontend build (demo values, not real secrets).

**Caveat:** if `main` ever gains PR-required branch protection, the default `GITHUB_TOKEN`
commit-back push is rejected — it would then need a PAT / GitHub App token or a protection bypass.

## Out of scope (future, would each warrant its own ADR/doc)

- Multi-node cluster / real HA.
- Postgres operator (CloudNativePG) instead of a hand-rolled StatefulSet.
- Sealed Secrets / SOPS for git-committed secrets.
- Observability (Prometheus + Grafana), backups automation, log aggregation.
