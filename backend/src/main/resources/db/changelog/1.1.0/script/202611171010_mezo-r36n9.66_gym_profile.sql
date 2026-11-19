-- The per-user gym profile "Mi van a termemben" (mezo-r36n9.66, spec 2026-11-17-boop-gyakorlatvalasztas-design §6.2).
-- One live row per user: the kit kinds the gym lacks and the catalogue exercises it cannot do.
create table gym_profile (
    id                    uuid        not null default gen_random_uuid(),
    created_by            uuid        not null,
    is_deleted            boolean     not null default false,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    off_kinds             varchar(16)[] not null default '{}',
    missing_exercise_ids  uuid[]      not null default '{}',
    constraint pk_gym_profile_id primary key (id),
    constraint fk_gym_profile_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_gym_profile_user on gym_profile (created_by) where is_deleted = false;
