-- Boop B1 (mezo-r36n9.11): move the Apple Health data of the Boop account (FROM) into the original
-- account (TO), in ONE transaction, after taking full backups. One-off ops script, NOT Liquibase
-- (account-specific ids are supplied on the command line, never committed).
--
--   psql -v from_user=<uuid> -v to_user=<uuid> -f boop-b1-merge-accounts.sql           # dry run (ROLLBACK)
--   psql -v from_user=<uuid> -v to_user=<uuid> -v apply=1 -f boop-b1-merge-accounts.sql # real run (COMMIT)
--
-- SAFE BY DEFAULT: the transaction commits only when `-v apply=1` is given; otherwise it is rolled back
-- (so the backup tables of a dry run do not persist either). The script refuses to run twice: the b1_backup_*
-- tables are created without IF NOT EXISTS, so a second run fails at the first CREATE.
--
-- Rules per table (live = is_deleted = false; FROM's soft-deleted rows always stay with FROM):
--   sleep_log   FROM's live apple_health nights. A date where TO has a live night -> merge into TO's row per
--               SleepNightMerge: sensor fields (bedtime, wakeup, duration_h, in_bed/awake/light/rem/deep_min,
--               hypnogram, sleeping_hr, source_app, external_id, source='apple_health') come from FROM (a TO
--               manual/screenshot row keeps its own value where FROM has none; a TO apple_health row is
--               overwritten wholesale); subjective fields (quality, source_quality_pct, awakenings, notes)
--               stay TO's. FROM's row is then soft-deleted with its external_id cleared (the external-id
--               unique index spans soft-deleted rows, so the id is freed first, then given to TO's row).
--               A date TO has no live night on -> FROM's row is reassigned to TO. FROM's live non-apple_health
--               nights are left with FROM.
--   daily_metric, wearable_workout, calendar_event, boop_brief, weight_log, workout_time_override
--               FROM's live rows are reassigned to TO. If TO already has a LIVE colliding row (daily_metric
--               same date; wearable_workout same external_id; calendar_event same external_id+date;
--               boop_brief / workout_time_override same date; weight_log same external_id) TO's row wins
--               and FROM's row is soft-deleted in place. Tables whose unique key spans soft-deleted rows
--               (daily_metric, wearable_workout, calendar_event, weight_log external id) additionally lose
--               TO's colliding TOMBSTONE rows (hard delete; the backup holds them) so the move cannot trip.
--
-- Backups: b1_backup_<table> hold every row (live and deleted) of BOTH users. The rollback script restores from them.

\set ON_ERROR_STOP on

BEGIN;

-- The ids live in a one-row temp table; DO blocks cannot see psql variables.
CREATE TEMP TABLE b1_ctx ON COMMIT DROP AS SELECT :'from_user'::uuid AS from_user, :'to_user'::uuid AS to_user;

CREATE TEMP TABLE b1_tables (tbl text) ON COMMIT DROP;
INSERT INTO b1_tables VALUES ('sleep_log'), ('daily_metric'), ('wearable_workout'), ('calendar_event'),
                             ('boop_brief'), ('weight_log'), ('workout_time_override');

DO $$
DECLARE c b1_ctx;
BEGIN
    SELECT * INTO c FROM b1_ctx;
    IF c.from_user = c.to_user THEN
        RAISE EXCEPTION 'from_user and to_user must differ';
    END IF;
    IF (SELECT count(*) FROM app_user WHERE id IN (c.from_user, c.to_user)) <> 2 THEN
        RAISE EXCEPTION 'from_user / to_user: both must be existing app_user ids';
    END IF;
END $$;

-- Backups first (fails when they already exist -> the script refuses a second run).
CREATE TABLE b1_backup_sleep_log AS SELECT t.* FROM sleep_log t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_daily_metric AS SELECT t.* FROM daily_metric t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_wearable_workout AS SELECT t.* FROM wearable_workout t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_calendar_event AS SELECT t.* FROM calendar_event t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_boop_brief AS SELECT t.* FROM boop_brief t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_weight_log AS SELECT t.* FROM weight_log t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);
CREATE TABLE b1_backup_workout_time_override AS SELECT t.* FROM workout_time_override t, b1_ctx c WHERE t.created_by IN (c.from_user, c.to_user);

