# Purge-restart runbook — brand-new-user reset (mezo-rcsy)

One-off, hand-executed reset of the LIVE database. Keeps: `app_user`,
`pantry_catalog`, `pantry_item`, `recipe`, `recipe_ingredient`,
`exercise_catalog`, `habit_chain`, `habit_def` (+ Liquibase tables).
Deletes: everything else — including `pantry_item_definition_archive`, the
one-way snapshot the S4 pantry split (mezo-qw37.4) took of the pre-split
definition columns: it is migration scaffolding rather than live user data,
and the point of the restart is that no trace remains. (`user_profiles`,
listed here until mezo-qw37.1, no longer exists.) Design:
[2026-08-23-database-purge-restart-design.md](../superpowers/specs/2026-08-23-database-purge-restart-design.md).

The script is safe by default: without `purge.dry_run=off` it only reports.

## 1. Stop writes

1. Pause ArgoCD auto-sync for the `mezo` Application (namespace `argocd`) so
   it can't scale the backend back up mid-purge:

   ```bash
   kubectl patch application mezo -n argocd --type merge -p '{"spec":{"syncPolicy":null}}'
   ```

2. Scale the backend to zero:

   ```bash
   kubectl scale -n mezo deploy/backend --replicas=0
   ```

## 2. Fresh backup (mandatory)

```bash
./scripts/backup-live-db.sh
```

Verify the newest dump is readable — list its contents with the in-pod
`pg_restore` (a local client may be a different major version than the
in-cluster server and refuse to read the dump):

```bash
LATEST=$(ls -1t ~/MrKuhne/mezo-live-backups/mezo-*.dump | head -1)
kubectl exec -i -n mezo postgres-0 -- pg_restore --list < "$LATEST" | head
```

### Rehearse the restore (do this before a live purge)

Prove the dump actually restores before you need it, into a scratch DB
inside the pod — never touches `mezo`:

```bash
kubectl exec -i -n mezo postgres-0 -- createdb -U mezo mezo_restore_test
kubectl exec -i -n mezo postgres-0 -- pg_restore -U mezo -d mezo_restore_test --exit-on-error < "$LATEST"
kubectl exec -i -n mezo postgres-0 -- dropdb -U mezo mezo_restore_test
```

Note: under `--exit-on-error`, restoring the `vector` extension's objects
into a fresh scratch DB can fail if the extension isn't pre-installed there —
if the rehearsal aborts on a `CREATE EXTENSION`/vector-type statement, that's
an extension-availability issue in the scratch DB, not proof the dump itself
is bad.

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

1. Resume ArgoCD auto-sync, restoring the original `syncPolicy` exactly as
   the manifest (`argocd/application.yaml`) defines it:

   ```bash
   kubectl patch application mezo -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
   ```

2. Scale the backend back up:

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

### 5b. Re-enter the settings the purge silently drops (mezo-k0hp)

The whitelist keeps identity + the catalogs; **every per-user CONFIG row is
purged with the rest**, and the surfaces that read one through a
config-default fallback keep rendering as if nothing was lost. Walk this list
by hand after the restart — a missing row here does not look empty, it looks
like a setting someone chose:

| Row | Read through | What the ghost looks like |
|---|---|---|
| `sleep_goal` | `SleepGoalService.getGoal` → config default (`mezo.sleep`) | A real-looking "8 óra / ébredés 06:00" goal. Since `mezo-k0hp` the response carries `isSet:false` and the Alvás card + goal sheet say "alapértelmezett" — set the goal to clear it. |
| `fuel_settings` | `FuelSettingsProperties` ghost (`mezo.fuel-settings`) | Default meal cadence, indistinguishable from a chosen one. |

The 2026-08-24 purge is the case in point: the sleep goal (480 / WAKE / 05:30)
was dropped and nobody noticed for twelve days, until the daily
`missing_sleep_goal` setup card — which reads the repository, not the
service — contradicted what the app had been showing all along.

## 6. Rollback (if needed)

Restore the §2 dump (full overwrite, drops what was written since):

```bash
kubectl scale -n mezo deploy/backend --replicas=0
kubectl exec -i -n mezo postgres-0 -- pg_restore -U mezo -d mezo --clean --if-exists --exit-on-error < ~/MrKuhne/mezo-live-backups/mezo-<STAMP>.dump
kubectl scale -n mezo deploy/backend --replicas=1
```
