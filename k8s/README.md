# mezo — Kubernetes manifests

Plain YAML deployed to the single-node k3s cluster. See
[`docs/infrastructure/deployment-k3s-argocd.md`](../docs/infrastructure/deployment-k3s-argocd.md)
for the full architecture and [ADR 0001](../docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md)
for the why.

Until step 4 (ArgoCD), these are applied by hand with `kubectl apply` so you can
see each piece appear. ArgoCD will later sync this directory automatically (GitOps).

## Layout

```
k8s/
├── namespace.yaml              # the `mezo` namespace
├── ingress.yaml               # Traefik Ingress: /api→backend, /→frontend, TLS via cert-manager
├── postgres/
│   ├── service.yaml            # headless Service → stable `postgres:5432` DNS
│   ├── statefulset.yaml        # Postgres 16 + its own persistent disk (PVC)
│   ├── secret.example.yaml     # TEMPLATE for the DB Secret (no real secret in git)
│   ├── sealedsecret.yaml       # mezo-db, RSA-encrypted (committed)
│   ├── exporter-deployment.yaml  # postgres_exporter (Grafana metrics)
│   ├── exporter-service.yaml     # postgres-exporter:9187 (ClusterIP)
│   ├── backup-cronjob.yaml     # nightly pg_dump -Fc → PVC
│   └── backup-pvc.yaml         # postgres-backup PVC (14-day rotation)
├── backend/
│   ├── deployment.yaml         # Spring Boot, env/secrets, probes, ghcr-pull
│   ├── service.yaml            # backend:8090 (ClusterIP)
│   ├── secret.example.yaml     # TEMPLATE for mezo-app (JWT + owner creds)
│   └── sealedsecret*.yaml      # mezo-app, ghcr-pull, RSA-encrypted (committed)
├── frontend/
│   ├── deployment.yaml         # nginx serving the static PWA build
│   └── service.yaml            # frontend:80 (ClusterIP)
├── cert-manager/
│   └── clusterissuer.yaml      # Let's Encrypt prod issuer (HTTP-01 via Traefik)
├── pgadmin/
│   ├── configmap.yaml          # pre-seeded mezo server connection
│   ├── pvc.yaml                # pgAdmin config storage
│   ├── deployment.yaml         # pgAdmin 4 (private, Tailscale ingress)
│   ├── service.yaml             # pgadmin:80 (ClusterIP)
│   ├── ingress-tailscale.yaml  # Tailscale Ingress → pgadmin.<tailnet>.ts.net
│   ├── secret.example.yaml     # TEMPLATE for pgadmin-auth login creds
│   └── sealedsecret.yaml       # pgadmin-auth, RSA-encrypted (committed)
└── monitoring/                 # mezo-ibxy — ADR 0037
    ├── namespace.yaml          # the `monitoring` namespace
    ├── values.yaml             # victoria-metrics-k8s-stack Helm values (read by argocd/monitoring-application.yaml)
    ├── sealedsecret-grafana.yaml       # grafana-admin, RSA-encrypted (committed)
    ├── sealedsecret-alertmanager.yaml  # alertmanager-config (Telegram bot token), RSA-encrypted
    ├── secret.example-grafana.yaml       # TEMPLATE for grafana-admin
    ├── secret.example-alertmanager.yaml  # TEMPLATE for the Telegram Alertmanager config
    ├── vmservicescrape-backend.yaml   # scrapes backend :8081/actuator/prometheus
    ├── vmservicescrape-postgres.yaml  # scrapes postgres-exporter
    ├── vmpodscrape-traefik.yaml       # scrapes Traefik's Prometheus port (kube-system)
    ├── vmrule-mezo.yaml               # metric alert rules (vmalert)
    ├── vmrule-logs.yaml               # LogsQL alert rules (vmalert-target: logs)
    ├── vmalert-logs.yaml              # second VMAlert instance evaluating vmrule-logs.yaml
    ├── grafana-dashboard-mezo.yaml    # bundled Grafana dashboard
    └── ingress-tailscale-grafana.yaml # Tailscale Ingress → grafana.<tailnet>.ts.net
```

GitOps: ArgoCD (in the `argocd` namespace) syncs this whole `k8s/` directory from
git per `argocd/application.yaml` (repo root). After bootstrap, `git push` is the
deploy. ArgoCD excludes `**/secret.example.yaml`; real secrets live only in the cluster.

cert-manager itself is installed out-of-band (not in this repo yet):
`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml`

## Secrets: Sealed Secrets (committed, encrypted)

Secrets live in git as **SealedSecrets** (`*/sealedsecret*.yaml`) — RSA-encrypted by
the [sealed-secrets](https://github.com/bitnami-labs/sealed-secrets) controller's
public key, so the ciphertext is safe to commit. Only the in-cluster controller can
decrypt them into real `Secret`s. ArgoCD syncs them like any other manifest.

Managed this way: `mezo-db` (DB creds), `mezo-app` (JWT + owner), `ghcr-pull`
(registry), `pgadmin-auth` (pgAdmin login). The `secret.example.yaml` files remain as
plaintext-shape documentation (ArgoCD excludes them; never put real values there).

NOT sealed (managed by their own controllers): `mezo-tls` (cert-manager),
`operator-oauth` (Tailscale operator), `argocd-initial-admin-secret` (ArgoCD).

To create or rotate a sealed secret:
```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl create secret generic mezo-db -n mezo \
  --from-literal=POSTGRES_DB=mezo --from-literal=POSTGRES_USER=mezo \
  --from-literal=POSTGRES_PASSWORD='<strong-pw>' --dry-run=client -o yaml \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system \
      --format yaml > k8s/postgres/sealedsecret.yaml
git add k8s/postgres/sealedsecret.yaml && git commit && git push   # ArgoCD applies it
```

> The sealing key is cluster-specific. If you rebuild the cluster, back up the
> controller's `sealed-secrets-key*` secret in kube-system, or re-seal from source values.

## Apply order (manual, pre-ArgoCD)

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml

# 1. namespace
kubectl apply -f k8s/namespace.yaml

# 2. secrets — now SealedSecrets in git, decrypted by the controller (install it first):
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system --set-string fullnameOverride=sealed-secrets-controller --wait
kubectl apply -f k8s/postgres/sealedsecret.yaml -f k8s/backend/sealedsecret.yaml \
  -f k8s/backend/sealedsecret-ghcr.yaml -f k8s/pgadmin/sealedsecret.yaml
# (under ArgoCD these are synced automatically — no manual step)

# 3. workloads
kubectl apply -f k8s/postgres/service.yaml -f k8s/postgres/statefulset.yaml
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/

# 4. HTTPS: install cert-manager (once), then issuer + ingress
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl apply -f k8s/cert-manager/clusterissuer.yaml
kubectl apply -f k8s/ingress.yaml

kubectl get pods -n mezo -w        # watch everything come up

# 5. observability (mezo-ibxy, ADR 0037): second ArgoCD Application, applied once by hand
kubectl apply -f k8s/monitoring/namespace.yaml -f k8s/monitoring/sealedsecret-*.yaml \
  && kubectl apply -f argocd/monitoring-application.yaml
# NOTE: two host-side files this doesn't cover — /etc/rancher/k3s/config.yaml (kubelet
# image-GC thresholds) and the Traefik HelmChartConfig at
# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml — neither is in git; re-create
# them by hand on a rebuild (see docs/infrastructure/runbook.md §Disk & image GC / §Observability).
```

(`kubectl apply -f k8s/backend/` would also try to apply `secret.example.yaml` — it's a
harmless CHANGE_ME template, but prefer applying the concrete files or use Kustomize later.)
