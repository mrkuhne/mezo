-- Fuel planner settings (bd mezo-53su, spec docs/superpowers/specs/2026-07-23-fuel-slot-timing-design.md).
-- Per-user singleton (intention_creed shape): eating cadence + caffeine cutoff move off the weight
-- goal / habit config into a Fuel-owned home. goal.meals_per_day stays on the wire, unread
-- (dropped later together with the retired wake/bed columns).

create table fuel_settings (
    id              uuid        not null default gen_random_uuid(),
    created_by      uuid        not null,
    is_deleted      boolean     not null default false,
    created_at      timestamptz not null default now(),
    meals_per_day   integer     not null,
    caffeine_cutoff varchar(5)  not null,
    constraint pk_fuel_settings_id primary key (id),
    constraint fk_fuel_settings_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_fuel_settings_meals_per_day check (meals_per_day between 3 and 6)
);
create unique index uq_fuel_settings_user on fuel_settings (created_by) where is_deleted = false;
