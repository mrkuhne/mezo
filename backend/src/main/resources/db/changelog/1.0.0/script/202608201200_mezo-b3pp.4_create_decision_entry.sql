-- Phase 5 W1.4 (bd mezo-b3pp.4, spec §4.1 / §5.4): decisions with their context frozen.
-- context_snapshot is captured SERVER-side at write time (ContextSnapshotAssembler.render) —
-- the point is what the system knew, unfalsified, so the client never supplies it.
create table decision_entry (
    id               uuid        not null default gen_random_uuid(),
    created_by       uuid        not null,
    is_deleted       boolean     not null default false,
    created_at       timestamptz not null default now(),
    decided_on       date        not null,
    decision_text    text        not null,
    context_snapshot jsonb       not null,
    review_due       date        not null,
    reviewed_at      timestamptz,
    outcome_rating   smallint,
    outcome_text     text,
    constraint pk_decision_entry_id primary key (id),
    constraint fk_decision_entry_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_decision_entry_outcome_rating check (outcome_rating is null or outcome_rating between 1 and 5)
);

create index idx_decision_entry_created_by_review_due on decision_entry (created_by, review_due);
