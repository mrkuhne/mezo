-- Daily intention (bd mezo-a686): a standing creed + up to 3 daily foci + a holistic evening
-- reflection. No level_up_event CHECK change — intention XP rides the existing HABIT + QUEST tails.

create table intention_creed (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    text       varchar(280) not null,
    constraint pk_intention_creed_id primary key (id),
    constraint fk_intention_creed_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_intention_creed_user on intention_creed (created_by) where is_deleted = false;

create table intention_focus (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    focus_date date        not null,
    text       varchar(200) not null,
    constraint pk_intention_focus_id primary key (id),
    constraint fk_intention_focus_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create index idx_intention_focus_user_date on intention_focus (created_by, focus_date) where is_deleted = false;

create table daily_intention (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    intention_date date        not null,
    reflection     varchar(8)  not null,
    constraint pk_daily_intention_id primary key (id),
    constraint fk_daily_intention_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_daily_intention_reflection check (reflection in ('yes', 'partial', 'no'))
);
create unique index uq_daily_intention_user_date on daily_intention (created_by, intention_date) where is_deleted = false;
