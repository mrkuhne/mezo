create table habit_def (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    habit_key varchar(40) not null,
    chain_id uuid not null,
    position int not null,
    title varchar(80) not null,
    why text,
    anchor_copy varchar(120),
    mode varchar(7) not null,
    metric varchar(40) not null,
    skill_key varchar(40) not null,
    skill_kind varchar(4) not null default 'LIFE',
    xp int not null,
    link_url text,
    is_active boolean not null default true,
    constraint pk_habit_def_id primary key (id),
    constraint fk_habit_def_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_habit_def_chain foreign key (chain_id) references habit_chain (id),
    constraint ck_habit_def_mode check (mode in ('DERIVED', 'MANUAL')),
    constraint ck_habit_def_skill_kind check (skill_kind = 'LIFE'),
    constraint ck_habit_def_xp check (xp between 5 and 15),
    constraint ck_habit_def_position check (position >= 1)
);

create unique index uq_habit_def_user_key
    on habit_def (created_by, habit_key) where is_deleted = false;
create index idx_habit_def_user_chain on habit_def (created_by, chain_id);
