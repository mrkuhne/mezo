-- Per-category notification preferences + the per-day send ledger (bd mezo-h4wp.6.2).
-- A MISSING pref row means "the code default" (NotificationCategory), so a newly added
-- category ships with its intended default instead of silently arriving as OFF, and a
-- fresh install needs no seed data.
create table notification_pref (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    category     varchar(24) not null,
    enabled      boolean     not null,
    lead_minutes integer     not null default 0,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    constraint pk_notification_pref primary key (id),
    constraint fk_notification_pref_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_notification_pref_lead_minutes check (lead_minutes between 0 and 240)
);

create unique index uq_notification_pref_created_by_category
    on notification_pref (created_by, category) where is_deleted = false;

-- The dedup ledger: one row per (user, local day, dedupKey). Written BEFORE the send, so a
-- failed send never re-fires the same notification on the next minute — a lost notification
-- is strictly better than a duplicated one.
create table push_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    log_date   date        not null,
    dedup_key  varchar(80) not null,
    category   varchar(24) not null,
    sent_at    timestamptz not null default now(),
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    constraint pk_push_log primary key (id),
    constraint fk_push_log_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_push_log_created_by_log_date_dedup_key
    on push_log (created_by, log_date, dedup_key) where is_deleted = false;
