-- Phase 5 W1.1 (bd mezo-b3pp.1, spec §4.1): free-prose journal entries.
-- Stories live in vector space — the row is the source; the embedding rides in memory_embedding.
create table journal_entry (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    occurred_on date        not null,
    text        text        not null,
    source      varchar(12) not null,
    constraint pk_journal_entry_id primary key (id),
    constraint fk_journal_entry_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_journal_entry_source check (source in ('quickinput', 'ritual'))
);

create index idx_journal_entry_created_by_occurred_on on journal_entry (created_by, occurred_on desc);
