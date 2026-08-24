-- Phase 5 (bd mezo-b3pp.1, spec §4.3): memory_embedding learns the narrative kinds.
-- The (kind, ref_id) uniqueness and the single MemoryEmbeddingWriter path are unchanged.
alter table memory_embedding drop constraint ck_memory_embedding_kind;
alter table memory_embedding add constraint ck_memory_embedding_kind check (kind in
    ('chat_turn', 'daily_summary', 'weekly_summary', 'monthly_summary',
     'journal_entry', 'reflection', 'gratitude', 'decision', 'activity_note', 'checkin_note'));
