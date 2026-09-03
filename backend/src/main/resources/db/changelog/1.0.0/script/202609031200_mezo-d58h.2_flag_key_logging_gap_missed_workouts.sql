-- Proactive coaching round 1, slice S2 (mezo-d58h.2, spec 2026-09-03 §4 rows 1/3): the
-- companion_flag_log.flag_key CHECK mirrors the FlagKey constants exactly, so the two new
-- detections need it widened. Liquibase changesets are immutable — this replaces the constraint
-- created by 202608241200_mezo-b3pp.18_create_companion_flag_log.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts'));
