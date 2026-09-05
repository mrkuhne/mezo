-- Coaching observer S1 (mezo-6269.1, spec 2026-09-05 §4.3): the evaluation trace. One row per
-- rule per CHANGE of verdict — an hourly sweep where nothing changed writes nothing, which is
-- what keeps this table small enough to keep forever.
create table companion_flag_trace (
    id            uuid         not null,
    created_by    uuid         not null,
    created_at    timestamptz  not null,
    is_deleted    boolean      not null default false,
    flag_key      varchar(24)  not null,
    outcome       varchar(12)  not null,
    reason_code   varchar(32),
    disposition   varchar(24),
    evidence      jsonb,
    occurred_at   timestamptz  not null,
    constraint pk_companion_flag_trace_id primary key (id),
    constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating')),
    constraint ck_companion_flag_trace_outcome check (outcome in ('raised', 'clear', 'unavailable')),
    constraint ck_companion_flag_trace_disposition check (disposition is null or disposition in
        ('logged', 'suppressed_by_cooldown'))
);

-- "the newest row for this rule" — the transition comparison on every evaluation.
create index idx_companion_flag_trace_owner_flag_time
    on companion_flag_trace (created_by, flag_key, occurred_at desc);

-- "everything that happened on this day" — the observer's timeline read.
create index idx_companion_flag_trace_owner_time
    on companion_flag_trace (created_by, occurred_at);
