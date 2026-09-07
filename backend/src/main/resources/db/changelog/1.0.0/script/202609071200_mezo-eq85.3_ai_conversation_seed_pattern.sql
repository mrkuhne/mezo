-- Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §5): a conversation can be SEEDED with the
-- hypothesis it is about ("beszéljünk erről" from the observation feed). Everything typed in that
-- thread is then evidence about that pattern, recorded as user_reply events.
-- ON DELETE SET NULL: purging a pattern must orphan the anchor, never take the conversation.
alter table ai_conversation
    add column seed_pattern_id uuid references pattern (id) on delete set null;
