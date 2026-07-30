-- LLM call audit log (bd mezo-2zyu, spec docs/superpowers/specs/2026-07-28-llm-call-audit-log.md §4).
-- One row per provider call: request shape, outcome, usage counters, the verbatim payload and the
-- pricing snapshot the cost was frozen from.
--
-- INSERT-only by design: NO is_deleted here. An audit row is immutable history; rows leave only via
-- retention pruning (hard DELETE), never through the app's normal soft-delete paths. created_by is
-- nullable with ON DELETE SET NULL so removing a user never takes the cost history with them.
--
-- Most columns are nullable because each call_kind fills its own block (generation tokens vs.
-- embedding counters vs. image counters). On an ERROR row the PROVIDER-reported usage and the cost
-- are absent (null) — the provider never answered — but REQUEST-side counters DO survive (image
-- count/bytes/mime, embedding batch size and dimensions), because those are facts of the attempt.
-- Consequently every usage/cost aggregate must filter status = 'SUCCESS'.

create table llm_log_history (
    id                   uuid        not null default gen_random_uuid(),
    created_by           uuid,
    created_at           timestamptz not null default now(),
    call_kind            text        not null,
    feature              text        not null,
    operation            text,
    entity_kind          text,
    entity_id            uuid,
    requested_model      text        not null,
    served_model         text,
    status               text        not null,
    error_code           text,
    error_class          text,
    latency_ms           integer     not null,
    streamed             boolean     not null default false,
    tool_rounds          integer,
    service_tier         text,
    prompt_tokens        integer,
    candidates_tokens    integer,
    thoughts_tokens      integer,
    cached_tokens        integer,
    total_tokens         integer,
    embed_input_count    integer,
    embed_dimensions     integer,
    embed_billable_chars integer,
    system_prompt        text,
    user_message         text,
    response_text        text,
    truncated            boolean     not null default false,
    payload_bytes        integer     not null default 0,
    image_count          integer,
    image_bytes_total    bigint,
    image_mime           text,
    pricing_snapshot     jsonb,
    cost_usd             numeric(12,6),
    constraint pk_llm_log_history_id primary key (id),
    constraint fk_llm_log_history_created_by_app_user_id foreign key (created_by) references app_user (id) on delete set null,
    constraint ck_llm_log_history_status check (status in ('SUCCESS','ERROR'))
);

-- Retention pruning + the three cost-report axes (all time-ordered).
create index idx_llm_log_history_created_at on llm_log_history (created_at);
create index idx_llm_log_history_feature_created_at on llm_log_history (feature, created_at);
create index idx_llm_log_history_served_model_created_at on llm_log_history (served_model, created_at);
