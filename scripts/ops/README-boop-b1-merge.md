# Boop B1 account switch: merge the Boop account's Apple Health data into the original account

One-off production write (mezo-r36n9.11). Needs the owner's explicit OK with the counts below and the rollback plan
**before** the real run. Never run it from CI; never commit the user ids.

Files: `boop-b1-merge-accounts.sql` (merge), `boop-b1-merge-accounts-rollback.sql` (undo). Both take the psql
variables `from_user` (the Boop account) and `to_user` (the original account), and are **dry runs unless `-v apply` is a true value (1, on, true, yes)**.
Rehearsal: `BoopB1MergeScriptIT` (Testcontainers, synthetic data of the production shape).

## Steps

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
PSQL='kubectl exec -i -n mezo postgres-0 -- psql -U mezo -d mezo'
FROM=<boop account uuid>; TO=<original account uuid>

# 0. Counts of live rows per user (expected: 35 nights, 61 metrics, 16 workouts, 9 events, 1 brief, 1 weight)
$PSQL -c "select count(*) filter (where created_by='$FROM' and not is_deleted and source='apple_health') from sleep_log"

# 1. Dry run: prints BEFORE / AFTER / per-table report, asserts, then ROLLBACK
$PSQL -v from_user=$FROM -v to_user=$TO -f - < scripts/ops/boop-b1-merge-accounts.sql

# 2. Real run (same command plus -v apply=1) -> COMMIT. Refuses to run twice (backup tables exist).
$PSQL -v from_user=$FROM -v to_user=$TO -v apply=1 -f - < scripts/ops/boop-b1-merge-accounts.sql
```

The script raises (and rolls back) when: the users are equal or unknown, a backup table exists, a moved night's
external id already exists on the target, or any post-move assertion fails (FROM has no live rows left in the moved
tables, TO live count = before + moved, moved + collided = FROM live before, merged + moved = FROM nights, no two
live nights on one date).

## Merge rule (summary)

- Nights on a date where TO has a live night: sensor fields from FROM (bed/wake, duration, stages, hypnogram,
  sleeping HR, source app, external id, `source='apple_health'`), TO keeps quality / quality % / awakenings / notes.
- All other FROM nights, and every live row of the other six tables, move to TO. A live collision on the table's
  unique key keeps TO's row; FROM's is soft-deleted in place. FROM's soft-deleted rows stay with FROM.
- The Boop account itself is left untouched (habits, AI logs); sign-in to it is disabled only after the owner confirms.

## Verification after the real run

```sql
select tbl, count(*) filter (where created_by = '<TO>' and not is_deleted) as to_live,
            count(*) filter (where created_by = '<FROM>' and not is_deleted) as from_live
from (select 'sleep_log' tbl, created_by, is_deleted from sleep_log
      union all select 'daily_metric', created_by, is_deleted from daily_metric
      union all select 'wearable_workout', created_by, is_deleted from wearable_workout
      union all select 'calendar_event', created_by, is_deleted from calendar_event
      union all select 'boop_brief', created_by, is_deleted from boop_brief
      union all select 'weight_log', created_by, is_deleted from weight_log) x group by tbl;
select date, count(*) from sleep_log where created_by = '<TO>' and not is_deleted group by date having count(*) > 1; -- 0 rows
```

Then sign the phone in with the original account and check Ma / Napló in the app.

## Rollback

```bash
$PSQL -v from_user=$FROM -v to_user=$TO -f - < scripts/ops/boop-b1-merge-accounts-rollback.sql           # dry run
$PSQL -v from_user=$FROM -v to_user=$TO -v apply=1 -f - < scripts/ops/boop-b1-merge-accounts-rollback.sql
```

One transaction: deletes the current rows of both users in the seven tables, re-inserts them from `b1_backup_*`, asserts
equal counts. **Anything either user synced after the merge is discarded** (the script prints how many rows per table
are not in the backup). The backups are kept.

## Final cleanup (manual, only after the owner confirms everything is well)

```sql
DROP TABLE b1_backup_sleep_log, b1_backup_daily_metric, b1_backup_wearable_workout, b1_backup_calendar_event,
           b1_backup_boop_brief, b1_backup_weight_log, b1_backup_workout_time_override, b1_backup_health_sample;
```

Notes: `apply=0`, `apply=` or any false value rolls back. `health_sample` is part of the backup/move/rollback (TO wins
on an external-id collision). The rollback re-inserts with explicit column lists taken from the backup tables.
