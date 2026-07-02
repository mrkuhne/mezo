-- Fuel water logging (mezo-0z5): discrete owned water-intake entries; the Fuel-day rollup
-- (FuelDayResponse.consumed.water) becomes sum(amount_ml) for the day, replacing the
-- targets-echo placeholder. Discrete rows (not a per-day counter) so a mis-tap is undoable.
create table water_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    log_date   date        not null,
    amount_ml  integer     not null,
    constraint pk_water_log_id primary key (id),
    constraint fk_water_log_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_water_log_amount_ml check (amount_ml > 0)
);

create index idx_water_log_created_by_log_date on water_log (created_by, log_date);
