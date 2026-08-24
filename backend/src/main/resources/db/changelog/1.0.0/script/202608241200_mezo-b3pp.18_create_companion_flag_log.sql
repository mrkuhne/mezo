-- Phase 5 W5.1 (bd mezo-b3pp.18, spec §4.5/§9.1): the composite-flag audit trail. One row per
-- RAISE (never per evaluation) — the evaluator is deterministic and LLM-free, so payload freezing
-- the inputs makes every raise reproducible after the fact. Cooldowns (§9.2) derive from this log:
-- a flag re-raises only when no row of the same flag_key is newer than its cooldown.
create table companion_flag_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    flag_key   varchar(24) not null,
    source     varchar(6)  not null,
    payload    jsonb,
    constraint pk_companion_flag_log_id primary key (id),
    constraint fk_companion_flag_log_created_by_app_user_id foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy')),
    constraint ck_companion_flag_log_source check (source in ('write', 'sweep'))
);

create index idx_companion_flag_log_user_key_at on companion_flag_log (created_by, flag_key, created_at desc);
