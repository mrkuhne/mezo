-- Boop B3 (mezo-r36n9.13, spec §7.4): the day-close record — one source of truth for the evening close
-- (rating, goal outcome, the plan goals as seen at close, the journal link, Boop's sentence). One live row per
-- owner and date. The close is dual-written into the legacy evening stores (daily_intention.reflection,
-- ritual_day.closed_at, the 20:00 check-in) so every existing reader keeps working.
create table day_close (
    id                uuid         not null default gen_random_uuid(),
    created_by        uuid         not null,
    is_deleted        boolean      not null default false,
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now(),
    close_date        date         not null,
    closed_at         timestamptz  not null,
    evening_energy    integer,
    day_rating        integer      not null,
    goal_text         text,
    goal_outcome      varchar(8),
    plan_goals        jsonb        not null default '[]'::jsonb,
    journal_entry_id  uuid,
    boop_line         text,
    boop_line_hash    varchar(64),
    client_ref        uuid         not null,
    constraint pk_day_close_id primary key (id),
    constraint fk_day_close_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_day_close_journal_entry_id_journal_entry_id foreign key (journal_entry_id) references journal_entry (id) on delete set null,
    constraint ck_day_close_goal_outcome check (goal_outcome in ('done', 'partial', 'no')),
    constraint ck_day_close_day_rating check (day_rating between 1 and 5),
    constraint ck_day_close_evening_energy check (evening_energy between 1 and 10)
);
create unique index uq_day_close_created_by_close_date on day_close (created_by, close_date) where is_deleted = false;

-- Boop's generated one-liners that have no day_close row to live on (a check-in's line, a web-closed day's
-- line), cached by the hash of everything the prompt was built from: the same inputs never call the model twice.
create table day_close_line_cache (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    input_hash  varchar(64)  not null,
    line        text         not null,
    constraint pk_day_close_line_cache_id primary key (id),
    constraint fk_day_close_line_cache_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_day_close_line_cache_created_by_input_hash on day_close_line_cache (created_by, input_hash)
    where is_deleted = false;
