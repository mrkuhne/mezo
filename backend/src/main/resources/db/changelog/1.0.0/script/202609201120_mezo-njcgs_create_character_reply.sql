create table character_reply (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    source_type varchar(24) not null,
    source_id uuid not null,
    source_index integer not null,
    source_evidence text not null,
    source_text text not null,
    text varchar(2000) not null,
    client_request_id uuid not null,
    author_name varchar(120) not null,
    expert_key varchar(40),
    dimension_key varchar(40),
    claim_id uuid,
    status varchar(24) not null,
    outcome varchar(24),
    outcome_text varchar(2000),
    processing_token uuid,
    processing_started_at timestamptz,
    constraint pk_character_reply_id primary key (id),
    constraint fk_character_reply_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint ck_character_reply_source_type check (source_type in ('OBSERVATION','CLAIM','CONFERENCE_CHANGE')),
    constraint ck_character_reply_source_index check (source_index between 0 and 9999 and (source_type='CONFERENCE_CHANGE' or source_index=0)),
    constraint ck_character_reply_text check (length(trim(text)) between 1 and 2000),
    constraint ck_character_reply_status check (status in ('SAVED','PROCESSING','FAILED','NEEDS_CLARIFICATION','COMPLETED')),
    constraint ck_character_reply_outcome check (outcome in ('UPDATED','WITHDRAWN','UNCHANGED','NEEDS_CLARIFICATION'))
);
create unique index uq_character_reply_client_request on character_reply(created_by,client_request_id) where is_deleted=false;
create index idx_character_reply_thread on character_reply(created_by,source_type,source_id,source_index,created_at) where is_deleted=false;

alter table memory_embedding drop constraint ck_memory_embedding_kind;
alter table memory_embedding add constraint ck_memory_embedding_kind check (kind in
 ('chat_turn','daily_summary','weekly_summary','monthly_summary','journal_entry','reflection',
 'gratitude','decision','activity_note','checkin_note','character_reply'));

-- A targeted reply rewrites a portrait without fabricating a conference.
alter table character_portrait_revision alter column conference_id drop not null;
alter table character_portrait_revision add column reply_id uuid;
alter table character_portrait_revision add constraint fk_character_portrait_revision_reply
    foreign key (reply_id) references character_reply(id);
alter table character_portrait_revision add constraint ck_character_portrait_revision_origin
    check ((conference_id is not null)::integer + (reply_id is not null)::integer = 1);