-- Live counts per table and user; report rows collect what each step did.
CREATE TEMP TABLE b1_counts (phase text, tbl text, from_live bigint, to_live bigint) ON COMMIT DROP;
CREATE TEMP TABLE b1_report (tbl text PRIMARY KEY, merged bigint NOT NULL DEFAULT 0, moved bigint NOT NULL DEFAULT 0,
                             collided bigint NOT NULL DEFAULT 0, tombstones_removed bigint NOT NULL DEFAULT 0) ON COMMIT DROP;
INSERT INTO b1_report (tbl) SELECT tbl FROM b1_tables;

DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tbl FROM b1_tables LOOP
        EXECUTE format('INSERT INTO b1_counts SELECT %L, %L,
            (SELECT count(*) FROM %I t, b1_ctx c WHERE t.created_by = c.from_user AND NOT t.is_deleted),
            (SELECT count(*) FROM %I t, b1_ctx c WHERE t.created_by = c.to_user AND NOT t.is_deleted)',
            'before', r.tbl, r.tbl, r.tbl);
    END LOOP;
END $$;
SELECT 'BEFORE' AS phase, tbl, from_live, to_live FROM b1_counts WHERE phase = 'before' ORDER BY tbl;

-- ---------------------------------------------------------------- sleep_log
-- Pairs: FROM's live apple_health night and TO's live night on the same date.
CREATE TEMP TABLE b1_sleep_pairs ON COMMIT DROP AS
SELECT f.id AS from_id, t.id AS to_id, f.external_id AS from_external_id
FROM sleep_log f
JOIN b1_ctx c ON f.created_by = c.from_user
JOIN sleep_log t ON t.created_by = c.to_user AND t.date = f.date AND NOT t.is_deleted
WHERE NOT f.is_deleted AND f.source = 'apple_health';

-- Keep FROM's sensor values of the merged nights, then free the FROM rows (soft delete + clear external id)
-- BEFORE TO's rows take the external id (uq_sleep_log_owner_external spans soft-deleted rows).
CREATE TEMP TABLE b1_sleep_sensor ON COMMIT DROP AS
SELECT p.to_id, p.from_external_id, f.bedtime, f.wakeup, f.duration_h, f.in_bed_min, f.awake_min, f.light_min,
       f.rem_min, f.deep_min, f.hypnogram, f.sleeping_hr, f.source_app
FROM b1_sleep_pairs p JOIN sleep_log f ON f.id = p.from_id;

UPDATE sleep_log f SET is_deleted = true, external_id = NULL
FROM b1_sleep_pairs p WHERE f.id = p.from_id;

