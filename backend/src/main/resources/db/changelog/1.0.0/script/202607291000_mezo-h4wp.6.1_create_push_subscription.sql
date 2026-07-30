-- Web Push device subscriptions (bd mezo-h4wp.6.1): one live row per device endpoint per user.
-- The endpoint is the push service URL; p256dh/auth are the browser-supplied RFC 8291 key material.
-- last_success_at is a diagnostic (last 201 from the push service), never a delivery gate.
create table push_subscription (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    endpoint        text         not null,
    p256dh          varchar(120) not null,
    auth            varchar(40)  not null,
    user_agent      varchar(300),
    last_success_at timestamptz,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    constraint pk_push_subscription primary key (id),
    constraint fk_push_subscription_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);

-- One LIVE subscription per (user, endpoint): re-subscribing the same device must not duplicate,
-- while a soft-deleted row never blocks a fresh registration (the briefing partial-unique idiom).
create unique index uq_push_subscription_created_by_endpoint
    on push_subscription (created_by, endpoint) where is_deleted = false;
