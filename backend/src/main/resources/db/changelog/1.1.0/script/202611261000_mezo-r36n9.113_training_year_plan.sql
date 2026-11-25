-- Boop Éves terv (mezo-r36n9.113): the year plan = an ordered list of blocks the owner may re-order and re-time.
-- One active plan per owner. Blocks link to a real mesocycle once started (ON DELETE SET NULL: a discarded mesocycle
-- just unlinks). The ordinal unique constraint is deferrable so a reorder can swap two ordinals in one transaction.
create table training_year_plan (
    id                    uuid         not null default gen_random_uuid(),
    created_by            uuid         not null,
    is_deleted            boolean      not null default false,
    created_at            timestamptz  not null default now(),
    updated_at            timestamptz  not null default now(),
    start_date            date         not null,
    status                varchar(10)  not null,
    block_weeks           smallint     not null,
    consolidation_weeks   smallint     not null,
    emphasis              text[]       not null default '{}',
    archived_at           timestamptz,
    constraint pk_training_year_plan_id primary key (id),
    constraint fk_training_year_plan_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_training_year_plan_status check (status in ('active', 'archived')),
    constraint ck_training_year_plan_monday check (extract(isodow from start_date) = 1),
    constraint ck_training_year_plan_block_weeks check (block_weeks between 4 and 8),
    constraint ck_training_year_plan_consolidation_weeks check (consolidation_weeks between 1 and 2)
);
create unique index uq_training_year_plan_one_active on training_year_plan (created_by)
    where status = 'active' and is_deleted = false;

create table training_year_block (
    id             uuid         not null default gen_random_uuid(),
    created_by     uuid         not null,
    is_deleted     boolean      not null default false,
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now(),
    plan_id        uuid         not null,
    ordinal        smallint     not null,
    kind           varchar(14)  not null,
    focus          text[]       not null default '{}',
    weeks          smallint     not null,
    gap_weeks      smallint     not null default 0,
    planned_start  date,
    mesocycle_id   uuid,
    status         varchar(10)  not null,
    adopted        boolean      not null default false,
    constraint pk_training_year_block_id primary key (id),
    constraint fk_training_year_block_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_training_year_block_plan_id_training_year_plan_id foreign key (plan_id) references training_year_plan (id) on delete cascade,
    constraint fk_training_year_block_mesocycle_id_mesocycle_id foreign key (mesocycle_id) references mesocycle (id) on delete set null,
    constraint uq_training_year_block_plan_ordinal unique (plan_id, ordinal) deferrable initially deferred,
    constraint ck_training_year_block_kind check (kind in ('upper', 'lower', 'consolidation')),
    constraint ck_training_year_block_status check (status in ('planned', 'running', 'done', 'skipped')),
    constraint ck_training_year_block_focus check (cardinality(focus) <= 2),
    constraint ck_training_year_block_weeks check (weeks between 1 and 8),
    constraint ck_training_year_block_gap check (gap_weeks >= 0)
);
create index idx_training_year_block_plan_id on training_year_block (plan_id);
create index idx_training_year_block_mesocycle_id on training_year_block (mesocycle_id) where mesocycle_id is not null;
