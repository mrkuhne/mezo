-- V1.2 (bd mezo-fnnq.7): the extractor classifies candidates at capture time, and
-- accept/refine promotes into knowledge_fact WITH this category — the column is required.
-- Additive changeset; the V1.1 create stays untouched (released-changeset immutability).

alter table learned_fact add column category varchar(16);
update learned_fact set category = 'life' where category is null;
alter table learned_fact alter column category set not null;
alter table learned_fact add constraint ck_learned_fact_category check (category in ('train', 'fuel', 'health', 'life'));
