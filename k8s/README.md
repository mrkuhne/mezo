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
│   ├── service.yaml           # headless Service → stable `postgres:5432` DNS
│   ├── statefulset.yaml       # Postgres 16 + its own persistent disk (PVC)
│   └── secret.example.yaml    # TEMPLATE for the DB Secret (no real secret in git)
├── backend/
│   ├── deployment.yaml        # Spring Boot, env/secrets, probes, ghcr-pull
│   ├── service.yaml           # backend:8090 (ClusterIP)
│   └── secret.example.yaml    # TEMPLATE for mezo-app (JWT + owner creds)
├── frontend/
│   ├── deployment.yaml        # nginx serving the static PWA build
│   └── service.yaml           # frontend:80 (ClusterIP)
├── cert-manager/
│   └── clusterissuer.yaml     # Let's Encrypt prod issuer (HTTP-01 via Traefik)
└── pgadmin/
    ├── configmap.yaml         # pre-seeded mezo server connection
    ├── pvc.yaml               # pgAdmin config storage
    ├── deployment.yaml        # pgAdmin 4 (private, no ingress)
    ├── service.yaml           # pgadmin:80 (ClusterIP)
    └── secret.example.yaml    # TEMPLATE for pgadmin-auth login creds
```

GitOps: ArgoCD (in the `argocd` namespace) syncs this whole `k8s/` directory from
git per `argocd/application.yaml` (repo root). After bootstrap, `git push` is the
deploy. ArgoCD excludes `**/secret.example.yaml`; real secrets live only in the cluster.

cert-manager itself is installed out-of-band (not in this repo yet):
`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml`

## Secrets are never committed

`secret.example.yaml` is a template only. The real `mezo-db` Secret is created
out-of-band so no plaintext credential lands in git:

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic mezo-db -n mezo \
  --from-literal=POSTGRES_DB=mezo \
  --from-literal=POSTGRES_USER=mezo \
  --from-literal=POSTGRES_PASSWORD='<a-strong-password>'
```

(Step 4 replaces this with **Sealed Secrets**, which encrypt the secret so it
*can* be committed safely.)

## Apply order (manual, pre-ArgoCD)

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml

# 1. namespace
kubectl apply -f k8s/namespace.yaml

# 2. secrets (out-of-band, never committed) — once
kubectl create secret generic mezo-db -n mezo \
  --from-literal=POSTGRES_DB=mezo --from-literal=POSTGRES_USER=mezo \
  --from-literal=POSTGRES_PASSWORD='<strong-pw>'
kubectl create secret generic mezo-app -n mezo \
  --from-literal=MEZO_JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=MEZO_OWNER_EMAIL=owner@mezo.local \
  --from-literal=MEZO_OWNER_PASSWORD=owner --from-literal=MEZO_OWNER_NAME=Owner
kubectl create secret docker-registry ghcr-pull -n mezo \
  --docker-server=ghcr.io --docker-username=mrkuhne --docker-password="$(gh auth token)"

# 3. workloads
kubectl apply -f k8s/postgres/service.yaml -f k8s/postgres/statefulset.yaml
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/

# 4. HTTPS: install cert-manager (once), then issuer + ingress
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl apply -f k8s/cert-manager/clusterissuer.yaml
kubectl apply -f k8s/ingress.yaml

kubectl get pods -n mezo -w        # watch everything come up
```

(`kubectl apply -f k8s/backend/` would also try to apply `secret.example.yaml` — it's a
harmless CHANGE_ME template, but prefer applying the concrete files or use Kustomize later.)
