-- Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): four new composite flags read the new check-in
-- items — persistent_pain, poor_restedness, craving_streak, motivation_slump. Both flag_key CHECKs
-- (the raise log and the coaching-observer trace) are widened; Liquibase changesets are immutable,
-- so this replaces the constraints last created by 202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql
-- and 202609062100_mezo-d58h.7.7_flag_key_trace_energy_dip.sql rather than editing them.
-- All keys stay inside the varchar(24) both columns use (the longest new one is 16 chars).
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift', 'energy_dip_meal_timing', 'persistent_pain', 'poor_restedness',
         'craving_streak', 'motivation_slump'));

alter table companion_flag_trace
    drop constraint ck_companion_flag_trace_flag_key;

alter table companion_flag_trace
    add constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift', 'energy_dip_meal_timing', 'persistent_pain', 'poor_restedness',
         'craving_streak', 'motivation_slump'));
