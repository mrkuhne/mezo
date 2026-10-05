-- Kihagyás S2 (mezo-q4xt2.2, spec 2026-09-28 §9): kímélő mód — a user-declared recovery period
-- opened by a serious skip reason. Every planned gym/sport/run occurrence on a protected date reads
-- as skipped + excused (PlannedSkipService, read time). It never ends by itself: ended_on is set only
-- by the user's "Jobban". The shift_* / prev_* columns snapshot the meso calendar change applied at
-- "Jobban", so "Mégsem vagyok jól" / "Tévedés volt" revert it exactly.
create table recovery_period (
    id                uuid         not null default gen_random_uuid(),
    created_by        uuid         not null,
    is_deleted        boolean      not null default false,
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now(),
    category          varchar(16)  not null,
    estimate          varchar(16)  not null,
    start_date        date         not null,
    expected_end      date,
    ended_on          date,
    last_check_date   date,
    comeback_waived   boolean      not null default false,
    shift_meso_id     uuid,
    shift_days        integer      not null default 0,
    prev_start        date,
    prev_end          date,
    prev_current_week integer,
    prev_last_run     varchar(8),
    prev_sets         jsonb,
    constraint pk_recovery_period_id primary key (id),
    constraint fk_recovery_period_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_recovery_period_category check (category in ('ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL')),
    constraint ck_recovery_period_estimate check (estimate in ('TODAY', 'FEW_DAYS', 'WEEK', 'UNKNOWN')),
    constraint ck_recovery_period_end check (ended_on is null or ended_on > start_date)
);
create unique index idx_recovery_period_one_open
    on recovery_period (created_by) where is_deleted = false and ended_on is null;
create index idx_recovery_period_user_start on recovery_period (created_by, start_date) where is_deleted = false;

-- "Ma mégis edzek": one released date inside a period (gym + sport + run of that day train normally).
create table recovery_day_release (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now(),
    period_id   uuid         not null,
    date        date         not null,
    lighten     boolean      not null default true,
    constraint pk_recovery_day_release_id primary key (id),
    constraint fk_recovery_day_release_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_recovery_day_release_period_id_recovery_period_id
        foreign key (period_id) references recovery_period (id) on delete cascade
);
create unique index idx_recovery_day_release_period_date
    on recovery_day_release (period_id, date) where is_deleted = false;
