-- Boop B1 (mezo-r36n9.11): per-sample Apple Health data with provenance (discrete types: heart rate
-- buckets, HRV, SpO2, wrist temperature, VO2max, body composition, mindful sessions, ...). Upserted by
-- the client's external id (HK uuid, or a derived bucket key); deletions soft-delete by external id.
create table health_sample (
    id            uuid             not null default gen_random_uuid(),
    created_by    uuid             not null,
    is_deleted    boolean          not null default false,
    created_at    timestamptz      not null default now(),
    updated_at    timestamptz      not null default now(),
    external_id   varchar(64)      not null,
    metric        varchar(40)      not null,
    start_at      timestamptz      not null,
    end_at        timestamptz      not null,
    value         double precision,
    unit          varchar(16),
    source_name   varchar(80),
    source_bundle varchar(120),
    device        varchar(80),
    user_entered  boolean          not null default false,
    meta          jsonb,
    constraint pk_health_sample_id primary key (id),
    constraint fk_health_sample_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_health_sample_owner_external unique (created_by, external_id),
    constraint ck_health_sample_metric check (metric in ('heart_rate', 'hrv_sdnn', 'respiratory_rate',
        'oxygen_saturation', 'wrist_temperature', 'vo2max', 'hr_recovery_1min', 'walking_hr_avg', 'body_mass',
        'body_fat_pct', 'lean_body_mass', 'mindful_session', 'state_of_mind', 'sleeping_breathing_disturbances'))
);
create index idx_health_sample_owner_metric_start on health_sample (created_by, metric, start_at);
