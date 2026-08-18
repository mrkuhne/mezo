-- needs_day: one live row per user+date = the day's Életjel-ring snapshot at Napzárás,
-- with the awarded bonus XP and the "Életben tartva" streak as of that close (mezo-dhzk).
create table needs_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    needs_date  date        not null,
    energia     int         not null,
    hidratacio  int         not null,
    pihenes     int         not null,
    mozgas      int         not null,
    lelek       int         not null,
    rend        int         not null,
    green_count int         not null,
    all_green   boolean     not null,
    xp_awarded  int         not null,
    streak_days int         not null,
    constraint pk_needs_day primary key (id),
    constraint fk_needs_day_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_needs_day_energia    check (energia    between 0 and 100),
    constraint ck_needs_day_hidratacio check (hidratacio between 0 and 100),
    constraint ck_needs_day_pihenes    check (pihenes    between 0 and 100),
    constraint ck_needs_day_mozgas     check (mozgas     between 0 and 100),
    constraint ck_needs_day_lelek      check (lelek      between 0 and 100),
    constraint ck_needs_day_rend       check (rend       between 0 and 100)
);
create unique index uq_needs_day_user_date
    on needs_day (created_by, needs_date) where is_deleted = false;
