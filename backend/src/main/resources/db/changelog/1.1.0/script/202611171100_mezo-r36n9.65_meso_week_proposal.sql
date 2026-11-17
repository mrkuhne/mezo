-- Volume engine v2 (mezo-r36n9.65, spec §6.4): the weekly change to a run's set counts is a first-class record.
-- One row per proposal; `lines` holds one entry per changed exercise. At most one live `weekly` proposal per
-- run and week (a tier-change proposal may share the week). `plan_after` / `restore` map an exercise row id to
-- its sets. mesocycle.volume_model marks which engine drives a run (1 = legacy, 2 = v2).
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder).
create table meso_week_proposal (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    mesocycle_id  uuid         not null,
    week          integer      not null,
    kind          text         not null,
    status        text         not null,
    lines         jsonb        not null,
    plan_after    jsonb,
    restore       jsonb,
    decided_at    timestamptz,
    constraint pk_meso_week_proposal_id primary key (id),
    constraint fk_meso_week_proposal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_meso_week_proposal_mesocycle_id_mesocycle_id foreign key (mesocycle_id) references mesocycle (id) on delete cascade,
    constraint ck_meso_week_proposal_kind check (kind in ('weekly', 'tier_change')),
    constraint ck_meso_week_proposal_status check (status in ('pending', 'applied', 'auto_applied', 'expired', 'superseded'))
);
create unique index uq_meso_week_proposal_mesocycle_id_week_weekly on meso_week_proposal (mesocycle_id, week)
    where kind = 'weekly' and is_deleted = false;
create index idx_meso_week_proposal_mesocycle_id on meso_week_proposal (mesocycle_id);

alter table mesocycle add column volume_model smallint not null default 1;
