-- Companion-feed (bd mezo-gst9, spec §4): one generated feed message per user+day+kind.
-- Content is the typed jsonb envelope (eyebrow + body paragraphs + model-SELECTED refs).

create table companion_message (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    message_date date        not null,
    kind         varchar(16) not null,
    content      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_companion_message_id primary key (id),
    constraint fk_companion_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_companion_message_kind check (kind in ('morning','sleep','weight','midday','evening'))
);

-- Partial UNIQUE (the briefing precedent): one LIVE message per user+day+kind; soft-delete +
-- reinsert stays possible. Doubles as the lookup index.
create unique index uq_companion_message_created_by_date_kind
    on companion_message (created_by, message_date, kind) where is_deleted = false;
