-- Proactive coaching S5 (mezo-d58h.5, spec 2026-09-03 §6 item 1): a READ-TIME overlay that lowers
-- one date's gym targets. Deliberately NOT a template edit: exercises hang off the weekday TEMPLATE
-- row, so writing them would lighten every future occurrence of that weekday, and the only existing
-- write path (replaceDayExercises) soft-deletes and re-inserts every exercise with NEW UUIDs,
-- orphaning already-logged exercise_set rows. One row per user per date; undo is a delete.
create table workout_day_adjustment (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    date       date        not null,
    set_delta  smallint    not null,
    constraint pk_workout_day_adjustment_id primary key (id),
    constraint fk_workout_day_adjustment_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_workout_day_adjustment_set_delta check (set_delta between -3 and 0)
);
create unique index uq_workout_day_adjustment_user_date
    on workout_day_adjustment (created_by, date) where is_deleted = false;
