-- Reflexió S1 (bd mezo-eq85.1, spec 2026-09-06 §4.1): one extracted signal per source-row
-- version. Never updated in place — an edited entry gets a new version; series read the newest
-- version per (source_kind, source_id). `unsure` rows exist for audit but never enter a series.
create table text_signal (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    source_kind   varchar(16)  not null,
    source_id     uuid         not null,
    occurred_on   date         not null,
    content_hash  varchar(64)  not null,
    version       integer      not null default 1,
    mood          smallint,
    energy        smallint,
    stress        smallint,
    confidence    varchar(8)   not null,
    people        text[]       not null default '{}',
    topics        text[]       not null default '{}',
    keywords      text[]       not null default '{}',
    provenance    jsonb        not null default '{}'::jsonb,
    constraint pk_text_signal_id primary key (id),
    constraint fk_text_signal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_text_signal_source_kind check (source_kind in ('journal_entry', 'gratitude', 'chat_day')),
    constraint ck_text_signal_confidence check (confidence in ('sure', 'unsure')),
    constraint ck_text_signal_mood check (mood is null or mood between 1 and 5),
    constraint ck_text_signal_energy check (energy is null or energy between 1 and 5),
    constraint ck_text_signal_stress check (stress is null or stress between 1 and 5)
);
create unique index uq_text_signal_source_version on text_signal (created_by, source_kind, source_id, version) where is_deleted = false;
create index idx_text_signal_created_by_occurred_on on text_signal (created_by, occurred_on);
