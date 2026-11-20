-- Boop Pénz L5 (mezo-r36n9.103): savings goals / purchase plans ("mire gyűjtök"). kind 'goal' is a pot the owner
-- fills over time, 'purchase' a planned buy. Money is HUF only, bigint minor units (1/100 Ft: 150 000 Ft =
-- 15000000). saved_minor is the owner's own running figure (not derived from transactions). A phone write is
-- idempotent on client_ref (partial unique per owner among live rows).
create table penz_savings_goal (
    id            uuid          not null default gen_random_uuid(),
    created_by    uuid          not null,
    is_deleted    boolean       not null default false,
    created_at    timestamptz   not null default now(),
    updated_at    timestamptz   not null default now(),
    name          varchar(80)   not null,
    kind          varchar(8)    not null,
    target_minor  bigint        not null,
    saved_minor   bigint        not null default 0,
    due_date      date,
    note          varchar(500),
    position      integer       not null default 0,
    client_ref    uuid,
    constraint pk_penz_savings_goal_id primary key (id),
    constraint fk_penz_savings_goal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_savings_goal_kind check (kind in ('goal', 'purchase')),
    constraint ck_penz_savings_goal_target_minor check (target_minor > 0),
    constraint ck_penz_savings_goal_saved_minor check (saved_minor >= 0),
    constraint ck_penz_savings_goal_position check (position >= 0)
);
create index idx_penz_savings_goal_created_by on penz_savings_goal (created_by) where is_deleted = false;
create unique index uq_penz_savings_goal_created_by_client_ref on penz_savings_goal (created_by, client_ref)
    where client_ref is not null and is_deleted = false;
