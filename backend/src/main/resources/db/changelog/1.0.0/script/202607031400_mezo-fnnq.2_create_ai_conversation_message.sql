-- Phase 3 companion chat persistence spine (bd mezo-fnnq.2, roadmap §V0.2).
-- Conversation start time = created_at (no separate started_at column — plan decision #3).

create table ai_conversation (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    title           varchar(120),
    last_message_at timestamptz,
    constraint pk_ai_conversation_id primary key (id),
    constraint fk_ai_conversation_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create index idx_ai_conversation_created_by_last_message_at on ai_conversation (created_by, last_message_at desc);

create table ai_message (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    conversation_id uuid         not null,
    role            varchar(16)  not null,
    content         text         not null,
    tool_calls      jsonb,
    refs            jsonb,
    constraint pk_ai_message_id primary key (id),
    constraint fk_ai_message_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_ai_message_conversation_id_ai_conversation_id foreign key (conversation_id) references ai_conversation (id) on delete cascade,
    constraint ck_ai_message_role check (role in ('user', 'assistant'))
);

create index idx_ai_message_conversation_id_created_at on ai_message (conversation_id, created_at);
create index idx_ai_message_created_by on ai_message (created_by);
