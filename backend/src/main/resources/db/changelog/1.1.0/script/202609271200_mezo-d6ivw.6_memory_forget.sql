-- S6 (mezo-d6ivw.6): the Tudástár hub's forget/mute spine.
-- knowledge_fact: WHY a fact is muted (null while active) and since when.
alter table knowledge_fact add column muted_reason varchar(16);
alter table knowledge_fact add column muted_at timestamptz;
alter table knowledge_fact add constraint ck_knowledge_fact_muted_reason
    check (muted_reason is null or muted_reason in ('user', 'refuted', 'superseded'));

-- pattern: the recheck trace + the forgotten terminal status (never resurfaces, never re-promotes).
alter table pattern add column rechecked_at timestamptz;
alter table pattern drop constraint ck_pattern_status;
alter table pattern add constraint ck_pattern_status
    check (status in ('proposed', 'monitoring', 'confirmed', 'rejected', 'refuted', 'dormant', 'forgotten'));

-- The forget veto: the same thing is never re-learned from the same source.
create table memory_forget_veto (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 domain varchar(16) not null,
 veto_key varchar(500) not null,
 constraint pk_memory_forget_veto_id primary key(id),
 constraint fk_memory_forget_veto_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_memory_forget_veto_domain check(domain in ('fact_text','pattern'))
);
create unique index uq_memory_forget_veto_key on memory_forget_veto(created_by, domain, veto_key) where is_deleted = false;

-- Per-subject effect mute — outlives the nightly effect_link cache (rows there are soft-deleted
-- and re-created; a flag ON the row would die with it).
create table effect_mute (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 subject_kind varchar(8) not null,
 subject_key varchar(64) not null,
 mode varchar(16) not null,
 constraint pk_effect_mute_id primary key(id),
 constraint fk_effect_mute_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_effect_mute_subject_kind check(subject_kind in ('person','event')),
 constraint ck_effect_mute_mode check(mode in ('muted','forgotten'))
);
create unique index uq_effect_mute_subject on effect_mute(created_by, subject_kind, subject_key) where is_deleted = false;
