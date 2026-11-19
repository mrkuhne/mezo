-- The swap-time "nem esik jól" record (mezo-r36n9.66, spec 2026-11-17-boop-gyakorlatvalasztas-design §6.1).
-- One live row per (user, exercise identity, day); identity_key is ExerciseHistoryResolver.identityKey of the
-- outgoing row ("c:<catalogId>" when catalogue-linked, else "n:<name>"), so a custom exercise is remembered too.
create table exercise_discomfort (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    identity_key  varchar(160) not null,
    catalog_id    uuid,
    noted_on      date        not null,
    source        varchar(8)  not null default 'swap',
    constraint pk_exercise_discomfort_id primary key (id),
    constraint fk_exercise_discomfort_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_exercise_discomfort_day on exercise_discomfort (created_by, identity_key, noted_on) where is_deleted = false;
create index ix_exercise_discomfort_user_day on exercise_discomfort (created_by, noted_on);
