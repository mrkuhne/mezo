-- Phase 5 W2.1 (bd mezo-b3pp.6, spec §4.2/§6.1, ADR 0031): knowledge-graph skeleton. Nodes
-- represent durable facts about Daniel (patterns, preferences, goals, life events, seasons,
-- insights incl. the W4.3 profile singleton); edges are typed, weighted relationships between
-- them. Both tables are populated by later slices (W2.2 promotion, W2.3 extraction) — this
-- migration only creates the schema.
create table knowledge_node (
    id          uuid default gen_random_uuid(),
    created_by  uuid not null,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    kind        varchar(12) not null,
    title       varchar(120) not null,
    summary     text,
    status      varchar(10) not null default 'active',
    source_kind varchar(20),
    source_id   uuid,
    occurred_on date,
    meta        jsonb,
    constraint pk_knowledge_node_id primary key (id),
    constraint fk_knowledge_node_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_knowledge_node_kind check (kind in ('PATTERN', 'PREFERENCE', 'GOAL', 'LIFE_EVENT', 'SEASON', 'INSIGHT')),
    constraint ck_knowledge_node_status check (status in ('candidate', 'active', 'archived'))
);
-- Idempotent promotion anchor (W2.2): UPSERT by (created_by, source_kind, source_id).
create unique index uq_knowledge_node_source on knowledge_node (created_by, source_kind, source_id)
    where source_id is not null and is_deleted = false;
create index idx_knowledge_node_created_by_status on knowledge_node (created_by, status);

create table knowledge_edge (
    id                 uuid default gen_random_uuid(),
    created_by         uuid not null,
    is_deleted         boolean not null default false,
    created_at         timestamptz not null default now(),
    from_node_id       uuid not null,
    to_node_id         uuid not null,
    kind               varchar(12) not null,
    weight             numeric(4,3) not null default 0.500,
    evidence           jsonb,
    last_reinforced_at timestamptz,
    constraint pk_knowledge_edge_id primary key (id),
    constraint fk_knowledge_edge_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_knowledge_edge_from_node_id_knowledge_node_id foreign key (from_node_id) references knowledge_node (id) on delete cascade,
    constraint fk_knowledge_edge_to_node_id_knowledge_node_id foreign key (to_node_id) references knowledge_node (id) on delete cascade,
    constraint ck_knowledge_edge_kind check (kind in ('TRIGGERS', 'PRECEDED_BY', 'SUPPORTS', 'CONFLICTS', 'RELATES_TO')),
    constraint ck_knowledge_edge_weight check (weight >= 0 and weight <= 1)
);
create index idx_knowledge_edge_from on knowledge_edge (from_node_id);
create index idx_knowledge_edge_to   on knowledge_edge (to_node_id);
-- Partial unique index (not a soft-delete-blind table constraint): a later slice (W2.5) will
-- soft-delete low-weight edges, and re-upserting the same (created_by, from, to, kind) pair must
-- not collide with the deleted row. Mirrors uq_knowledge_node_source above.
create unique index uq_knowledge_edge_pair on knowledge_edge (created_by, from_node_id, to_node_id, kind)
    where is_deleted = false;
