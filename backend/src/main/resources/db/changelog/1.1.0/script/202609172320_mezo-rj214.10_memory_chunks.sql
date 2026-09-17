ALTER TABLE memory_item ADD COLUMN chunk_index integer NOT NULL DEFAULT 0;
ALTER TABLE memory_item ADD CONSTRAINT ck_memory_item_chunk_index CHECK (chunk_index >= 0);
ALTER TABLE memory_item DROP CONSTRAINT uq_memory_item_owner_source;
ALTER TABLE memory_item ADD CONSTRAINT uq_memory_item_owner_source
    UNIQUE (created_by, source_kind, source_id, chunk_index);

-- User suppression historically kept vectors; source deletion suppressed AND deleted them.
-- Persist that distinction beyond retrieval-feedback retention before chunks are introduced.
UPDATE memory_item i SET provenance = provenance || '{"suppressionReason":"user"}'::jsonb
WHERE i.state = 'suppressed' AND NOT i.is_deleted AND (
    EXISTS (SELECT 1 FROM memory_vector v WHERE v.memory_item_id=i.id
        AND v.created_by=i.created_by AND NOT v.is_deleted)
    OR EXISTS (SELECT 1 FROM memory_retrieval_feedback f WHERE f.memory_item_id=i.id
        AND f.created_by=i.created_by AND f.action='suppress' AND NOT f.is_deleted)
);
