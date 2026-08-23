-- Phase 5 W3.2 (bd mezo-b3pp.13, spec §4.3/§7.2): the consolidation ladder's rows — one
-- condensed narrative per finished week / month. Generated from the fine-grained rows
-- (daily_summary -> week, week -> month) and embedded as weekly_summary / monthly_summary;
-- the fine-grained rows are only SHADOWED in recall, never deleted (spec §12).
create table period_summary (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    granularity  varchar(5)  not null,
    period_start date        not null,
    summary_text text        not null,
    constraint pk_period_summary_id primary key (id),
    constraint fk_period_summary_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_period_summary unique (created_by, granularity, period_start),
    constraint ck_period_summary_granularity check (granularity in ('week', 'month'))
);

create index idx_period_summary_created_by_granularity on period_summary (created_by, granularity, period_start desc);
