-- Proactive coaching round 2, slice S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)), merged against the
-- coaching-observer trace system (mezo-6269.1): companion_flag_trace.flag_key was created without
-- protocol_lapse, since the two slices were developed in parallel. Liquibase changesets are
-- immutable — this replaces the constraint created by
-- 202609051200_mezo-6269.1_companion_flag_trace.sql rather than editing it.
alter table companion_flag_trace
    drop constraint ck_companion_flag_trace_flag_key;

alter table companion_flag_trace
    add constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse'));
