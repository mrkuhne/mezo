-- U9b (mezo-zpxv7): Rólad — a közös kép. Fact owner (the team character a fact belongs to) and
-- the „Most ne” snooze on both candidate kinds. Backfill mirrors FactOwner.backfill().
alter table learned_fact add column owner varchar(16);
alter table knowledge_fact add column owner varchar(16);

update learned_fact set owner = case category
    when 'train' then 'mocor' when 'fuel' then 'falat' when 'health' then 'deru' else 'mezo' end;
update knowledge_fact set owner = case category
    when 'train' then 'mocor' when 'fuel' then 'falat' when 'health' then 'deru' else 'mezo' end;
update learned_fact set owner = 'szunya'
    where category = 'health' and candidate_text ~* '(alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed)';
update knowledge_fact set owner = 'szunya'
    where category = 'health' and fact_text ~* '(alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed)';

alter table learned_fact alter column owner set not null;
alter table knowledge_fact alter column owner set not null;
alter table learned_fact add constraint ck_learned_fact_owner
    check (owner in ('szunya', 'mocor', 'falat', 'deru', 'mezo'));
alter table knowledge_fact add constraint ck_knowledge_fact_owner
    check (owner in ('szunya', 'mocor', 'falat', 'deru', 'mezo'));

alter table learned_fact add column snoozed_until timestamptz;
alter table knowledge_node add column snoozed_until timestamptz;
