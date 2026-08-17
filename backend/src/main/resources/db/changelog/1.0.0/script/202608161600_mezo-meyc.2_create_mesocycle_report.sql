-- End-of-mesocycle close report (bd mezo-meyc.2, mesocycle close/report contract). One row per
-- closed mesocycle: the frozen adherence/volume/strength/records computed at close time, the
-- owner's self-eval note, and the optional AI-generated narrative eval (status-gated, generated
-- async — pending until the AI eval job runs).

create table mesocycle_report (
    id                   uuid        not null default gen_random_uuid(),
    created_by           uuid        not null,
    is_deleted           boolean     not null default false,
    created_at           timestamptz not null default now(),
    mesocycle_id         uuid        not null,
    report               jsonb,
    context              jsonb,
    self_eval            text,
    ai_eval              text,
    ai_eval_status       text        not null default 'pending',
    ai_eval_generated_at timestamptz,
    constraint pk_mesocycle_report_id primary key (id),
    constraint fk_mesocycle_report_user foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_mesocycle_report_mesocycle foreign key (mesocycle_id) references mesocycle (id) on delete cascade,
    constraint uq_mesocycle_report_mesocycle unique (mesocycle_id),
    constraint ck_mesocycle_report_ai_status check (ai_eval_status in ('pending', 'ready', 'failed'))
);

create index idx_mesocycle_report_created_by on mesocycle_report (created_by);