UPDATE sleep_log t SET
    bedtime     = CASE WHEN t.source = 'apple_health' THEN s.bedtime     ELSE coalesce(s.bedtime, t.bedtime) END,
    wakeup      = CASE WHEN t.source = 'apple_health' THEN s.wakeup      ELSE coalesce(s.wakeup, t.wakeup) END,
    duration_h  = CASE WHEN t.source = 'apple_health' THEN s.duration_h  ELSE coalesce(s.duration_h, t.duration_h) END,
    in_bed_min  = CASE WHEN t.source = 'apple_health' THEN s.in_bed_min  ELSE coalesce(s.in_bed_min, t.in_bed_min) END,
    awake_min   = CASE WHEN t.source = 'apple_health' THEN s.awake_min   ELSE coalesce(s.awake_min, t.awake_min) END,
    light_min   = CASE WHEN t.source = 'apple_health' THEN s.light_min   ELSE coalesce(s.light_min, t.light_min) END,
    rem_min     = CASE WHEN t.source = 'apple_health' THEN s.rem_min     ELSE coalesce(s.rem_min, t.rem_min) END,
    deep_min    = CASE WHEN t.source = 'apple_health' THEN s.deep_min    ELSE coalesce(s.deep_min, t.deep_min) END,
    hypnogram   = CASE WHEN t.source = 'apple_health' THEN s.hypnogram   ELSE coalesce(s.hypnogram, t.hypnogram) END,
    sleeping_hr = CASE WHEN t.source = 'apple_health' THEN s.sleeping_hr ELSE coalesce(s.sleeping_hr, t.sleeping_hr) END,
    source_app  = CASE WHEN t.source = 'apple_health' THEN s.source_app  ELSE coalesce(s.source_app, t.source_app) END,
    external_id = s.from_external_id,
    source      = 'apple_health'
    -- quality, source_quality_pct, awakenings, notes: deliberately untouched (subjective, TO's).
FROM b1_sleep_sensor s WHERE t.id = s.to_id;

UPDATE b1_report SET merged = (SELECT count(*) FROM b1_sleep_pairs) WHERE tbl = 'sleep_log';

-- The remaining live apple_health nights of FROM move to TO. No live-date collision is possible (a date
-- TO has a live night on was merged above); an external-id collision would trip the unique index, so say so first.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sleep_log f, b1_ctx c, sleep_log t
               WHERE f.created_by = c.from_user AND NOT f.is_deleted AND f.source = 'apple_health'
                 AND t.created_by = c.to_user AND t.external_id = f.external_id AND f.external_id IS NOT NULL) THEN
        RAISE EXCEPTION 'sleep_log: TO already holds a row with the external id of a FROM night that would move';
    END IF;
END $$;

WITH mv AS (
    UPDATE sleep_log f SET created_by = c.to_user
    FROM b1_ctx c
    WHERE f.created_by = c.from_user AND NOT f.is_deleted AND f.source = 'apple_health'
    RETURNING f.id
)
UPDATE b1_report SET moved = (SELECT count(*) FROM mv) WHERE tbl = 'sleep_log';

