-- Phase 5 W4.1 (bd mezo-b3pp.15, spec §4.4): one updatable verdict per AI artifact.
-- Artifact existence is deliberately NOT enforced by FK — the five kinds span five tables and
-- a dangling id is harmless in a single-user app (spec §8.1).
create table message_feedback (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    artifact_kind varchar(20) not null,
    artifact_id   uuid        not null,
    verdict       varchar(4)  not null,
    reason        varchar(16),
    constraint pk_message_feedback_id primary key (id),
    constraint fk_message_feedback_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_message_feedback_artifact unique (created_by, artifact_kind, artifact_id),
    constraint ck_message_feedback_artifact_kind check (artifact_kind in ('chat_message', 'feed_message', 'weekly_suggestion', 'memoir', 'prediction')),
    constraint ck_message_feedback_verdict check (verdict in ('up', 'down')),
    constraint ck_message_feedback_reason_value check (reason is null or reason in ('inaccurate', 'too_much', 'bad_timing', 'not_about_me')),
    constraint ck_message_feedback_reason check (reason is null or verdict = 'down')
);

create index idx_message_feedback_created_by_kind on message_feedback (created_by, artifact_kind);
