# Purge-restart runbook — brand-new-user reset (mezo-rcsy)

One-off, hand-executed reset of the LIVE database. Keeps: `app_user`,
`user_profiles`, `pantry_item`, `recipe`, `recipe_ingredient`,
`exercise_catalog`, `habit_chain`, `habit_def` (+ Liquibase tables).
Deletes: everything else. Design:
[2026-08-23-database-purge-restart-design.md](../superpowers/specs/2026-08-23-database-purge-restart-design.md).

The script is safe by default: without `purge.dry_run=off` it only reports.

## 1. Fresh backup (mandatory)

```bash
./scripts/backup-live-db.sh
```

Verify the newest dump is readable:

```bash
ls -1t ~/MrKuhne/mezo-live-backups/mezo-*.dump | head -1
pg_restore --list "$(ls -1t ~/MrKuhne/mezo-live-backups/mezo-*.dump | head -1)" | head
```

## 2. Stop writes

```bash
kubectl scale -n mezo deploy/backend --replicas=0
```

ArgoCD self-heal may scale it back within minutes — either pause auto-sync for
the app in the ArgoCD UI first, or simply proceed immediately (the script runs
in seconds) and keep the PWA closed meanwhile.

## 3. Dry run

```bash
kubectl exec -i -n mezo postgres-0 -- psql -U mezo -d mezo -v ON_ERROR_STOP=1 -f - < scripts/purge-restart.sql
```

Read the `KEEP`/`PURGE` report. The `KEEP` row counts must match expectations
(pantry items, recipes, catalog rows, habit chains/defs, 1 app_user).

## 4. Live run

```bash
kubectl exec -i -n mezo postgres-0 -- env PGOPTIONS="-c purge.dry_run=off" psql -U mezo -d mezo -v ON_ERROR_STOP=1 -f - < scripts/purge-restart.sql
```

Expect `purge-restart mode: LIVE` and the final
`purge complete — whitelist tables verified unchanged`. Any exception means the
transaction rolled back and nothing changed.

## 5. Restart + smoke-check

```bash
kubectl scale -n mezo deploy/backend --replicas=1
```

In the PWA, open each surface and expect (spec §4):

- Today / Week: empty states; routine chains present with zero streak
- Train: no mesocycles/templates/futás/sport/gym; `/exercises` library intact
- Fuel: kamra + recipes intact; meals / slots / stack empty, settings default
- Sleep / weight / gyógyszer / ritual / napló: empty
- Chat / memória / knowledge / people / insights / predictions / memoir: empty
- medals / growth / progression: 0 XP, nothing owned
- értesítések: prefs default; re-enable push in the browser
- me / goals: profile present; goal + biometrics to re-enter

Any 500 → file its own bd issue (first-run bug, not a purge bug).

## 6. Rollback (if needed)

Restore the §1 dump (full overwrite, drops what was written since):

```bash
kubectl scale -n mezo deploy/backend --replicas=0
kubectl exec -i -n mezo postgres-0 -- pg_restore -U mezo -d mezo --clean --if-exists < ~/MrKuhne/mezo-live-backups/mezo-<STAMP>.dump
kubectl scale -n mezo deploy/backend --replicas=1
```
