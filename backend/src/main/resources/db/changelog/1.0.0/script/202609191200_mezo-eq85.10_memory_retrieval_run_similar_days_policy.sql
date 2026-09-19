-- Memória mindenhol S10 (bd mezo-eq85.10, task-10-codebase-notes.md §2): find_similar_past_days
-- and the Memória tab's Kereső segment now retrieve from the unified memory platform under their
-- OWN consumer policy, so every SIMILAR_DAYS retrieval is separable in the audit. SIMILAR_DAYS
-- joins the five serving/offline policies already allowed.
alter table memory_retrieval_run drop constraint ck_memory_retrieval_run_policy;
alter table memory_retrieval_run add constraint ck_memory_retrieval_run_policy check
    (consumer_policy in ('CHAT_AMBIENT', 'MORNING_BRIEFING', 'WEEKLY_MEMOIR', 'PREDICTION_EVIDENCE',
                         'REFLECTION', 'SIMILAR_DAYS'));
