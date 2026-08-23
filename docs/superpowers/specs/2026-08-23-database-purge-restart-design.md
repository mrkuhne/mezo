# Database purge — brand-new-user restart (mezo-rcsy)

**Date:** 2026-08-23 · **Driving issue:** mezo-rcsy · **Status:** approved design

## 1. Goal

Many features were unfinished during the first months of real use, so the owner wants to
restart the app as if they were a brand-new user — **without** re-entering the shared
reference data that took real effort to build up. Everything else (AI memory and knowledge,
gamification, every logged event, every plan, every setting) is physically deleted from the
live Postgres.

This is a **one-off operational action**, not schema evolution: it is delivered as an SQL
script + runbook, executed by hand against the live cluster DB. It is deliberately *not* a
Liquibase migration (the `mezo-lwmq` precedent) — a migration would fire at deploy time and
wipe whatever the owner entered up to that moment; the owner decides the exact moment here.

## 2. What is kept (whitelist)

| Table | Why |
|---|---|
| `app_user`, `user_profiles` | identity / login (single user) |
| `pantry_item` | kamra |
| `recipe`, `recipe_ingredient` | receptek, incl. nutrient-snapshot columns |
| `exercise_catalog` | gyakorlattár (library; `exercise.catalog_id` points here) |
| `habit_chain`, `habit_def` | the morning/evening routine **definitions** |
| `databasechangelog`, `databasechangeloglock` | Liquibase bookkeeping |

Row counts of every whitelist table must be identical before and after; otherwise the
transaction rolls back.

Notes:
- `exercise` (per-workout instance, FK → `workout_session` → `mesocycle`, CASCADE) is **not**
  the exercise library and is deleted with the plans.
- `habit_day` (the daily tick log) is deleted; the routine survives, streaks start at zero.
  `habit_def.skill_key` is a plain string, not an FK, so deleting `skill_progress` is safe.
- Whitelist tables are only referenced by deleted tables via `ON DELETE RESTRICT`
  (`meal_item`, `protocol_item`, `supplement_intake` → `pantry_item`; `meal_item` → `recipe`)
  or `SET NULL` (`pantry_import`, `exercise`). Since the *referencing* side is what gets
  truncated, no constraint fires against the kept rows.

## 3. What is deleted (everything else)

The script does **not** enumerate the delete side. It treats the whitelist as authoritative
and `TRUNCATE ... CASCADE`s every other table in `public` (plus pgvector-backed
`memory_embedding`). Any table added after this spec is therefore purged too — no orphaned
data by omission. For the record, the groups at the time of writing:

- **AI / memory / knowledge (22):** `ai_conversation`, `ai_message`, `message_feedback`,
  `feedback_rollup`, `companion_message`, `memory_embedding`, `learned_fact`,
  `knowledge_fact`, `knowledge_node`, `knowledge_edge`, `pattern`, `pattern_event`,
  `prediction`, `experiment`, `weekly_suggestion`, `heartbeat_note`, `briefing`,
  `daily_summary`, `memoir`, `person`, `mention`, `llm_log_history`
- **Gamification / medals (8):** `gamification_profile`, `level_up_event`, `coin_event`,
  `owned_title`, `perk_unlock`, `skill_progress`, `daily_quest`, `challenge`
- **Logged events (22):** `activity_log`, `check_in`, `weight_log`, `sleep_log`,
  `water_log`, `meal`, `meal_item`, `supplement_intake`, `medication_dose`, `habit_day`,
  `ritual_day`, `needs_day`, `journal_entry`, `decision_entry`, `gratitude_entry`,
  `daily_intention`, `intention_focus`, `exercise_feedback`, `run_session_log`,
  `sport_session`, `app_notification`, `push_log`
- **Plans (14):** `mesocycle` (→ cascade `workout_session`, `exercise`, `exercise_set`,
  `muscle_group_volume_log`, `mesocycle_report`), `meso_template`, `running_block`,
  `sport_schedule_slot`, `sport_event`, `gym_schedule_slot`, `goal`, `goal_plan_link`,
  `biometric_profile`
