#!/usr/bin/env bash
# =============================================================================
# Offsite pull of the LIVE mezo Postgres onto the admin Mac (mezo-osj, ADR 0009).
#
# The on-cluster half is k8s/postgres/backup-cronjob.yaml (nightly pg_dump onto
# the postgres-backup PVC, 14-day rotation). This script is the OFFSITE half:
# it streams a fresh pg_dump over Tailscale into ~/MrKuhne/mezo-live-backups/
# (30-copy rotation) and also refreshes the sealed-secrets SEALING KEY export —
# the one secret a cluster rebuild cannot recreate (runbook §6).
#
# Scheduled by launchd: scripts/com.mezo.db-backup.plist (daily; if the Mac was
# asleep at the scheduled time, launchd fires it on wake). Run manually any time.
# =============================================================================
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/mezo-k3s.yaml}"
DEST="${MEZO_BACKUP_DIR:-$HOME/MrKuhne/mezo-live-backups}"
KEEP=30
STAMP=$(date +%F-%H%M)

mkdir -p "$DEST"
echo "[$(date '+%F %T')] mezo live backup starting -> $DEST"

# 1. Fresh logical dump, custom format (pg_restore-able), streamed over Tailscale.
kubectl exec -n mezo postgres-0 -- pg_dump -U mezo -Fc mezo > "$DEST/mezo-${STAMP}.dump.part"
mv "$DEST/mezo-${STAMP}.dump.part" "$DEST/mezo-${STAMP}.dump"
echo "  dump OK: mezo-${STAMP}.dump ($(du -h "$DEST/mezo-${STAMP}.dump" | cut -f1))"

# 2. Sealed-secrets sealing key — without it, the git-committed SealedSecrets are
#    undecryptable after a rebuild. PRIVATE FILE: stays on this Mac, never in git.
kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml \
  > "$DEST/sealed-secrets-key.yaml.part"
mv "$DEST/sealed-secrets-key.yaml.part" "$DEST/sealed-secrets-key.yaml"
chmod 600 "$DEST/sealed-secrets-key.yaml"
echo "  sealing key refreshed"

# 3. Rotation: keep the newest $KEEP dumps.
ls -1t "$DEST"/mezo-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "  rotated out: $(basename "$old")"
done
rm -f "$DEST"/*.part

echo "[$(date '+%F %T')] done · $(ls "$DEST"/mezo-*.dump | wc -l | tr -d ' ') dumps on disk"
