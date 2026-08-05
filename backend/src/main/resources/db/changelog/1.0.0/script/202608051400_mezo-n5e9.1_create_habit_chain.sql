create table habit_chain (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    chain_key varchar(40) not null,
    title varchar(80) not null,
    daypart varchar(8) not null,
    position int not null,
    is_active boolean not null default true,
    constraint ck_habit_chain_daypart check (daypart in ('MORNING', 'DAY', 'EVENING')),
    constraint ck_habit_chain_position check (position >= 1)
);

create unique index uq_habit_chain_user_key
    on habit_chain (created_by, chain_key) where is_deleted = false;
create index idx_habit_chain_user on habit_chain (created_by);
