create table person_fact (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 person_id uuid not null,
 kind varchar(24) not null,
 fact_text varchar(300) not null,
 confidence varchar(8) not null,
 source_ref_kind varchar(24) not null,
 source_ref_id varchar(64) not null,
 active boolean not null default true,
 include_in_prompt boolean not null default true,
 seen_at timestamptz,
 constraint pk_person_fact_id primary key(id),
 constraint fk_person_fact_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_person_fact_person_id foreign key(person_id) references person(id) on delete cascade,
 constraint ck_person_fact_kind check(kind in ('preference','relationship_state','shared_activity','important_date','sensitivity')),
 constraint ck_person_fact_confidence check(confidence in ('low','medium','high')),
 constraint ck_person_fact_source_ref_kind check(source_ref_kind in ('chat_turn','nightly_day'))
);
create index idx_person_fact_person_id on person_fact(person_id);
create index idx_person_fact_source_ref on person_fact(created_by, source_ref_kind, source_ref_id);
