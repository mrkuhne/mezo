# 0009 — Postgres backups: in-cluster pg_dump CronJob + admin-Mac offsite pull

- **Status:** Accepted
- **Date:** 2026-07-05
- **Driver:** mezo-osj (the k3s deploy had NO automated DB backup)

## Context

The live mezo database (Hetzner k3s, single node) stores real daily data (meals, weight,
medication doses, chat memory) on a `local-path` PVC — i.e. a directory on the one node's SSD.
Until now the only safety net was an occasional manual `pg_dump` to the admin Mac. A node loss
would have destroyed everything since the last manual dump. Options considered:

1. **In-cluster CronJob → PVC + daily Mac pull over Tailscale** — zero new accounts/cost; the
   Mac pull continues the already-established manual practice (`~/MrKuhne/mezo-live-backups/`).
2. **Hetzner Storage Box (borg/sftp)** — true always-on offsite, ~€4/month, needs ordering + creds.
3. **S3-compatible free tier (R2/B2) via rclone** — free, but one more external account/key to manage.
4. CloudNativePG operator with built-in backups — the right "real" answer, but a big operational
   step up for a learning single-node cluster (already noted as future work in the deployment doc).

## Decision

**Option 1** (owner's call, 2026-07-05): two independent layers, no new services.

- **On-cluster:** `k8s/postgres/backup-cronjob.yaml` — nightly (03:30 Europe/Budapest) `pg_dump
  --format=custom` onto a dedicated 1Gi `postgres-backup` PVC (separate from the data PVC on
  purpose), 14-day rotation, `concurrencyPolicy: Forbid`, same `pgvector/pgvector:pg16` image as
  the server (client/server versions can never drift). Credentials via the existing `mezo-db`
  Secret. ArgoCD deploys it like everything else under `k8s/`.
- **Offsite:** `scripts/backup-live-db.sh` on the admin Mac (launchd agent
  `scripts/com.mezo.db-backup.plist`, daily 09:15, fires on wake if the Mac was asleep) streams a
  fresh `pg_dump -Fc` over Tailscale into `~/MrKuhne/mezo-live-backups/` (30-copy rotation) and
  refreshes the **sealed-secrets sealing-key export** — the one secret a cluster rebuild cannot
  recreate (runbook §6).

## Consequences

- Worst-case loss window: node dies → newest Mac copy (≤ ~1 day when the Mac is used daily;
  longer on holidays — the accepted trade-off of a zero-cost offsite).
- The two layers fail independently: PVC survives app/pod trouble, Mac survives node loss.
- Restore is documented in runbook §6 (`pg_restore` custom-format dumps).
- Revisit (own ADR) when: multi-user data, or CloudNativePG adoption — its scheduled backups +
  WAL archiving to object storage would supersede both layers.