- **Settings (10):** `fuel_settings`, `sleep_goal`, `intention_creed`, `meal_slot_template`,
  `protocol`, `protocol_item`, `medication`, `notification_pref`, `notification_schedule`,
  `push_subscription`
- **Import log (1):** `pantry_import`

## 4. Expected app state afterwards

| Surface | State |
|---|---|
| Today / Week | empty states — no meso, no intention, no briefing; **routine chains show with zero streak** |
| Train: mesocycles / templates / futás / sport / gym | empty, "create" state; `/exercises` library intact |
| Fuel: kamra, recipes | **intact**; meals log, `fuel/slots`, `stack` (protocol) empty; fuel settings default |
| Sleep / weight / gyógyszer / ritual / napló | empty; sleep goal default; medication list empty |
| Chat / memória / knowledge / people / insights / predictions / experiments / memoir | empty — AI learns from scratch |
| medals / growth / progression | 0 XP, no medals, titles or perks |
| értesítések / push | no subscription — push must be re-enabled in the browser; prefs default |
| me / goals | profile present; goal + biometrics empty, to be re-entered |

Risk: a surface may assume a singleton row exists (`gamification_profile`, `fuel_settings`,
`sleep_goal`, …). The brand-new-user path should lazy-create these; the runbook ends with a
smoke-check of every surface above. Any 500 becomes its own bd issue — it is a real
first-run bug, not a purge bug.

## 5. Deliverables

1. **`scripts/purge-restart.sql`** — single transaction:
   1. `SET LOCAL` a `purge.dry_run` setting (default `on`).
   2. Build the whitelist as a `VALUES` list; snapshot `count(*)` per whitelist table.
   3. Emit `RAISE NOTICE` with per-table row counts for every non-whitelist table
      (this is the dry-run report).
   4. If not dry-run: `TRUNCATE <all non-whitelist tables> CASCADE` in one statement
      (one statement ⇒ no FK ordering concerns).
   5. Re-count whitelist tables; `RAISE EXCEPTION` (⇒ rollback) on any difference.
   6. `COMMIT` only when not dry-run; dry-run always ends in `ROLLBACK`.
2. **`docs/infrastructure/purge-restart-runbook.md`** — steps:
   1. fresh offsite dump via `scripts/backup-live-db.sh`; confirm the file exists and
      `pg_restore --list` reads it;
   2. stop traffic: scale the backend deployment to 0 (`kubectl scale -n mezo deploy/backend --replicas=0`)
      so no write races the purge (ArgoCD self-heal may scale it back — pause auto-sync for the
      app first, or just keep the PWA closed during the few seconds the script runs);
   3. dry run: `kubectl exec -i -n mezo postgres-0 -- psql -U mezo -d mezo -v ON_ERROR_STOP=1 < scripts/purge-restart.sql`;
      read the notice report, check whitelist counts look right;
   4. live run: same with `-v dry_run=off`;
   5. scale backend back up; smoke-check every surface in §4 in the PWA;
   6. rollback recipe: `pg_restore -U mezo -d mezo --clean --if-exists <dump>` (documented, not executed).
3. bd issue **mezo-rcsy** tracks the work; close after the live run + smoke-check.

## 6. Testing

- The SQL is exercised against the local Testcontainers Postgres in a small backend IT
  (`PurgeRestartScriptIT`): seed one row into a kept table and one into a deleted table,
  run the script in dry-run (both rows survive, notice report lists the deleted table), then
  live (kept row survives, deleted row gone, whitelist assert passes). This protects the
  script against schema drift (renamed kept tables would make the whitelist snapshot fail).
- The runbook's dry-run step is the production rehearsal.

## 7. Out of scope

- Any change to the application's soft-delete conventions or first-run lazy-create logic.
- Deleting the `app_user` row / re-registering.
- Cleaning the pgvector extension, sequences, or Liquibase history.
