-- Proactive coaching S3 (mezo-d58h.3, spec 2026-09-03 §4 setup table): the 'setup' kind carries
-- CONFIGURATION cards — no sleep goal, an infeasible sleep plan — not observations about a day.
-- Config text, never LLM output. The (created_by, message_date, kind) partial unique index
-- applies to it like every other kind, so at most one setup card per user per day.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup'));
