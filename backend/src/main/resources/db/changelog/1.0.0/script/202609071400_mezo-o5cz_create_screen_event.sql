-- Lean screen-event telemetry (bd mezo-o5cz, spec 2026-09-07 §3): ONE disposable table, one
-- event kind (`view`) in v1, a `meta jsonb` rider so a later kind can share it. Rows are NOT
-- history — ScreenEventRetentionJob hard-DELETEs past mezo.telemetry.retention-days.
--
-- `is_deleted` exists only because the entity extends OwnedEntity (that superclass mandates the
-- column); nothing ever sets it true, and the retention job deletes physically. Keeping the
-- column also keeps the table browsable in the admin data browser like every other owned table.
create table screen_event (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    screen      varchar(120) not null,
    event       varchar(24)  not null default 'view',
    occurred_at timestamptz  not null,
    meta        jsonb,
    constraint pk_screen_event_id primary key (id),
    constraint fk_screen_event_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create index idx_screen_event_user_time on screen_event (created_by, occurred_at);
create index idx_screen_event_screen_time on screen_event (screen, occurred_at);
