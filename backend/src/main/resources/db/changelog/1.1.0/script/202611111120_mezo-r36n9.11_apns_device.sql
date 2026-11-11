-- Boop B1 (mezo-r36n9.11): native push registrations (no sending yet). One live row per device id;
-- a token registered by another account is moved by the upsert.
create table apns_device (
    id             uuid         not null default gen_random_uuid(),
    created_by     uuid         not null,
    is_deleted     boolean      not null default false,
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now(),
    device_id      uuid         not null,
    token          varchar(200) not null,
    environment    varchar(10)  not null,
    bundle_id      varchar(120) not null,
    app_version    varchar(20),
    last_seen_at   timestamptz  not null default now(),
    invalidated_at timestamptz,
    constraint pk_apns_device_id primary key (id),
    constraint fk_apns_device_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_apns_device_environment check (environment in ('sandbox', 'production'))
);
create unique index uq_apns_device_device_id_live on apns_device (device_id) where is_deleted = false;
