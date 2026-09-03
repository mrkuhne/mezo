-- Diagnosis (bd mezo-hqfi, spec 2026-08-31): mezo's first ON-DEMAND report. Many rows per user
-- accumulate over time (that longitudinal list is the point), so there is deliberately NO unique
-- constraint — unlike weekly_review, which is one row per week.
-- evidence/suspects are typed jsonb envelopes; evidence is FROZEN at generation time so the
-- report always shows the numbers it reasoned from.

create table diagnosis (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    phenomenon   varchar(30) not null,
    window_days  integer     not null,
    verdict      text        not null,
    confidence   varchar(10) not null,
    evidence     jsonb       not null,
    suspects     jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_diagnosis_id primary key (id),
    constraint fk_diagnosis_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_diagnosis_phenomenon check (phenomenon in ('fatigue')),
    constraint ck_diagnosis_confidence check (confidence in ('strong', 'moderate', 'weak'))
);

create index idx_diagnosis_created_by_generated_at on diagnosis (created_by, generated_at desc);
