-- Proactive H1 (bd mezo-h4wp.5, roadmap §H1): in-app heartbeat notes (napközbeni jelenlét).
-- One live row per user+day+window; window_key (NOT "window" — reserved word) = midday|evening,
-- kind = nudge|closing. Written by the window crons (or the lazy GET); never regenerated.

create table heartbeat_note (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    note_date    date        not null,
    window_key   varchar(16) not null,
    kind         varchar(16) not null,
    content      text        not null,
    generated_at timestamptz not null,
    constraint pk_heartbeat_note_id primary key (id),
    constraint fk_heartbeat_note_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_heartbeat_note_window_key check (window_key in ('midday', 'evening')),
    constraint ck_heartbeat_note_kind check (kind in ('nudge', 'closing'))
);

create unique index uq_heartbeat_note_created_by_note_date_window_key
    on heartbeat_note (created_by, note_date, window_key) where is_deleted = false;
