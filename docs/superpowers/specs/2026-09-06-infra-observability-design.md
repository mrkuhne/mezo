# Infra observability — design spec (mezo-ibxy)

- **Issue:** mezo-ibxy · **Date:** 2026-09-06 · **Round:** superpowers:brainstorming + brainstorm-recon
- **Series:** part 3 of the admin/observability platform (admin hub mezo-d5iy → RAG explorer
  mezo-4qyt → **infra observability** → feature telemetry). Independent of parts 1–2; can ship
  in any order relative to them.
- **Supersedes** the "Out of scope: Observability (Prometheus + Grafana), log aggregation" line in
  `docs/infrastructure/deployment-k3s-argocd.md`.

## Problem

The single-node k3s box is blind: no metrics registry, no log aggregation, no alerting. The
backend exposes only `/actuator/health`; logs are plain console lines readable only with
`kubectl logs`; nobody is told when a pod crash-loops, the disk fills, the nightly backup is
missed, or LLM spend spikes. Measured on 2026-09-06 (read-only `kubectl top` / kubelet stats):

| Measurement | Value |
|---|---|
| Node memory | 3.1 GiB used of 7.7 GiB allocatable (40%); backend 630 Mi, pgAdmin 235 Mi |
| Node disk (nodefs) | **58.2 of 74.8 GiB used (78%)** |
| containerd image fs | 29.1 GiB used, while the node lists only 50 images / 9.8 GiB — orphaned layers from 170+ release tags |
| PVCs | 7 Gi claimed (postgres 5, pgadmin 1, backup 1), all `local-path` on the same disk |

Memory has room for a ~1.3 GiB stack. **Disk does not**: kubelet starts evicting at 85% and the
chart defaults would add 40 Gi of PVCs. Disk cleanup + image GC is therefore slice 0.

## Product decisions (Daniel, 2026-09-06)

1. **Scope A + C:** operational visibility (pods, node, Postgres, HTTP, cron jobs, logs) plus
   alerting. Application-level Micrometer instrumentation (per-feature LLM histograms, cron
   "last run" gauges) is a later thin slice; Spring AI's default GenAI metrics come for free.
2. **Alert channel:** Telegram bot.
3. **Install — approach A:** a second ArgoCD `Application` with a Helm source (multi-source,
   values file in this repo), `ServerSideApply=true`, `CreateNamespace=true`. Rejected B (hand
   `helm install`, like sealed-secrets/Tailscale were done): not reproducible from git, and
   observability is what you want back first after a rebuild. Rejected C (helm-rendered YAML
   under `k8s/`): CRD sync ordering is unmanaged and every chart bump is a 30k-line diff.
4. **Backend exposure — approach A:** separate `management.server.port` (8081), cluster-internal
   only, no JWT on that port; the 8090 security chain is untouched. Rejected B (permitAll
   `/actuator/prometheus` on 8090): puts metrics in the public path space.
