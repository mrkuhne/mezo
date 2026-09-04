-- lint-liquibase: allow-insert
-- Shared RAG memory platform foundation (bd mezo-6dii.1).
-- The existing memory_embedding table remains the OLD serving source throughout the chat pilot.

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

create table memory_item (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    source_kind varchar(32) not null,
    source_id uuid not null,
    title text,
    content text not null,
    search_text text not null,
    occurred_on date not null,
    content_hash varchar(64) not null,
    schema_version integer not null,
    topics text[] not null default '{}',
    people text[] not null default '{}',
    salience numeric(4,3) not null default 0.500,
    valid_from date,
    valid_to date,
    state varchar(16) not null default 'active',
    superseded_by uuid,
    provenance jsonb not null default '{}',
    search_vector tsvector generated always as
        (to_tsvector('simple', coalesce(search_text, ''))) stored,
    constraint pk_memory_item_id primary key (id),
    constraint uq_memory_item_id_created_by unique (id, created_by),
    constraint uq_memory_item_owner_source unique (created_by, source_kind, source_id),
    constraint fk_memory_item_created_by_app_user_id foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint fk_memory_item_superseded_by_memory_item_id foreign key (superseded_by)
        references memory_item (id) on delete set null,
    constraint ck_memory_item_state check (state in ('active', 'suppressed', 'superseded')),
    constraint ck_memory_item_salience check (salience between 0 and 1),
    constraint ck_memory_item_schema_version check (schema_version > 0),
    constraint ck_memory_item_content_hash check (content_hash ~ '^[0-9a-f]{64}$'),
    constraint ck_memory_item_validity check
        (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index idx_memory_item_created_by_state_occurred_on
    on memory_item (created_by, state, occurred_on desc);
create index idx_memory_item_created_by_source
    on memory_item (created_by, source_kind, source_id);
create index idx_memory_item_search_vector on memory_item using gin (search_vector);
create index idx_memory_item_search_text_trgm on memory_item using gin (search_text gin_trgm_ops);
create index idx_memory_item_superseded_by on memory_item (superseded_by);

create table memory_vector (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    memory_item_id uuid not null,
    embedding_version varchar(80) not null,
    provider varchar(32) not null,
    model varchar(120) not null,
    dimensions smallint not null,
    embedding vector(768),
    embedded_content_hash varchar(64) not null,
    status varchar(16) not null,
    failure_code varchar(100),
    constraint pk_memory_vector_id primary key (id),
    constraint uq_memory_vector_item_version unique (memory_item_id, embedding_version),
    constraint fk_memory_vector_created_by_app_user_id foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint fk_memory_vector_item_owner foreign key (memory_item_id, created_by)
        references memory_item (id, created_by) on delete cascade,
    constraint ck_memory_vector_dimensions check (dimensions = 768),
    constraint ck_memory_vector_status check (status in ('pending', 'ready', 'failed')),
    constraint ck_memory_vector_content_hash check (embedded_content_hash ~ '^[0-9a-f]{64}$'),
    constraint ck_memory_vector_ready_embedding check (status <> 'ready' or embedding is not null)
);

create index idx_memory_vector_created_by_version_status
    on memory_vector (created_by, embedding_version, status);
create index idx_memory_vector_created_by_item_version
    on memory_vector (created_by, memory_item_id, embedding_version);
create index idx_memory_vector_embedding_hnsw on memory_vector
    using hnsw (embedding vector_cosine_ops)
    where is_deleted = false and status = 'ready' and embedding is not null;

create table memory_retrieval_run (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    consumer_policy varchar(32) not null,
    query_mode varchar(16) not null,
    raw_query text not null,
    rewritten_query text,
    embedding_version varchar(80) not null,
    shadow_embedding_version varchar(80),
    serving_mode varchar(16) not null,
    duration_ms bigint not null,
    retriever_trace jsonb not null default '{}',
    error_code varchar(100),
    trace_id uuid not null,
    constraint pk_memory_retrieval_run_id primary key (id),
    constraint uq_memory_retrieval_run_id_owner unique (id, created_by),
    constraint uq_memory_retrieval_run_trace_id unique (trace_id),
    constraint fk_memory_retrieval_run_owner foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint ck_memory_retrieval_run_policy check
        (consumer_policy in ('CHAT_AMBIENT', 'MORNING_BRIEFING', 'WEEKLY_MEMOIR', 'PREDICTION_EVIDENCE')),
    constraint ck_memory_retrieval_run_query_mode check (query_mode in ('NONE', 'RAW', 'REWRITE')),
    constraint ck_memory_retrieval_run_serving check (serving_mode in ('OLD', 'SHADOW', 'NEW')),
    constraint ck_memory_retrieval_run_duration check (duration_ms >= 0)
);

create index idx_memory_retrieval_run_owner_created_at
    on memory_retrieval_run (created_by, created_at desc);

create table memory_retrieval_result (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    run_id uuid not null,
    candidate_kind varchar(32) not null,
    candidate_ref_id uuid not null,
    memory_item_id uuid,
    rank integer not null,
    selected boolean not null default false,
    content_snapshot text not null,
    occurred_on date,
    score_breakdown jsonb not null default '{}',
    constraint pk_memory_retrieval_result_id primary key (id),
    constraint uq_memory_retrieval_result_id_run_owner unique (id, run_id, created_by),
    constraint uq_memory_retrieval_result_run_rank unique (run_id, rank),
    constraint fk_memory_retrieval_result_owner foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint fk_memory_retrieval_result_run_owner foreign key (run_id, created_by)
        references memory_retrieval_run (id, created_by) on delete cascade,
    constraint fk_memory_retrieval_result_item_owner foreign key (memory_item_id, created_by)
        references memory_item (id, created_by) on delete set null (memory_item_id),
    constraint ck_memory_retrieval_result_rank check (rank > 0)
);

create index idx_memory_retrieval_result_owner_run_rank
    on memory_retrieval_result (created_by, run_id, rank);
create index idx_memory_retrieval_result_owner_item
    on memory_retrieval_result (created_by, memory_item_id);

create table memory_retrieval_feedback (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    run_id uuid not null,
    result_id uuid not null,
    memory_item_id uuid,
    action varchar(16) not null,
    constraint pk_memory_retrieval_feedback_id primary key (id),
    constraint fk_memory_retrieval_feedback_owner foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint fk_memory_retrieval_feedback_result_owner
        foreign key (result_id, run_id, created_by)
        references memory_retrieval_result (id, run_id, created_by) on delete cascade,
    constraint fk_memory_retrieval_feedback_item_owner foreign key (memory_item_id, created_by)
        references memory_item (id, created_by) on delete set null (memory_item_id),
    constraint ck_memory_retrieval_feedback_action
        check (action in ('useful', 'irrelevant', 'suppress'))
);

create unique index uq_memory_retrieval_feedback_owner_result_active
    on memory_retrieval_feedback (created_by, result_id) where is_deleted = false;
create index idx_memory_retrieval_feedback_owner_run
    on memory_retrieval_feedback (created_by, run_id);

alter table knowledge_fact
    add column pinned boolean not null default false,
    add column valid_from date,
    add column valid_to date,
    add column superseded_by uuid,
    add column conflicts_with uuid,
    add column provenance jsonb not null default '{}',
    add constraint fk_knowledge_fact_superseded_by
        foreign key (superseded_by) references knowledge_fact (id) on delete set null,
    add constraint fk_knowledge_fact_conflicts_with
        foreign key (conflicts_with) references knowledge_fact (id) on delete set null,
    add constraint ck_knowledge_fact_validity
        check (valid_to is null or valid_from is null or valid_to >= valid_from);

create index idx_knowledge_fact_owner_pinned_validity
    on knowledge_fact (created_by, pinned, valid_from, valid_to);
create index idx_knowledge_fact_superseded_by on knowledge_fact (superseded_by);
create index idx_knowledge_fact_conflicts_with on knowledge_fact (conflicts_with);

insert into memory_item (
    id, created_by, is_deleted, created_at, updated_at, source_kind, source_id, content,
    search_text, occurred_on, content_hash, schema_version, provenance
)
select m.id, m.created_by, false, m.created_at, m.created_at, m.kind, m.ref_id, m.content,
       lower(unaccent(m.content)), m.occurred_on, encode(digest(m.content, 'sha256'), 'hex'), 1,
       jsonb_build_object('sourceTable', 'memory_embedding', 'projectorVersion', 'legacy-v1')
from memory_embedding m
where m.is_deleted = false
on conflict (created_by, source_kind, source_id) do nothing;

insert into memory_vector (
    created_by, created_at, memory_item_id, embedding_version, provider, model, dimensions,
    embedding, embedded_content_hash, status
)
select m.created_by, m.created_at, i.id, 'gemini-embedding-001-768-v1', 'google',
       'gemini-embedding-001', 768, m.embedding,
       encode(digest(m.content, 'sha256'), 'hex'), 'ready'
from memory_embedding m
join memory_item i on i.created_by = m.created_by and i.source_kind = m.kind and i.source_id = m.ref_id
where m.is_deleted = false
on conflict (memory_item_id, embedding_version) do nothing;

do $$
begin
    if exists (
        select 1 from memory_embedding m
        left join memory_item i on i.id = m.id and i.created_by = m.created_by
        where m.is_deleted = false and i.id is null
    ) then
        raise exception 'memory platform backfill missing canonical item';
    end if;

    if exists (
        select 1 from memory_item i
        left join memory_vector v on v.memory_item_id = i.id
          and v.embedding_version = 'gemini-embedding-001-768-v1' and v.status = 'ready'
        where i.is_deleted = false and v.id is null
    ) then
        raise exception 'memory platform backfill missing ready vector';
    end if;
end $$;
