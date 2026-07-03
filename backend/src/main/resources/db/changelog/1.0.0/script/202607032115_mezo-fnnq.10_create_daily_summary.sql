-- Phase 3 V2.2 daily summaries (bd mezo-fnnq.10, roadmap §V2.2).
-- One generated Hungarian past-tense narrative per finished day — the L1 episodic memory's
-- primary narrative unit (spec §7: embed narrative units, never raw rows).

create table daily_summary (
    id           uuid         not null default gen_random_uuid(),
    created_by   uuid         not null,
    is_deleted   boolean      not null default false,
    created_at   timestamptz  not null default now(),
    summary_date date         not null,
    narrative    text         not null,
    constraint pk_daily_summary_id primary key (id),
    constraint fk_daily_summary_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

-- Partial UNIQUE index (not a table constraint): one LIVE summary per user+day, while a
-- soft-deleted row does not block regeneration (delete row -> next night regenerates).
-- Doubles as the lookup index — every query filters is_deleted = false (@SQLRestriction),
-- so no separate (created_by, summary_date) index is needed.
create unique index uq_daily_summary_created_by_summary_date
    on daily_summary (created_by, summary_date) where is_deleted = false;
