-- Proactive coaching round 2, slice S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): the same widening
-- on the coaching-observer trace table (mezo-6269.1), whose CHECK is a separate constraint.
-- Liquibase changesets are immutable — this replaces the constraint created by
-- 202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql rather than editing it.
alter table companion_flag_trace
    drop constraint ck_companion_flag_trace_flag_key;

alter table companion_flag_trace
    add constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift', 'energy_dip_meal_timing'));
