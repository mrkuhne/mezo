-- ritual_day: one live row per user+date = the day was closed by the Napzárás ritual (mezo-hvmx).
create table ritual_day (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    ritual_date date       not null,
    closed_at  timestamptz not null,
    constraint pk_ritual_day primary key (id),
    constraint fk_ritual_day_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_ritual_day_user_date
    on ritual_day (created_by, ritual_date) where is_deleted = false;
