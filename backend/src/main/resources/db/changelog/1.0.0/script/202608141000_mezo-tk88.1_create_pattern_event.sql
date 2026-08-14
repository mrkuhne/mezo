-- Minták lifecycle dashboard S1 (bd mezo-tk88.1, spec 2026-08-14 §Backend 1).
-- Append-only pattern history: one snapshot per LIVE nightly evaluation (confirmed rows
-- included — the judged row's stats stay FROZEN, only history accrues) + discrete
-- decision/reinforce/promote events. Band-crossing journal lines are DERIVED from
-- snapshots at render time, never stored. Rejected rows stay silent (no snapshot).

create table pattern_event (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    pattern_id  uuid        not null,
    kind        varchar(16) not null,
    occurred_at timestamptz not null default now(),
    payload     jsonb       not null default '{}'::jsonb,
    constraint pk_pattern_event_id primary key (id),
    constraint fk_pattern_event_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_pattern_event_pattern_id_pattern_id foreign key (pattern_id) references pattern (id) on delete cascade,
    constraint ck_pattern_event_kind check (kind in ('snapshot', 'confirmed', 'monitoring', 'rejected', 'reinforced', 'promoted'))
);

-- The detail read's ordering key (findByCreatedByAndPatternId...OrderByOccurredAtAsc).
create index idx_pattern_event_pattern_id_occurred_at on pattern_event (pattern_id, occurred_at);
