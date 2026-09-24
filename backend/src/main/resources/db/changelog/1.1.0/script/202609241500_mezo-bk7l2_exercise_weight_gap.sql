-- Per-machine weight memory (mezo-bk7l2): weights KNOWN to be missing on one exercise's machine,
-- learnt from near swaps on the live card (the user logs 95 where the engine prescribed 98).
-- Keyed by exercise IDENTITY (catalog id, else exact name — ExerciseHistoryResolver), never by the
-- template exercise row, whose id changes on every day edit. Logging a set at a gap weight heals it
-- (soft delete). Available weights are not stored: they are the weights ever logged.
create table exercise_weight_gap (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    identity_key text          not null,
    weight_kg    numeric(6, 2) not null,
    constraint pk_exercise_weight_gap_id primary key (id),
    constraint fk_exercise_weight_gap_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_exercise_weight_gap_weight_kg check (weight_kg > 0 and weight_kg <= 999)
);
create unique index uq_exercise_weight_gap_user_identity_weight
    on exercise_weight_gap (created_by, identity_key, weight_kg) where is_deleted = false;
