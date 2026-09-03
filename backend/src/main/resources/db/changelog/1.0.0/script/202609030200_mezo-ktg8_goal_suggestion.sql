-- Diet Plan slice 4 (bd mezo-ktg8, spec 2026-09-02-diet-plan-design §6.1/§6.5):
-- goal_suggestion = engine-proposed diet changes awaiting the owner's decision
-- (suggest + approve, never silent). One OPEN (proposed) row per (goal, kind);
-- dedup_key blocks re-proposing an input the owner already dismissed.
-- goal.segment_overrides = accepted per-week energy-balance overrides (deload weeks).

create table goal_suggestion (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    goal_id     uuid        not null,
    kind        varchar(20) not null,
    status      varchar(12) not null default 'proposed',
    dedup_key   varchar(160) not null,
    payload     jsonb       not null,
    decided_at  timestamptz,
    constraint pk_goal_suggestion_id primary key (id),
    constraint fk_goal_suggestion_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_goal_suggestion_goal_id_goal_id foreign key (goal_id) references goal (id) on delete cascade,
    constraint ck_goal_suggestion_kind check (kind in ('phase_change', 'weekly_correction')),
    constraint ck_goal_suggestion_status check (status in ('proposed', 'accepted', 'dismissed', 'superseded'))
);

-- One open proposal per kind per goal — a newer proposal must supersede, not coexist.
create unique index uq_goal_suggestion_open_per_kind
    on goal_suggestion (goal_id, kind) where status = 'proposed' and is_deleted = false;

-- Trigger-side dedup lookup: "was this exact input already decided?"
create index ix_goal_suggestion_goal_dedup on goal_suggestion (goal_id, dedup_key) where is_deleted = false;

-- Accepted deload overrides the projection engine folds into its week walk.
alter table goal add column segment_overrides jsonb;
