-- The FE-owned recurring notification schedule snapshot (bd mezo-h4wp.6.3). Categories with
-- no backend anchor (NotificationCategory.feWritten(): checkin, fuel_slot) have their recurring
-- times known only to the frontend, so the client PUTs its own entries here. Maintained via
-- full replace per category (soft-delete the category's live rows, re-insert the new set), so a
-- category legitimately holds many rows at once — deliberately NO unique index.
create table notification_schedule (
    id         uuid         not null default gen_random_uuid(),
    created_by uuid         not null,
    weekday    smallint,
    time       varchar(5)   not null,
    category   varchar(24)  not null,
    title      varchar(120) not null,
    body       varchar(300),
    deeplink   varchar(200) not null,
    source     varchar(24)  not null,
    is_deleted boolean      not null default false,
    created_at timestamptz  not null default now(),
    constraint pk_notification_schedule primary key (id),
    constraint fk_notification_schedule_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    -- NULL means "every day" and is unaffected by a range CHECK (NULL is never FALSE in SQL).
    constraint ck_notification_schedule_weekday check (weekday between 1 and 7)
);

-- Non-unique: a category legitimately has many rows (one per weekday/time) — see file header.
create index idx_notification_schedule_created_by_category
    on notification_schedule (created_by, category);
