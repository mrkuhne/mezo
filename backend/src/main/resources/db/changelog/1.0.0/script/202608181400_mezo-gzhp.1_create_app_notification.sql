-- Notification center F1 (bd mezo-gzhp.1, spec 2026-08-18 §3).
-- The AI-brain event outbox: one row per notifiable event, HU copy composed at emit
-- time (single copy source for the in-app bell AND the push body). dedup_key is the
-- occurrence identity — the partial unique makes emit idempotent across the cron +
-- lazy-GET double generation paths (memoir/prediction/experiment).

create table app_notification (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    kind        varchar(32)  not null,
    title       varchar(120) not null,
    body        varchar(300),
    deeplink    varchar(200) not null,
    ref_id      uuid,
    dedup_key   varchar(80)  not null,
    occurred_at timestamptz  not null default now(),
    read_at     timestamptz,
    constraint pk_app_notification_id primary key (id),
    constraint fk_app_notification_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_app_notification_created_by_dedup_key
    on app_notification (created_by, dedup_key) where is_deleted = false;
-- The feed read: newest-first per owner.
create index idx_app_notification_created_by_occurred_at
    on app_notification (created_by, occurred_at desc);
