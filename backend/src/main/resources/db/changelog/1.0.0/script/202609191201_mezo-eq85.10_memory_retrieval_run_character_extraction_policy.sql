-- Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4/§8): character
-- bootstrap/monthly, quarterly review and profile assembly retrieve under CHARACTER_EVIDENCE;
-- life-event and person extraction retrieve under EXTRACTION. Both policies already exist in the
-- ConsumerPolicy enum (S7) but were never added to this CHECK — widening it here, in a NEW
-- changeset (the previous one is immutable), joining the six policies already allowed.
alter table memory_retrieval_run drop constraint ck_memory_retrieval_run_policy;
alter table memory_retrieval_run add constraint ck_memory_retrieval_run_policy check
    (consumer_policy in ('CHAT_AMBIENT', 'MORNING_BRIEFING', 'WEEKLY_MEMOIR', 'PREDICTION_EVIDENCE',
                         'REFLECTION', 'SIMILAR_DAYS', 'CHARACTER_EVIDENCE', 'EXTRACTION'));
