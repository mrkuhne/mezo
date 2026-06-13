# Deployment architecture — single-VPS k3s + ArgoCD + pgAdmin

**Status:** Target architecture (not yet built) · **Driver:** mezo-ht3 · **Decision:** [ADR 0001](../decisions/0001-deploy-on-k3s-argocd-learning-track.md)

This is where and how mezo is meant to run in production-for-learning. The primary goal is to
practice the **client stack (Kubernetes + ArgoCD + pgAdmin)** while hosting the app. See ADR 0001
for *why* this path over a managed/Coolify deploy.

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

## Out of scope (future, would each warrant its own ADR/doc)

- Multi-node cluster / real HA.
- Postgres operator (CloudNativePG) instead of a hand-rolled StatefulSet.
- Sealed Secrets / SOPS for git-committed secrets.
- Observability (Prometheus + Grafana), backups automation, log aggregation.
