-- S7 (mezo-d6ivw.7): the csapatfal reply — the character answers, a concrete explanation
-- closes the ügy and becomes a durable exception. Spec 2026-09-24-mezo-emlekezete-design.md §S7.
alter table team_chat_thread add column close_reason varchar(8);
alter table team_chat_thread add column close_note varchar(60);
alter table team_chat_thread add column offer varchar(8);
alter table team_chat_thread add column exception_id uuid;
update team_chat_thread set close_reason = 'DATA' where status = 'RESOLVED';
alter table team_chat_thread add constraint ck_team_chat_thread_close_reason
    check (close_reason is null or close_reason in ('DATA','REPLY','EXCUSED'));
alter table team_chat_thread add constraint ck_team_chat_thread_offer
    check (offer is null or offer in ('EXCUSE','REVIEW'));

alter table team_chat_line drop constraint ck_team_chat_line_kind;
alter table team_chat_line add constraint ck_team_chat_line_kind
    check (kind in ('OPEN','GUEST','RESOLVE','SKEPTIC','USER','REPLY'));

create table team_chat_exception (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    flag_key varchar(24) not null,
    owner_character varchar(16) not null,
    context_tag varchar(40) not null,
    normalized_tag varchar(40) not null,
    fact_text varchar(160) not null,    -- the remembered sentence (mirrors its knowledge fact; the chip's text)
    keywords jsonb not null,
    knowledge_fact_id uuid,
    source_thread_id uuid,
    source_line_id uuid,
    active boolean not null default true,
    window_started_at timestamptz not null,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_exception_id primary key (id),
    constraint fk_team_chat_exception_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint fk_team_chat_exception_source_thread_id foreign key (source_thread_id) references team_chat_thread(id)
);
-- One row per (user, rule, tag) ever: an inactive row is the durable veto (never re-captured).
create unique index uq_team_chat_exception_tag on team_chat_exception (created_by, flag_key, normalized_tag)
    where is_deleted = false;

alter table team_chat_thread add constraint fk_team_chat_thread_exception_id
    foreign key (exception_id) references team_chat_exception(id);

create table team_chat_exception_hit (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    exception_id uuid not null,
    hit_on date not null,
    source varchar(8) not null,
    thread_id uuid,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_exception_hit_id primary key (id),
    constraint fk_team_chat_exception_hit_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint fk_team_chat_exception_hit_exception_id foreign key (exception_id) references team_chat_exception(id),
    constraint ck_team_chat_exception_hit_source check (source in ('NOTES','TAP','REPLY'))
);
create unique index uq_team_chat_exception_hit_day on team_chat_exception_hit (exception_id, hit_on)
    where is_deleted = false;

alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review', 'question', 'team_chat'));
