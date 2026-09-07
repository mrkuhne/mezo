# 0037 — Observability: VictoriaMetrics k8s-stack + VictoriaLogs + Grafana, Telegram alerts

- **Status:** Accepted
- **Date:** 2026-09-06
- **Driver:** mezo-ibxy (the k3s box was blind: no metrics, no log search, no alerting)
- **Spec:** docs/superpowers/specs/2026-09-06-infra-observability-design.md

## Context

One 8 GB node runs the whole product. Measured 2026-09-06: 3.1 GiB memory used, disk 78 %
full (29 GiB of orphaned image layers). Options: kube-prometheus-stack (1.5–3 GB), Loki + Alloy
for logs (~0.7 GB, slower queries), VictoriaMetrics k8s-stack with VictoriaLogs (~1.3 GB, one
Helm release, one Grafana), or hosted SaaS.

## Decision

1. `victoria-metrics-k8s-stack` 0.91.2 with vlsingle/vlagent enabled, installed by a **second
   ArgoCD Application** (multi-source Helm, values in `k8s/monitoring/values.yaml`,
   `ServerSideApply`), namespace `monitoring`. Plain objects (scrapes, rules, dashboard,
   Tailscale ingress, SealedSecrets) stay under `k8s/monitoring/` in the existing mezo app.
2. Backend metrics on a **separate management port** (8081), cluster-internal, no JWT;
   ECS JSON logs; `-XX:MaxRAMPercentage=60`.
3. Alerting through the chart's vmalert + Alertmanager with the **native Telegram receiver**;
   a second vmalert evaluates LogsQL rules against VictoriaLogs.
4. **Disk first:** kubelet image-GC thresholds 70/60 %, journald cap, PVCs 5 + 5 + 1 Gi,
   retention 30 d metrics / 14 d logs.

## Consequences

- Grafana at `grafana.tail8ce56d.ts.net` (never public). Runbook §4 *Observability*.
- Host-side files (`/etc/rancher/k3s/config.yaml`, Traefik `HelmChartConfig`) are not in git —
  the runbook lists them for a rebuild.
- `argocdReleaseOverride` in `k8s/monitoring/values.yaml` is hardcoded to the literal `vm`
  rather than the chart's suggested `$ARGOCD_APP_NAME`: that substitution only applies inside
  `helm.parameters[].value`, not a `valueFiles` entry (verified against ArgoCD v3.4.3 — the
  literal placeholder string landed in generated labels and failed apiserver validation).
- **Alert delivery is pending**: `alertmanager-config` currently seals a `blackhole` receiver
  as a placeholder. Wiring the real Telegram receiver (fill `bot_token`/`chat_id` from
  `k8s/monitoring/secret.example-alertmanager.yaml`, `kubeseal` over
  `sealedsecret-alertmanager.yaml`, commit) is tracked separately — see runbook §4
  *Observability*, "rotate/enable the Telegram token".
- Rejected: self-hosted Langfuse (six services), Grafana unified alerting (no log alerts),
  hand-run `helm install` (not reproducible), helm-rendered YAML in `k8s/` (CRD ordering).
- Follow-ups: per-feature LLM histograms + cron gauges (Micrometer), MDC trace id, GHCR tag
  retention, `sql_exporter` for pgvector index sizes.
