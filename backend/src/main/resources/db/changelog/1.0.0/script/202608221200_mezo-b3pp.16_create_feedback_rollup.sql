-- Phase 5 W4.2 (bd mezo-b3pp.16, spec §4.4/§8.2): nightly rollup-only aggregation over
-- message_feedback — per-surface effectiveness + per-surface style (down-reason) histograms.
-- Recomputed IN PLACE nightly; the upsert identity is (created_by, scope, window_days). The
-- reinforcement layer (graph-node edge weighting) is a later, switch-guarded slice and does not
-- touch this table.
create table feedback_rollup (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    scope       varchar(40) not null,
    window_days int         not null,
    stats       jsonb       not null,
    computed_at timestamptz not null,
    constraint pk_feedback_rollup_id primary key (id),
    constraint fk_feedback_rollup_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_feedback_rollup_scope unique (created_by, scope, window_days),
    constraint ck_feedback_rollup_scope check (scope = 'style' or scope like 'surface:%' or scope like 'feed:%'),
    constraint ck_feedback_rollup_window_days check (window_days > 0)
);

create index idx_feedback_rollup_created_by_scope on feedback_rollup (created_by, scope);
