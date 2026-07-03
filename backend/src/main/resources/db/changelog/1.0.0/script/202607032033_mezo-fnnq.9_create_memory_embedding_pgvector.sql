-- Phase 3 V2.1 pgvector infra (bd mezo-fnnq.9, roadmap §V2.1).
-- Episodic memory vectors over NARRATIVE units (daily summaries, chat turns — spec §7);
-- raw numeric rows stay in SQL behind tools, they are never embedded.
-- vector(768) + HNSW + cosine is the surviving invariant (ADR 0008, bd mezo-c30 research).
-- Requires the pgvector/pgvector:pg16 image (compose + k3s swapped in this slice).

create extension if not exists vector;

create table memory_embedding (
    id          uuid         not null default gen_random_uuid(),
    created_by  uuid         not null,
    is_deleted  boolean      not null default false,
    created_at  timestamptz  not null default now(),
    kind        varchar(20)  not null,
    ref_id      uuid         not null,
    content     text         not null,
    embedding   vector(768)  not null,
    occurred_on date         not null,
    constraint pk_memory_embedding_id primary key (id),
    constraint fk_memory_embedding_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_memory_embedding_kind check (kind in ('chat_turn', 'daily_summary', 'weekly_summary')),
    -- One embedding per source unit — the V2.2 embed pipeline's idempotence anchor.
    constraint uq_memory_embedding_kind_ref_id unique (kind, ref_id)
);

-- Time/kind-scoped lookups (V2.2 backfill window, V2.3 recency ranking) — created_by leads per convention.
create index idx_memory_embedding_created_by_kind_occurred_on on memory_embedding (created_by, kind, occurred_on desc);

-- ANN search index — cosine ops to pair with the <=> operator (spec §7).
create index idx_memory_embedding_vector on memory_embedding using hnsw (embedding vector_cosine_ops);
