-- Slice 8 Task 1 (bd mezo-76f6, plan 2026-09-09-admin-value-dashboard-slice8 Rulings): one
-- upsertable outcome signal per (owner, draft). Last signal wins per (created_by, draft_id) — a
-- later accepted/edited REPLACES an earlier discarded and vice versa, since the composer/wizard
-- can be reopened after a discard. Free slug (feature): no FK/CHECK on it, admin joins by slug.
create table ai_draft_outcome (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    feature    varchar(40) not null,
    draft_id   uuid        not null,
    outcome    varchar(10) not null,
    constraint pk_ai_draft_outcome_id primary key (id),
    constraint fk_ai_draft_outcome_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_ai_draft_outcome_owner_draft unique (created_by, draft_id),
    constraint ck_ai_draft_outcome_outcome check (outcome in ('accepted', 'edited', 'discarded'))
);

create index idx_ai_draft_outcome_created_by_feature on ai_draft_outcome (created_by, feature);
