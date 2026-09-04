-- Proactive coaching round 1, slice S6 batch B (mezo-d58h.6, spec 2026-09-03 §4): six more
-- detections need the companion_flag_log.flag_key CHECK widened. Liquibase changesets are
-- immutable — this replaces the constraint created by
-- 202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating'));
