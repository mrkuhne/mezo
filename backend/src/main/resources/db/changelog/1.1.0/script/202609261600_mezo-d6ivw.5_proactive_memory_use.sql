create table proactive_memory_use (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 used_on date not null,
 topic_key varchar(64) not null,
 kind varchar(16) not null,
 constraint pk_proactive_memory_use_id primary key(id),
 constraint fk_proactive_memory_use_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_proactive_memory_use_kind check(kind in ('morning','midday','evening'))
);
create index ix_proactive_memory_use_lookup on proactive_memory_use(created_by, used_on);
