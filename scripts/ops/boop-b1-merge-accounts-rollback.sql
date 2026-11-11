-- Boop B1 (mezo-r36n9.11): undo boop-b1-merge-accounts.sql. One transaction: for every touched table the
-- CURRENT rows of both users are deleted and the backed-up rows re-inserted, then counts are asserted equal
-- to the backups. Anything either user synced AFTER the merge is discarded (printed below as "not in backup").
--
--   psql -v from_user=<uuid> -v to_user=<uuid> -f boop-b1-merge-accounts-rollback.sql            # dry run
--   psql -v from_user=<uuid> -v to_user=<uuid> -v apply=1 -f boop-b1-merge-accounts-rollback.sql # real run
--
-- The b1_backup_* tables are KEPT. Dropping them is a separate manual step, only after the owner confirmed
-- everything is well (or after a successful rollback no longer needs them):
--   DROP TABLE b1_backup_sleep_log, b1_backup_daily_metric, b1_backup_wearable_workout, b1_backup_calendar_event,
--              b1_backup_boop_brief, b1_backup_weight_log, b1_backup_workout_time_override;

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE b1_ctx ON COMMIT DROP AS SELECT :'from_user'::uuid AS from_user, :'to_user'::uuid AS to_user;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['sleep_log', 'daily_metric', 'wearable_workout', 'calendar_event', 'boop_brief',
                             'weight_log', 'workout_time_override'] LOOP
        IF to_regclass('b1_backup_' || t) IS NULL THEN
            RAISE EXCEPTION 'backup table b1_backup_% is missing - nothing to restore from', t;
        END IF;
    END LOOP;
END $$;

-- Rows that exist now for either user but not in the backup: they will be lost by the restore.
DO $$
DECLARE t text; n bigint;
BEGIN
    FOREACH t IN ARRAY ARRAY['sleep_log', 'daily_metric', 'wearable_workout', 'calendar_event', 'boop_brief',
                             'weight_log', 'workout_time_override'] LOOP
        EXECUTE format('SELECT count(*) FROM %I x, b1_ctx c WHERE x.created_by IN (c.from_user, c.to_user)
                        AND NOT EXISTS (SELECT 1 FROM %I b WHERE b.id = x.id)', t, 'b1_backup_' || t) INTO n;
        RAISE NOTICE '% : % rows not in backup (will be discarded)', t, n;
    END LOOP;
END $$;

DO $$
DECLARE t text; n_backup bigint; n_now bigint; c b1_ctx;
BEGIN
    SELECT * INTO c FROM b1_ctx;
    FOREACH t IN ARRAY ARRAY['sleep_log', 'daily_metric', 'wearable_workout', 'calendar_event', 'boop_brief',
                             'weight_log', 'workout_time_override'] LOOP
        EXECUTE format('DELETE FROM %I WHERE created_by IN (%L, %L)', t, c.from_user, c.to_user);
        EXECUTE format('INSERT INTO %I SELECT * FROM %I', t, 'b1_backup_' || t);
        EXECUTE format('SELECT count(*) FROM %I', 'b1_backup_' || t) INTO n_backup;
        EXECUTE format('SELECT count(*) FROM %I WHERE created_by IN (%L, %L)', t, c.from_user, c.to_user) INTO n_now;
        IF n_now <> n_backup THEN
            RAISE EXCEPTION '%: % rows after restore <> % in backup', t, n_now, n_backup;
        END IF;
        RAISE NOTICE '% : restored % rows', t, n_backup;
    END LOOP;
END $$;

\if :{?apply}
    \echo 'COMMIT (apply=1)'
    COMMIT;
\else
    \echo 'DRY RUN - rolling back (pass -v apply=1 to commit)'
    ROLLBACK;
\endif
