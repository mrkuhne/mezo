-- Account gamification ledger (mezo-huzd): profile state + coin events + bought shop titles.
create table gamification_profile (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid        not null,
    is_deleted         boolean     not null default false,
    created_at         timestamptz not null default now(),
    coins              int         not null default 0,
    streak_days        int         not null default 0,
    streak_savers      int         not null default 0,
    equipped_title_key varchar(40) not null default 'ujonc',
    last_streak_date   date,
    account_level      int         not null default 1,
    constraint pk_gamification_profile primary key (id),
    constraint fk_gamification_profile_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_gamification_profile_savers check (streak_savers between 0 and 2)
);
create unique index uq_gamification_profile_user
    on gamification_profile (created_by) where is_deleted = false;

create table coin_event (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    reason        varchar(16) not null,
    amount        int         not null,
    source_ref_id varchar(64) not null,
    occurred_on   date        not null,
    constraint pk_coin_event primary key (id),
    constraint fk_coin_event_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_coin_event_reason check (reason in
        ('quest','all3','level_up','streak_7','streak_30','streak_100','saver_used','purchase'))
);
create unique index uq_coin_event_user_reason_ref
    on coin_event (created_by, reason, source_ref_id) where is_deleted = false;
create index idx_coin_event_user_day
    on coin_event (created_by, occurred_on) where is_deleted = false;

create table owned_title (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    title_key   varchar(40) not null,
    acquired_at timestamptz not null default now(),
    constraint pk_owned_title primary key (id),
    constraint fk_owned_title_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_owned_title_user_key
    on owned_title (created_by, title_key) where is_deleted = false;
