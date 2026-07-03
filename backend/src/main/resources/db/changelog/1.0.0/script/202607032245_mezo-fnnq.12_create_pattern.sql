-- Phase 3 V3.1 pattern engine (bd mezo-fnnq.12, roadmap §V3.1).
-- One row per detected correlation: kind=statistical from the nightly Pearson job (V3.1);
-- kind=ai_hypothesis from the weekly LLM loop (V3.2). Small-n honesty: confidence is NULL for
-- statistical rows — never a fabricated number (spec §6/§8).

create table pattern (
    id               uuid         not null default gen_random_uuid(),
    created_by       uuid         not null,
    is_deleted       boolean      not null default false,
    created_at       timestamptz  not null default now(),
    kind             varchar(16)  not null,
    pair_key         varchar(64)  not null,
    category         varchar(16)  not null,
    category_label   varchar(40)  not null,
    title            varchar(200) not null,
    mechanism        text,
    evidence         jsonb        not null,
    r                numeric(6,4),
    n                integer,
    p                numeric(7,6),
    confidence       numeric(4,3),
    critique         jsonb,
    status           varchar(16)  not null default 'proposed',
    promoted_fact_id uuid,
    last_detected_at timestamptz  not null default now(),
    constraint pk_pattern_id primary key (id),
    constraint fk_pattern_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_pattern_promoted_fact_id_knowledge_fact_id foreign key (promoted_fact_id) references knowledge_fact (id) on delete set null,
    constraint ck_pattern_kind check (kind in ('statistical', 'ai_hypothesis')),
    constraint ck_pattern_category check (category in ('physiology', 'trigger', 'response')),
    constraint ck_pattern_status check (status in ('proposed', 'monitoring', 'confirmed', 'rejected'))
);

-- Pattern identity for the nightly upsert: one LIVE row per (user, kind, pair) — partial so a
-- soft-deleted row doesn't block re-detection.
create unique index uq_pattern_created_by_kind_pair_key
    on pattern (created_by, kind, pair_key) where is_deleted = false;

create index idx_pattern_created_by_status on pattern (created_by, status);
