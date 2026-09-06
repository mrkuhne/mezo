-- Round 2 S2 (mezo-d58h.7.2, spec 2026-09-05 §b/§12): the ~15:00 hydration checkpoint is a
-- companion-feed kind of its own — deterministic config text, emitted only on a training day
-- whose pro-rated water shortfall holds. The (created_by, message_date, kind) partial unique
-- index applies to it like every other kind, so at most one checkpoint per user per day.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup','advice','hydration'));
