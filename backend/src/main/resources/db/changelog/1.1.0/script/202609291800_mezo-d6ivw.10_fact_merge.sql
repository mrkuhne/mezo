-- S9 (mezo-d6ivw.10): the weekly fact merge. A merged-away fact is muted with reason 'merged' and
-- superseded_by its survivor; an accepted merge proposal mints a fact with source 'merge'.
alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review', 'question', 'team_chat', 'person_fact', 'merge'));
alter table knowledge_fact drop constraint ck_knowledge_fact_muted_reason;
alter table knowledge_fact add constraint ck_knowledge_fact_muted_reason
    check (muted_reason is null or muted_reason in ('user', 'refuted', 'superseded', 'merged'));

-- a merge proposal rides the ordinary candidate inbox; its members are listed here
alter table learned_fact drop constraint ck_learned_fact_source;
alter table learned_fact add constraint ck_learned_fact_source check (source in ('chat', 'weekly_review', 'merge'));
alter table learned_fact add column merge_member_ids uuid[];
alter table learned_fact add constraint ck_learned_fact_merge_members
    check ((source = 'merge') = (merge_member_ids is not null));

-- once-ever memory: a member set that was merged, proposed, undone or rejected is never offered again
create table fact_merge_ledger (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    member_key varchar(400) not null,
    kind varchar(16) not null,
    learned_fact_id uuid,
    constraint pk_fact_merge_ledger_id primary key (id),
    constraint fk_fact_merge_ledger_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint ck_fact_merge_ledger_kind check (kind in ('auto', 'proposal'))
);
create unique index uq_fact_merge_ledger_member_key on fact_merge_ledger (created_by, member_key) where is_deleted = false;