-- ------------------------------------------------- the six reassign-only tables
DO $$
DECLARE
    r record;
    n bigint;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('daily_metric',          'a.date = b.date',                                                true),
            ('wearable_workout',      'a.external_id = b.external_id',                                  true),
            ('calendar_event',        'a.external_id = b.external_id AND a.date = b.date',              true),
            ('boop_brief',            'a.date = b.date',                                                false),
            ('weight_log',            'a.external_id IS NOT NULL AND a.external_id = b.external_id',    true),
            ('workout_time_override', 'a.date = b.date',                                                false)
        ) v(tbl, cond, spans_deleted)
    LOOP
        -- 1) FROM live rows colliding with a TO LIVE row: TO's wins, FROM's is soft-deleted in place.
        EXECUTE format('UPDATE %I a SET is_deleted = true FROM b1_ctx c
            WHERE a.created_by = c.from_user AND NOT a.is_deleted
              AND EXISTS (SELECT 1 FROM %I b WHERE b.created_by = c.to_user AND NOT b.is_deleted AND %s)',
            r.tbl, r.tbl, r.cond);
        GET DIAGNOSTICS n = ROW_COUNT;
        UPDATE b1_report SET collided = n WHERE tbl = r.tbl;

        -- 2) Full-span unique keys: a TO tombstone with the same key would trip the move; remove it (backup holds it).
        IF r.spans_deleted THEN
            EXECUTE format('DELETE FROM %I b USING b1_ctx c
                WHERE b.created_by = c.to_user AND b.is_deleted
                  AND EXISTS (SELECT 1 FROM %I a WHERE a.created_by = c.from_user AND NOT a.is_deleted AND %s)',
                r.tbl, r.tbl, r.cond);
            GET DIAGNOSTICS n = ROW_COUNT;
            UPDATE b1_report SET tombstones_removed = n WHERE tbl = r.tbl;
        END IF;

        -- 3) Move what is left of FROM's live rows.
        EXECUTE format('UPDATE %I a SET created_by = c.to_user FROM b1_ctx c
            WHERE a.created_by = c.from_user AND NOT a.is_deleted', r.tbl);
        GET DIAGNOSTICS n = ROW_COUNT;
        UPDATE b1_report SET moved = n WHERE tbl = r.tbl;
    END LOOP;
END $$;

-- ---------------------------------------------------------------- assertions + report
DO $$
DECLARE
    r record;
    c b1_ctx;
    before_row b1_counts;
    from_after bigint;
    to_after bigint;
    rep b1_report;
BEGIN
    SELECT * INTO c FROM b1_ctx;
    FOR r IN SELECT tbl FROM b1_tables LOOP
        EXECUTE format('INSERT INTO b1_counts SELECT %L, %L,
            (SELECT count(*) FROM %I t WHERE t.created_by = %L AND NOT t.is_deleted),
            (SELECT count(*) FROM %I t WHERE t.created_by = %L AND NOT t.is_deleted)',
            'after', r.tbl, r.tbl, c.from_user, r.tbl, c.to_user);
        SELECT * INTO before_row FROM b1_counts WHERE phase = 'before' AND tbl = r.tbl;
        SELECT from_live, to_live INTO from_after, to_after FROM b1_counts WHERE phase = 'after' AND tbl = r.tbl;
        SELECT * INTO rep FROM b1_report WHERE tbl = r.tbl;

        IF r.tbl = 'sleep_log' THEN
            -- FROM keeps only live nights that are not apple_health (intentionally left).
            SELECT count(*) INTO from_after FROM sleep_log WHERE created_by = c.from_user AND NOT is_deleted AND source = 'apple_health';
            IF from_after <> 0 THEN RAISE EXCEPTION 'sleep_log: FROM still has % live apple_health nights', from_after; END IF;
            IF to_after <> before_row.to_live + rep.moved THEN
                RAISE EXCEPTION 'sleep_log: TO live % <> before % + moved %', to_after, before_row.to_live, rep.moved;
            END IF;
        ELSE
            IF from_after <> 0 THEN RAISE EXCEPTION '%: FROM still has % live rows', r.tbl, from_after; END IF;
            IF to_after <> before_row.to_live + rep.moved THEN
                RAISE EXCEPTION '%: TO live % <> before % + moved %', r.tbl, to_after, before_row.to_live, rep.moved;
            END IF;
        END IF;
        IF r.tbl <> 'sleep_log' AND rep.moved + rep.collided <> before_row.from_live THEN
            RAISE EXCEPTION '%: moved % + collided % <> FROM live before %', r.tbl, rep.moved, rep.collided, before_row.from_live;
        END IF;
    END LOOP;

    -- sleep: every FROM live apple_health night was either merged or moved.
    SELECT * INTO rep FROM b1_report WHERE tbl = 'sleep_log';
    SELECT * INTO before_row FROM b1_counts WHERE phase = 'before' AND tbl = 'sleep_log';
    IF rep.merged + rep.moved <> (SELECT count(*) FROM b1_backup_sleep_log b
                                  WHERE b.created_by = c.from_user AND NOT b.is_deleted AND b.source = 'apple_health') THEN
        RAISE EXCEPTION 'sleep_log: merged % + moved % <> FROM live apple_health nights in the backup', rep.merged, rep.moved;
    END IF;

    IF EXISTS (SELECT 1 FROM sleep_log WHERE NOT is_deleted GROUP BY created_by, date HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'sleep_log: two live nights share an (owner, date)';
    END IF;
END $$;

SELECT 'AFTER' AS phase, tbl, from_live, to_live FROM b1_counts WHERE phase = 'after' ORDER BY tbl;
SELECT * FROM b1_report ORDER BY tbl;

-- Dry run unless `-v apply=1` was passed (undefined variable -> rollback branch).
\if :{?apply}
    \echo 'COMMIT (apply=1)'
    COMMIT;
\else
    \echo 'DRY RUN - rolling back (pass -v apply=1 to commit)'
    ROLLBACK;
\endif
