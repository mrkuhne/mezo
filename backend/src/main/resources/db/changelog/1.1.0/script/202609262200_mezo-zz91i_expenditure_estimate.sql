-- Learned expenditure (bd mezo-zz91i, spec 2026-09-26-learned-expenditure-design §5.5):
-- one row per user per reviewed week. applied_base_kcal is what the goal serves as "Alap".
create table expenditure_estimate (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    week_start          date        not null,
    status              varchar(10) not null,
    formula_base_kcal   integer     not null,
    posterior_base_kcal integer     not null,
    posterior_sd_kcal   integer     not null,
    applied_base_kcal   integer     not null,
    step_kcal           integer     not null,
    direction           smallint    not null,
    confidence          varchar(6)  not null,
    usable_days         integer     not null,
    weigh_in_days       integer     not null,
    excluded_days       jsonb       not null default '[]'::jsonb,
    constraint pk_expenditure_estimate_id primary key (id),
    constraint fk_expenditure_estimate_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_expenditure_estimate_status check (status in ('LEARNING', 'UPDATED', 'STABLE', 'HOLDING')),
    constraint ck_expenditure_estimate_confidence check (confidence in ('LOW', 'MEDIUM', 'HIGH'))
);

create unique index uq_expenditure_estimate_user_week
    on expenditure_estimate (created_by, week_start) where is_deleted = false;
