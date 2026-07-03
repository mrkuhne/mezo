# mezo — Infrastructure Runbook

Operational reference for the live mezo deployment: what runs where, how to reach it,
how to log in, day-to-day operations, troubleshooting, and recovery.

- **Why this design:** [ADR 0001](../decisions/0001-deploy-on-k3s-argocd-learning-track.md)
- **Architecture details & current facts:** [deployment-k3s-argocd.md](deployment-k3s-argocd.md)
- **Manifests:** [`k8s/`](../../k8s/) · **GitOps app:** [`argocd/application.yaml`](../../argocd/application.yaml)

> **No secret values are stored in this doc.** Where a password is needed, the
> retrieval command is given. Real secrets live only in the cluster (as Sealed
> Secrets in git, decrypted by the controller).

---

## 1. What is running

One Hetzner VPS (CX33, 8 GB, x86, Ubuntu 26.04, Nuremberg, public IP `46.225.112.172`)
running **k3s** `v1.35.5+k3s1` (single node, control-plane + workload). k3s bundles
**Traefik** (ingress) and **local-path** (storage).

| Namespace | What | Notes |
|---|---|---|
| `mezo` | the app: `postgres` (StatefulSet, image `pgvector/pgvector:pg16` since 2026-07-03 — companion V2.1), `backend` (Deployment), `frontend` (Deployment), `pgadmin` (Deployment) | the product |
| `kube-system` | k3s core (Traefik, CoreDNS, metrics-server, local-path) + **sealed-secrets controller** | platform |
| `cert-manager` | cert-manager (Let's Encrypt certs) | public HTTPS |
| `argocd` | ArgoCD (GitOps controller + UI) | deploys `k8s/` from git |
| `tailscale` | Tailscale operator + per-service proxy pods | private admin access |

**Images** (private, on GitHub Container Registry, pulled with the `ghcr-pull` secret):
`ghcr.io/mrkuhne/mezo-backend:0.0.1`, `ghcr.io/mrkuhne/mezo-frontend:0.0.1`.

---

## 2. How it works (request flows)

**Public app** — `https://46.225.112.172.sslip.io/`
```
browser ─DNS(sslip.io→46.225.112.172)→ :443 ─→ Traefik ─Ingress "mezo"→
    /        → frontend Service :80  (nginx serving the static PWA)
    /api/*   → backend  Service :8090 (Spring Boot) ─→ postgres Service :5432
TLS: Let's Encrypt cert in Secret "mezo-tls", issued/renewed by cert-manager (HTTP-01).
```
Same host for FE and API → same browser origin → no CORS. The frontend was built with
`VITE_API_URL=""`, so it calls `/api/*` relatively (domain not baked in).

**Private admin** — `https://pgadmin.tail8ce56d.ts.net`, `https://argocd.tail8ce56d.ts.net`
```
browser (on tailnet) ─MagicDNS→ Tailscale (WireGuard, encrypted) ─→
    operator proxy pod (ns tailscale) ─→ pgadmin Service :80  /  argocd-server Service :80
TLS: real *.ts.net cert provisioned by the Tailscale operator.
```
Never exposed to the public internet — only reachable from your Tailscale devices.
`argocd-server` runs `--insecure` so the Tailscale proxy terminates TLS (no redirect loop).

**GitOps deploy**
```
edit k8s/ in git → git push → ArgoCD (auto-sync: prune + selfHeal) → cluster
```

---

## 3. Access & logins

### URLs

| What | URL | Reachability |
|---|---|---|
| mezo app | https://46.225.112.172.sslip.io/ | public |
| pgAdmin | https://pgadmin.tail8ce56d.ts.net | tailnet only |
| ArgoCD | https://argocd.tail8ce56d.ts.net | tailnet only |

To use the tailnet URLs from a new device: install Tailscale, log in as `dkmusicscore@gmail.com`.

### Logins (usernames here; fetch passwords with the commands below)

| Service | Username | Password — fetch with |
|---|---|---|
| mezo app | `owner@mezo.local` | `owner` (auto-login; baked into the frontend build, not a real secret) |
| pgAdmin UI | `dkmusicscore@gmail.com` | `kubectl get secret pgadmin-auth -n mezo -o jsonpath='{.data.PGADMIN_DEFAULT_PASSWORD}' \| base64 -d` |
| pgAdmin → DB server "mezo (k8s)" | `mezo` | `kubectl get secret mezo-db -n mezo -o jsonpath='{.data.POSTGRES_PASSWORD}' \| base64 -d` |
| ArgoCD UI | `admin` | `kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' \| base64 -d` |

(Always `export KUBECONFIG=~/.kube/mezo-k3s.yaml` first.)

### Shell / cluster access

```bash
# kubectl (over Tailscale, context "mezo")
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl get pods -A

# SSH to the server (dedicated key; deploy user has passwordless sudo)
ssh -i ~/.ssh/id_mezo_hetzner deploy@100.75.51.113     # tailnet IP
ssh -i ~/.ssh/id_mezo_hetzner deploy@46.225.112.172    # public IP
```

### Tailnet devices

| Device | Tailscale IP | Role |
|---|---|---|
| `mezo-k3s` | `100.75.51.113` | the server (k8s API on :6443) |
| `gbsn0180` | `100.68.26.113` | admin Mac |
| `pgadmin` / `argocd` | (operator-assigned) | the admin-UI proxies |

---

## 4. Common operations

### Check status / logs
```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl get pods -n mezo
kubectl logs -n mezo deploy/backend --tail=50
kubectl logs -n mezo deploy/backend -f          # follow
kubectl describe pod -n mezo <pod>              # why a pod is unhealthy
kubectl top pods -n mezo                        # CPU/RAM
```
Or open the ArgoCD UI for a live topology + health view.

### Deploy a manifest change (the normal path)
Edit a file under `k8s/`, then:
```bash
git add k8s/... && git commit -m "..." && git push
# ArgoCD picks it up automatically (within ~3 min, or refresh in the UI for instant)
```
Do **not** `kubectl apply` for things under `k8s/` — ArgoCD owns them (selfHeal reverts drift).

### Ship a new image version
```bash
# backend
cd backend && ./mvnw -B clean package -DskipTests
docker buildx build --platform linux/amd64 -t ghcr.io/mrkuhne/mezo-backend:0.0.2 backend --push
# frontend
cd frontend && VITE_USE_MOCK=false VITE_API_URL= VITE_OWNER_EMAIL=owner@mezo.local VITE_OWNER_PASSWORD=owner pnpm build
docker buildx build --platform linux/amd64 -t ghcr.io/mrkuhne/mezo-frontend:0.0.2 frontend --push
# then bump the image tag in k8s/backend/deployment.yaml (or frontend) and:
git commit -am "deploy backend 0.0.2" && git push     # ArgoCD rolls it out
```
GHCR login if needed: `gh auth token | docker login ghcr.io -u mrkuhne --password-stdin`.
Always build `--platform linux/amd64` (Mac is arm64, the server is amd64).

### Scale a service
Edit `replicas` in `k8s/<svc>/deployment.yaml`, commit, push.

### Restart a workload
```bash
kubectl rollout restart deployment/backend -n mezo
```

### Add or rotate a secret (Sealed Secrets)
See [k8s/README.md](../../k8s/README.md) → "Secrets". In short: `kubectl create secret ...
--dry-run=client -o yaml | kubeseal ... > k8s/.../sealedsecret.yaml`, commit, push.

### Inspect the database
Open pgAdmin (URL above) → server "mezo (k8s)" → Databases → mezo → Schemas → public → Tables.
Or directly: `kubectl exec -n mezo postgres-0 -it -- psql -U mezo -d mezo`.

---

## 5. Troubleshooting

| Symptom | Check |
|---|---|
| App 5xx / down | `kubectl get pods -n mezo`; `kubectl logs -n mezo deploy/backend` |
| Pod `CrashLoopBackOff` | `kubectl logs` + `kubectl describe pod` (look at events + last log lines) |
| Pod `ImagePullBackOff` | `ghcr-pull` secret valid? GHCR token expired? re-seal/rotate |
| Public HTTPS cert problems | `kubectl get certificate -n mezo`; `kubectl logs -n cert-manager deploy/cert-manager` |
| Can't reach `*.ts.net` admin URLs | Tailscale running on your device? `kubectl get pods -n tailscale`; `kubectl logs -n tailscale deploy/operator` |
| ArgoCD shows OutOfSync/Degraded | open ArgoCD UI; `kubectl get application mezo -n argocd -o yaml`; hard-refresh |
| Sealed secret not applying | `kubectl get sealedsecret -n mezo` (STATUS column); controller logs in kube-system |
| DB connection errors from backend | `SPRING_DATASOURCE_URL` points to `postgres:5432`; `kubectl exec postgres-0 -- pg_isready` |

---

## 6. Backups & disaster recovery

**Recoverable from git** (`k8s/` + `argocd/`): all manifests and the *encrypted* secrets.
A fresh cluster can be rebuilt by re-bootstrapping ArgoCD pointed at this repo.

**NOT in git — must be backed up / re-createable:**
- **Postgres data** — lives only on the node's local-path PVC. ⚠️ **No automated backup yet** —
  this is the biggest gap (bd `mezo-osj`). Until addressed, take manual dumps:
  `kubectl exec -n mezo postgres-0 -- pg_dump -U mezo mezo > mezo-$(date +%F).sql`
  (last manual dump: 2026-07-03, `~/MrKuhne/mezo-live-backups/` on the admin Mac, taken before
  the pgvector image swap).

**Postgres image-swap note (2026-07-03, companion V2.1):** the StatefulSet image moved
`postgres:16` → `pgvector/pgvector:pg16` (same PG16 major — the PVC data is reused as-is; only
the extension binaries are new). The pgvector image's glibc is older than the previous image's,
so Postgres warned about a **collation version mismatch**; fixed once with
`ALTER DATABASE mezo REFRESH COLLATION VERSION;` + `REINDEX DATABASE mezo;` (and the same
`REFRESH` on `postgres`/`template1`). Repeat those two commands if the image lineage ever
changes again and the warning reappears.
- **Sealed-secrets sealing key** — `kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml`.
  Back this up, or old SealedSecrets become undecryptable after a cluster rebuild.
- **Tailscale OAuth client** — revocable/re-creatable in the Tailscale admin console.
- **GHCR images** — rebuildable from source.

**Rebuild outline:** new VPS → harden + Tailscale (step 0) → k3s (step 1) → install
sealed-secrets controller + restore its key → cert-manager + ArgoCD + Tailscale operator
→ apply `argocd/application.yaml` → ArgoCD reconciles everything → restore Postgres dump.

---

## 7. Costs

| Item | Cost |
|---|---|
| Hetzner CX33 VPS | ~EUR 8.46 / month |
| k3s, ArgoCD, cert-manager, sealed-secrets, Tailscale (≤100 devices), GHCR | free |
| Domain | none (using sslip.io + *.ts.net) |
