-- Phase 3 companion memory L3 (bd mezo-fnnq.6, roadmap §V1.1, spec §3):
-- knowledge_fact = confirmed, long-lived facts (top-N injected into every system prompt);
-- learned_fact = extraction candidates (candidate -> decision -> promoted_fact_id).
-- learned_fact is table-only in V1.1 — the extraction/decision flow arrives with V1.2.

create table knowledge_fact (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    fact_text           text        not null,
    category            varchar(16) not null,
    source              varchar(16) not null,
    reinforcement_count integer     not null default 0,
    include_in_prompt   boolean     not null default true,
    last_reinforced_at  timestamptz,
    constraint pk_knowledge_fact_id primary key (id),
    constraint fk_knowledge_fact_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_knowledge_fact_category check (category in ('train', 'fuel', 'health', 'life')),
    constraint ck_knowledge_fact_source check (source in ('chat', 'pattern', 'manual'))
);

-- the top-N injection query: owner + include_in_prompt filter, reinforcement ordering
create index idx_knowledge_fact_created_by_include_reinforcement
    on knowledge_fact (created_by, include_in_prompt, reinforcement_count desc);

create table learned_fact (
    id                      uuid        not null default gen_random_uuid(),
    created_by              uuid        not null,
    is_deleted              boolean     not null default false,
    created_at              timestamptz not null default now(),
    candidate_text          text        not null,
    derived_from_message_id uuid,
    user_decision           varchar(16),
    refined_text            text,
    promoted_fact_id        uuid,
    constraint pk_learned_fact_id primary key (id),
    constraint fk_learned_fact_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_learned_fact_derived_from_message_id_ai_message_id foreign key (derived_from_message_id) references ai_message (id) on delete set null,
    constraint fk_learned_fact_promoted_fact_id_knowledge_fact_id foreign key (promoted_fact_id) references knowledge_fact (id) on delete set null,
    -- null = undecided candidate (the V1.2 pending inbox); the check only bites once decided
    constraint ck_learned_fact_user_decision check (user_decision in ('accept', 'reject', 'refine'))
);

create index idx_learned_fact_created_by_user_decision on learned_fact (created_by, user_decision);
create index idx_learned_fact_derived_from_message_id on learned_fact (derived_from_message_id);
create index idx_learned_fact_promoted_fact_id on learned_fact (promoted_fact_id);
