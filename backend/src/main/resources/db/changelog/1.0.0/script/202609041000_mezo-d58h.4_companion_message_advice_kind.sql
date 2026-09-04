-- Proactive coaching S4 (mezo-d58h.4, spec 2026-09-03 §5): the 'advice' kind is the single
-- coaching card of the day — the successor to 'intervention' and 'setup', chosen across all
-- tiers by the spec §4 severity order. The two older kinds stay in the CHECK for the rows
-- already written; nothing writes them after this slice.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup','advice'));
