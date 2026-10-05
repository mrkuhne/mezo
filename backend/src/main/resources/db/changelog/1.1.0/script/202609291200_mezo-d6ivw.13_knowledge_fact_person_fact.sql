-- „Rólam is" (mezo-d6ivw.13): a person fact the user also claims as their own is copied into
-- knowledge_fact with source = 'person_fact', linked back to its person_fact row. One live copy
-- per person fact (partial unique index — a removed copy frees the slot for a re-tap).
alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review', 'question', 'team_chat', 'person_fact'));

alter table knowledge_fact add column source_person_fact_id uuid;
alter table knowledge_fact add constraint fk_knowledge_fact_source_person_fact_id
    foreign key (source_person_fact_id) references person_fact(id);

create unique index uq_knowledge_fact_source_person_fact on knowledge_fact (created_by, source_person_fact_id)
    where is_deleted = false and source_person_fact_id is not null;
