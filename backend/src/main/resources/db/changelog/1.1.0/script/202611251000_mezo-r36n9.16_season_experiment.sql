-- Boop B6 Évad S4 (mezo-r36n9.16): experiments (the Hatás tab). A proposal (Boop ötlete) or his own experiment runs
-- `length_days` from `start_date`; he marks the days he did it (`marked_days`); when the window is over it is compared
-- with the same number of days before it (`result`, the evaluator's verdict + signals + overlaps). At most one
-- running and one open proposal per owner. `kept` = „Megtartom szokásnak” — a season rule line in every AI context.
create table season_experiment (
    id            uuid          not null default gen_random_uuid(),
    created_by    uuid          not null,
    is_deleted    boolean       not null default false,
    created_at    timestamptz   not null default now(),
    updated_at    timestamptz   not null default now(),
    season_id     uuid          not null,
    subject_kind  varchar(12)   not null,
    subject_ref   uuid,
    title         varchar(80)   not null,
    reason        text,
    start_date    date,
    length_days   smallint      not null default 14,
    status        varchar(10)   not null,
    marked_days   date[]        not null default '{}',
    result        jsonb,
    finished_on   date,
    kept          boolean       not null default false,
    constraint pk_season_experiment_id primary key (id),
    constraint fk_season_experiment_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_season_experiment_season_id_season_id foreign key (season_id) references season (id) on delete cascade,
    constraint ck_season_experiment_subject_kind check (subject_kind in ('supplement', 'recipe', 'food', 'habit', 'text')),
    constraint ck_season_experiment_length_days check (length_days between 7 and 28),
    constraint ck_season_experiment_status check (status in ('proposed', 'running', 'done', 'dismissed'))
);
create unique index uq_season_experiment_one_running on season_experiment (created_by)
    where status = 'running' and is_deleted = false;
create unique index uq_season_experiment_one_proposed on season_experiment (created_by)
    where status = 'proposed' and is_deleted = false;
create index idx_season_experiment_owner_status on season_experiment (created_by, status) where is_deleted = false;
