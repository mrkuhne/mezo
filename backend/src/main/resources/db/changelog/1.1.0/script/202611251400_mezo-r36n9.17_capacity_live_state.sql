-- Boop B7 K3 (mezo-r36n9.17): the live re-plan loop's memory — one row per owner. The last verdict it saw for today
-- (and whether today's gym session collided with an event then), so a later trigger proposes a today-change only
-- when the day got worse by a step or a constraint broke; and when it last proposed one (the min-interval limit).
create table capacity_live_state (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    day          date          not null,
    verdict      varchar(16)   not null,
    collides     boolean       not null default false,
    proposed_at  timestamptz,
    constraint pk_capacity_live_state_id primary key (id),
    constraint fk_capacity_live_state_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_capacity_live_state_owner unique (created_by)
);
