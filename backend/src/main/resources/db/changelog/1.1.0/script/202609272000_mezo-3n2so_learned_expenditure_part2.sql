-- Learned expenditure Part 2 (bd mezo-3n2so, spec 2026-09-27-learned-expenditure-part2-design §6.1).
create table intake_day_mark (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    day         date        not null,
    status      varchar(10) not null,
    constraint pk_intake_day_mark_id primary key (id),
    constraint fk_intake_day_mark_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_intake_day_mark_status check (status in ('COMPLETE', 'INCOMPLETE'))
);
create unique index uq_intake_day_mark_user_day on intake_day_mark (created_by, day) where is_deleted = false;

-- The weekly summary's dismissal, per week, cross-device.
alter table expenditure_estimate add column dismissed_at timestamptz;

-- The learning switch (owner decision P3): on by default.
alter table diet_settings add column learning_enabled boolean not null default true;