5. **Alerting — approach A:** the chart's bundled `vmalert` + Alertmanager with the native
   Telegram receiver (~50 Mi, can alert on logs via LogsQL). Rejected Grafana unified alerting
   (state in Grafana's SQLite, no log alerts).
6. **Disk cleanup, image GC and small PVCs are mandatory**, not optional hardening.

## Architecture

```
argocd/monitoring-application.yaml        (applied by hand, like argocd/application.yaml)
   sources:
     - repoURL: https://victoriametrics.github.io/helm-charts/
       chart: victoria-metrics-k8s-stack   targetRevision: <pinned>
       helm.valueFiles: ['$values/k8s/monitoring/values.yaml']
     - repoURL: <mezo repo>  targetRevision: main  ref: values
   destination.namespace: monitoring
   syncPolicy: automated {prune, selfHeal}; syncOptions: [CreateNamespace=true, ServerSideApply=true]
   ignoreDifferences: operator webhook caBundle + cert secrets (per chart docs)

k8s/monitoring/                            (synced by the EXISTING mezo Application, recurse: true;
                                            every file states namespace: monitoring explicitly)
   namespace.yaml                          Namespace monitoring (precedent k8s/namespace.yaml)
   values.yaml                             chart values (read by the Helm app above)
   sealedsecret-grafana.yaml               Grafana admin password
   sealedsecret-alertmanager.yaml          Telegram bot token
   sealedsecret-pg-exporter.yaml           postgres_exporter DSN parts
   ingress-tailscale-grafana.yaml          grafana.<tailnet>.ts.net — pgadmin pattern verbatim
   vmservicescrape-backend.yaml            backend Service port `management`, /actuator/prometheus, 30s
   vmservicescrape-traefik.yaml            Traefik metrics port
   postgres-exporter.yaml                  Deployment + Service (quay.io/prometheuscommunity/postgres-exporter, :9187)
   vmrule-mezo.yaml                        alert rules (below)
   grafana-dashboard-mezo.yaml             ConfigMap with the custom "mezo" dashboard (sidecar-loaded)
```

The mezo Application syncs `k8s/monitoring/*` plain objects (namespace, secrets, scrapes, rules,
ingress); the monitoring Application owns the chart. Order of first apply: `k8s/monitoring/
namespace.yaml` + secrets land via the mezo app; then the monitoring app is applied by hand.
Secret `secret.example.yaml` templates sit beside each SealedSecret (excluded by the existing
glob).

### Chart values (budget from the live numbers)

```yaml
fullnameOverride: vm
argocdReleaseOverride: $ARGOCD_APP_NAME
vmsingle:  {enabled: true, spec: {retentionPeriod: 30d, storage: {resources: {requests: {storage: 5Gi}}},
            resources: {requests: {memory: 256Mi}, limits: {memory: 768Mi}}}}
vmagent:   {enabled: true, spec: {scrapeInterval: 30s, resources: {requests: {memory: 128Mi}, limits: {memory: 384Mi}}}}
vlsingle:  {enabled: true, spec: {retentionPeriod: 14d, storage: {resources: {requests: {storage: 5Gi}}},
            resources: {requests: {memory: 256Mi}, limits: {memory: 512Mi}}}}
vlagent:   {enabled: true, spec: {k8sCollector: {enabled: true}}}
vmalert:   {enabled: true}
alertmanager: {enabled: true, spec: {configSecret: alertmanager-config}}   # Telegram receiver, sealed
grafana:   {enabled: true, plugins: [victoriametrics-logs-datasource], persistence: {enabled: true, size: 1Gi},
            admin: {existingSecret: grafana-admin}, resources: {requests: {memory: 128Mi}, limits: {memory: 256Mi}},
            defaultDashboards: {annotations: {argocd.argoproj.io/sync-options: ServerSideApply=true}}}
kube-state-metrics: {enabled: true}
prometheus-node-exporter: {enabled: true}
kubeEtcd: {enabled: false}; kubeScheduler: {enabled: false}; kubeControllerManager: {enabled: false}
```

Totals: memory limits ≈ 1.3 GiB (+ operator ~150 Mi), PVCs +11 Gi (5 + 5 + 1). Every pod
declares requests + memory limits, never CPU limits, like every existing workload.

### Host-side settings (not GitOps; documented in the runbook)

- **Slice 0 cleanup** over SSH: `crictl rmi --prune`; inspect `ctr -n k8s.io` leftover content/
  snapshots; cap journald at `SystemMaxUse=500M`. Target: at least 20 GiB free.
- **Permanent GC** in `/etc/rancher/k3s/config.yaml`: `kubelet-arg: [image-gc-high-threshold=70,
  image-gc-low-threshold=60, eviction-hard=nodefs.available<10%]`, then `systemctl restart k3s`.
- **Traefik metrics**: `HelmChartConfig` in `/var/lib/rancher/k3s/server/manifests/traefik-config.yaml`
  enabling `metrics.prometheus` on port 9100 (never edit `traefik.yaml`; it is re-applied).
- **GHCR retention** (separate issue): the 170+ release tags stay in the registry; a retention
  workflow beside `deploy.yml`.

## Backend changes

- `pom.xml`: `io.micrometer:micrometer-registry-prometheus` (version from the Boot 4.0 BOM; the
  `-simpleclient` bridge is gone in Boot 4).
- `application.yml`:
  `management.server.port: ${MEZO_MANAGEMENT_PORT:8081}`,
  `management.endpoints.web.exposure.include: health,prometheus`,
  `management.metrics.tags.application: mezo-backend`,
  `logging.structured.format.console: ecs` (VictoriaLogs reads `message`/`log.level`/`service.name`).
- `SecurityConfig`: unchanged for 8090. The management port runs its own embedded server; a
  port-scoped matcher permits `/actuator/**` **only on the management port**. Recorded in the
  allowlist paragraph of `docs/features/_platform-auth-security.md`.
- `k8s/backend/deployment.yaml`: second `containerPort: 8081, name: management`, env
  `MEZO_MANAGEMENT_PORT=8081`, all three probes moved to `:8081/actuator/health`. `service.yaml`:
  second port `management`. These two files are rewritten by the release bot's `sed` on the
  `image:` line — rebase before merging, never touch or duplicate that line.
- `Dockerfile`: `-XX:MaxRAMPercentage=60` so the 1 Gi limit yields ~600 Mi heap instead of the
  ergonomic ~256 Mi; the live 630 Mi RSS shows the JVM lives off metaspace + native today, which
  the JVM dashboard will make visible.
- Spring AI observations are on once Micrometer is active: `gen_ai_client_token_usage_total`
  and `gen_ai_client_operation_seconds` by model (no feature label, no user label). Prompt/
  completion logging stays off.
- Frontend: nginx keeps `combined` access logs on stdout (collected by vlagent); no exporter —
  Traefik router metrics cover the HTTP side.

## Dashboards and alerts

Grafana: chart-shipped kube-prometheus dashboards (node, pods, namespace) + JVM Micrometer
(4701) + PostgreSQL exporter (9628) + Traefik (17346) + one custom **mezo** dashboard: backend
RPS / error rate / latency by route, JVM heap, DB connections, LLM tokens by model, log error
count, backup CronJob last success, disk free.

`VMRule` → Alertmanager → Telegram (`group_by: [alertname]`, `group_wait 30s`, `group_interval
5m`, `repeat_interval 4h`, `send_resolved: true`). Chart default rule groups for etcd/scheduler/
controller-manager disabled (dead targets on k3s).

| Alert | Condition |
|---|---|
| BackendDown | backend scrape target down for 3 min |
| PodCrashLooping | restarts > 3 in 15 min (any namespace) |
| NodeDiskPressure | nodefs available < 15% |
| NodeMemoryHigh | > 90% for 10 min |
| PostgresDown / PgConnectionsHigh | exporter unreachable / connections > 80% of `max_connections` |
| BackupMissed | last successful `postgres-backup` Job older than 26 h (`kube_job_status_succeeded`) |
| HttpErrorRate | Traefik 5xx > 5% for 5 min |
| LogErrorBurst | LogsQL `log.level:ERROR` > 20 in 5 min (vmalert on VictoriaLogs) |
| LlmTokenSpike | daily `gen_ai_client_token_usage_total` increase > 3× the 7-day average |

## Error handling / failure modes

- Chart sync failure (CRD size) → `ServerSideApply=true` from the first apply; never `Replace`.
- Monitoring app down does not affect the app: scrapes are pull-based, vlagent is a DaemonSet
  reading container logs; nothing in `mezo` depends on `monitoring`.
- Telegram unreachable → Alertmanager retries; alerts also visible in Grafana's Alertmanager
  view over Tailscale.
- Disk: NodeDiskPressure alert + kubelet GC thresholds are the two guards; PVC sizes are hard
  caps, VictoriaMetrics/Logs enforce retention by time.
- Management port unreachable → probes fail → pod restarts: the probe move is deliberate so a
  broken management server is treated as an unhealthy pod, not a silent metrics gap.

## Testing

- Backend IT: `GET :8081/actuator/prometheus` without a token → 200 and contains
  `jvm_memory_used_bytes`; `GET :8090/actuator/prometheus` → 401; existing health probe test still
  passes on 8081; log-asserting tests stay green under ECS formatting.
- ArchUnit via plain `./mvnw test`; codemap regeneration if a techcore class is added.
- CI: `kubeconform` over `k8s/**/*.yaml` (skipping CRD kinds it does not know, with the VM CRD
  schemas fetched or `-ignore-missing-schemas`), and `helm template … -f k8s/monitoring/values.yaml
  | kubeconform` for the chart. First manifest gate in this repo (none exists today).
- Manual acceptance (runbook): ArgoCD both apps Healthy/Synced; `kubectl top` after 24 h within
  budget; Grafana reachable on the tailnet; one test alert delivered to Telegram (`amtool` or a
  deliberately failing rule); disk free ≥ 20 GiB after slice 0.

## Slices

0. **Disk** — one-off cleanup, kubelet GC thresholds, journald cap, runbook section, disk numbers
   recorded; GHCR retention issue filed.
1. **Backend** — Prometheus registry, management port, ECS logs, JVM flag, security matcher,
   deployment/service ports + probes, IT, security doc paragraph.
2. **Stack** — `k8s/monitoring/namespace.yaml`, values, SealedSecrets, Grafana Tailscale ingress,
   `argocd/monitoring-application.yaml`, Traefik `HelmChartConfig`; kubeconform CI gate.
3. **Scrapes** — backend + Traefik `VMServiceScrape`, postgres_exporter (+ `pg_monitor` grant via
   Liquibase or a one-off, decided in the plan), verify kube-state/node-exporter targets.
4. **Dashboards + alerts** — imported dashboards, custom mezo dashboard ConfigMap, `VMRule`,
   Alertmanager Telegram config, test alert.
5. **Docs** — ADR "observability stack", update `deployment-k3s-argocd.md` (out-of-scope line,
   topology, layout, CX32→CX33 and pgAdmin-ingress staleness), runbook §observability + host
   settings, `k8s/README.md` apply order.

## Follow-ups

- App-level Micrometer: per-feature LLM token histograms (OTel GenAI attrs: feature, model,
  token type — never user), cron job duration/last-run gauges, retrieval timers per retriever.
- MDC trace id across request → LLM log → retrieval run (today: two unrelated random UUIDs).
- GHCR tag retention workflow.
- Postgres `pg_stat_statements` + `sql_exporter` for HNSW index sizes if pgvector insight is wanted.

## Prior art

Researcher report (2026-09-06), filtered:

- **Adopted — `victoria-metrics-k8s-stack` single-node values** (vmsingle + vmagent + Grafana,
  optional vlsingle/vlagent in the same release, kube-control-plane scrapes disabled on k3s,
  `VMServiceScrape` as the ServiceMonitor drop-in). Retention/PVC defaults (1 month / 20Gi) cut
  to 30d/5Gi and 14d/5Gi for this disk. https://docs.victoriametrics.com/helm/victoria-metrics-k8s-stack/ ,
  https://docs.victoriametrics.com/operator/resources/vmservicescrape/
- **Adopted — ArgoCD multi-source Helm app** with `$values` ref, `ServerSideApply=true`
  (CRDs/dashboards exceed the 262144-byte annotation), `argocdReleaseOverride`, `ignoreDifferences`
  for webhook caBundle. https://argo-cd.readthedocs.io/en/stable/user-guide/helm/
- **Adopted — Boot 4 exposure:** `micrometer-registry-prometheus`, `management.server.port`,
  `logging.structured.format.console=ecs`, Spring AI observations on by default → `gen_ai_client_*`
  metric names. https://docs.spring.io/spring-boot/reference/actuator/metrics.html ,
  https://docs.spring.io/spring-ai/reference/observability/index.html
- **Adopted — postgres_exporter** with `pg_monitor`; no pgvector-specific metrics exist
  (follow-up via `sql_exporter`). k3s Traefik metrics via `HelmChartConfig`.
  https://github.com/prometheus-community/postgres_exporter , https://docs.k3s.io/networking/networking-services
- **Adopted — Alertmanager native `telegram_configs`** over Grafana alerting or an ntfy bridge.
  https://prometheus.io/docs/alerting/latest/configuration/
- **Rejected —** kube-prometheus-stack (1.5–3 GB), Loki + Alloy (fallback only), self-hosted
  Langfuse.

## Codebase terrain

Investigator report (2026-09-06) + live measurements, filtered:

- **ArgoCD:** one `Application` (`argocd/application.yaml`): `path k8s`, `recurse: true`,
  `exclude "**/secret.example.yaml"` (single glob string), `destination.namespace: mezo`,
  automated prune + selfHeal, **no syncOptions**. Namespaced objects without `metadata.namespace`
  land in `mezo` → every monitoring file states its namespace; `Namespace` object in-tree
  (precedent `k8s/namespace.yaml`); cluster-scoped objects already sync fine (`ClusterIssuer`).
- **Tailscale ingress pattern** (`k8s/pgadmin/ingress-tailscale.yaml`): `ingressClassName:
  tailscale`, `defaultBackend` only, hostname = the single `tls.hosts` label; upstream must be
  plain HTTP. Operator installed by hand via Helm; proxies mint only under `tag:k8s-operator`.
- **Secrets:** SealedSecret + `secret.example.yaml` beside it; `kubeseal --controller-name
  sealed-secrets-controller --controller-namespace kube-system`; sealing key is cluster-bound.
  `mezo-db` keys are `POSTGRES_DB/USER/PASSWORD` (no URL) → exporter DSN composed from env.
- **Backend today:** Boot 4.0.0, Java 21, Spring AI 2.0.0, `spring-boot-starter-actuator` present;
  no Prometheus registry, no tracing, no structured logging, no `logback-spring.xml`; `management`
  block is `exposure.include: health` only; `SecurityConfig` permits only login/register/health;
  Dockerfile has no JVM flags; deployment has one `containerPort 8090`, probes on `/actuator/health`,
  512Mi/1Gi memory, env-per-property style (`MEZO_*`), `TZ=Europe/Budapest`. `MeterRegistry`/
  `MDC`/`@Timed` → 0 hits. 33 `@Scheduled` methods on a 4-thread pool (scrape work must not use it).
- **trace ids:** `memory_retrieval_run.trace_id` and `GlobalExceptionHandler`'s `[traceId=…]` are
  two unrelated random UUIDs; `llm_log_history` has no trace column.
- **CI/release:** no manifest linting anywhere; `release-commit.sh` rewrites only the `image:` line
  of the two deployments (retry-on-reject); a `k8s/`-only push builds nothing and ArgoCD syncs it
  within ~3 min (ADR 0007 fix-forward, deploys never wait for `ci.yml`).
- **Precedents:** `k8s/postgres/backup-cronjob.yaml` (CronJob shape, `secretKeyRef` env,
  resources), `k8s/cert-manager/clusterissuer.yaml` (cluster-scoped in-tree), `k8s/README.md`
  apply order, ADR shape `docs/decisions/0009-*.md`.
- **Traps:** prune+selfHeal reverts manual `kubectl apply` under `k8s/`; `Replace=true` overrides
  SSA — never combine; frontend has 2 replicas (no sidecars); public repo (ADR 0011) — no new
  tailnet hostnames/IPs beyond what docs already print; test profile disables every cron switch
  (metrics beans must tolerate absent job beans).
- **Staleness to fix in slice 5:** pgAdmin "no Ingress" comments (`k8s/pgadmin/*.yaml`, README,
  deployment doc), CX32 vs CX33, images `:0.0.1` in docs, "Sealed Secrets out of scope" while done,
  the "Tests are intentionally NOT run in CI" sentence (true for deploy.yml only), repository
  layout listings missing `cert-manager/`, `backup-*`, `ingress-tailscale`, `sealedsecret*`.
