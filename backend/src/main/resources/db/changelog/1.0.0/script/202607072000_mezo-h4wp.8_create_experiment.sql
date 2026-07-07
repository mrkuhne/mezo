-- Proactive P2 (bd mezo-h4wp.8, roadmap §P2): N=1 experiments (propose → L2 accept → track → outcome).
-- status lifecycle: proposed → active → completed | proposed → dismissed. outcome_good NULLABLE
-- (null = completed but inconclusive — no data); start_date null until accepted.

create table experiment (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    title              varchar(200)  not null,
    hypothesis         text          not null,
    status             varchar(10)   not null default 'proposed',
    metric_key         varchar(40)   not null,
    expected_direction varchar(8)    not null,
    start_date         date,
    total_days         int           not null,
    outcome            text,
    outcome_good       boolean,
    generated_at       timestamptz   not null,
    constraint pk_experiment_id primary key (id),
    constraint fk_experiment_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_experiment_expected_direction check (expected_direction in ('up', 'down', 'stable')),
    constraint ck_experiment_status check (status in ('proposed', 'active', 'completed', 'dismissed'))
);

create index idx_experiment_created_by_status on experiment (created_by, status) where is_deleted = false;
