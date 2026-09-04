-- Proactive coaching S5 (mezo-d58h.5, spec 2026-09-03 §6): one dated occurrence of a RECURRING
-- sport slot, hidden. Deliberately keyed on the slot's IDENTITY (weekday + clock time), NOT on
-- sport_schedule_slot.id: that table is FULL-REPLACED on every schedule save (soft-delete +
-- re-insert), so an id-keyed skip would point at a dead row after the user's first schedule edit
-- and silently stop working. Moving a slot to another time therefore does not carry its skip along
-- — correct, because that is a different session.
create table sport_slot_skip (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    day_of_week smallint    not null,
    time        varchar(5)  not null,
    date        date        not null,
    constraint pk_sport_slot_skip_id primary key (id),
    constraint fk_sport_slot_skip_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_sport_slot_skip_day_of_week check (day_of_week between 0 and 6)
);
-- One skip per (user, slot identity, date); the partial index mirrors the soft-delete convention.
create unique index uq_sport_slot_skip_slot_date
    on sport_slot_skip (created_by, day_of_week, time, date) where is_deleted = false;
create index idx_sport_slot_skip_date on sport_slot_skip (created_by, date) where is_deleted = false;
