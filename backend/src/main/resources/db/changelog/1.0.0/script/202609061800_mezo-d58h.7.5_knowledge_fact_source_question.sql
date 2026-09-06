-- Once-ever question answers (bd mezo-d58h.7.5, spec 2026-09-05 §c): the 👍/👎 on a question card is
-- stored as a knowledge_fact, and a fact must not lie about where it came from — it is neither chat
-- extraction, nor a promoted pattern, nor a manual entry, nor a weekly lesson. FIFTH source
-- constant, drop + re-add (the 202608291100_mezo-d20.7.6_learned_fact_weekly_source.sql idiom).
-- KnowledgeFactEntity.source's @Pattern mirrors this list; both change together, or the insert dies
-- at runtime on a CHECK nothing tested.

alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review', 'question'));
