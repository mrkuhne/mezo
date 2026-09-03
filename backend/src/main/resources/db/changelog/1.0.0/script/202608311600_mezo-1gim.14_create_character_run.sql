-- Karakter S9 Gépterem honesty spine (bd mezo-1gim.14, spec 2026-09-01-character-slice9-gepterem):
-- the four Karakter pipelines (nightly observation pass, weekly konzílium, monthly deep read,
-- bootstrap konzílium) leave no trace of a run that produced nothing — a quiet night is
-- indistinguishable from a night the pipeline never ran at all. character_run is written by
-- every one of the four, including on a zero-signal quiet night, so the Gépterem view can
-- honestly render "csendes éjszaka · 0 hívás" instead of either fabricating a quiet night or
-- showing "nincs adat" for a night that WAS processed.

create table character_run (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid        not null,
    is_deleted         boolean     not null default false,
    created_at         timestamptz not null default now(),
    kind               varchar(10) not null,
    day                date        not null,
    observation_count  int         not null default 0,
    call_count         int         not null default 0,
    detector_keys      jsonb       not null,
    expert_keys        jsonb       not null,
    conference_id      uuid,
    generated_at       timestamptz not null,
    constraint pk_character_run_id primary key (id),
    constraint fk_character_run_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_run_kind check (kind in ('NIGHTLY', 'WEEKLY', 'MONTHLY', 'BOOTSTRAP'))
);

create unique index uq_character_run_created_by_kind_day
    on character_run (created_by, kind, day) where is_deleted = false;
