-- Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §4.5): the nightly reflection pass retrieves from
-- the unified memory platform under its OWN consumer policy, so every reflection retrieval is
-- separable in the audit from a chat turn's. REFLECTION joins the four serving policies.
alter table memory_retrieval_run drop constraint ck_memory_retrieval_run_policy;
alter table memory_retrieval_run add constraint ck_memory_retrieval_run_policy check
    (consumer_policy in ('CHAT_AMBIENT', 'MORNING_BRIEFING', 'WEEKLY_MEMOIR', 'PREDICTION_EVIDENCE',
                         'REFLECTION'));
