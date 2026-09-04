-- Kamra follow-ups (mezo-qooi): an unreviewed import candidate must not become globally visible
-- shared content before a human confirms it. The S4 manual-review gate only covered the natural-key
-- HIT branch (no mergeIfAuthor); a MISS still inserted a full definition from low-confidence
-- scrape/photo data straight into the catalog every user searches.
--
-- 'draft' rows stay on their author's own shelf but are excluded from catalog search and from the
-- PantryNameIndex the AI matcher / Receptműhely build. The author's own definition edit promotes
-- the row to 'verified' (PantryService#updateItem) — the state transition avoids the pending-vs-
-- verified natural-key duplication a separate staging table would create.
--
-- Default 'verified' on purpose: every EXISTING row was written through a path that is either
-- loader master content or a deliberate user action, so today's behaviour is unchanged.
ALTER TABLE pantry_catalog ADD COLUMN status text NOT NULL DEFAULT 'verified';
ALTER TABLE pantry_catalog
    ADD CONSTRAINT ck_pantry_catalog_status CHECK (status IN ('draft', 'verified'));
