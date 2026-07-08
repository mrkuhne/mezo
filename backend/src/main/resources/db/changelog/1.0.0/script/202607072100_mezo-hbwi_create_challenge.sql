-- Workout challenges (bd mezo-hbwi): companion proposes per-exercise PR/Depth/Volume micro-challenges;
-- L2 accept; deterministic hit/miss/inconclusive from logged sets. Identity = (created_by,
-- template_session_id, workout_date); exercise_id = the TEMPLATE exercise (logged sets FK to it).
-- outcome_good NULLABLE (null = inconclusive, no logged sets); confidence NULLABLE ("tanulom").

create table challenge (
    id                  uuid          not null default gen_random_uuid(),
    created_by          uuid          not null,
    is_deleted          boolean       not null default false,
    created_at          timestamptz   not null default now(),
    template_session_id uuid          not null,
    workout_date        date          not null,
    exercise_id         uuid          not null,
    exercise_name       varchar(120)  not null,
    type                varchar(10)   not null,
    status              varchar(12)   not null default 'proposed',
    risk                varchar(4)    not null default 'low',
    title               varchar(120)  not null,
    why                 text          not null,
    glory               varchar(200)  not null,
    target_weight_kg    numeric(6,2),
    target_reps         integer,
    target_sets         integer,
    target_rir          integer,
    confidence          numeric(4,3),
    refs                jsonb         not null default '[]',
    outcome             text,
    outcome_good        boolean,
    generated_at        timestamptz   not null,
    constraint pk_challenge_id primary key (id),
    constraint fk_challenge_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_challenge_template_session foreign key (template_session_id) references workout_session (id) on delete cascade,
    constraint fk_challenge_exercise foreign key (exercise_id) references exercise (id) on delete cascade,
    constraint ck_challenge_type check (type in ('PR', 'Depth', 'Volume')),
    constraint ck_challenge_status check (status in ('proposed', 'accepted', 'dismissed', 'hit', 'miss', 'inconclusive')),
    constraint ck_challenge_risk check (risk in ('low', 'mid'))
);

create index idx_challenge_session_date on challenge (created_by, template_session_id, workout_date) where is_deleted = false;
