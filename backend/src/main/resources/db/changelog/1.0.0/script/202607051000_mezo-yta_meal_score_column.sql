-- Fuel P7 (mezo-yta): denormalized numeric meal score alongside the breakdown jsonb (ADR 0006 §4).
-- The jsonb envelope stays the source of detail; this scalar is a read optimization for list
-- surfaces (day view, recipe logs). ScoringService is the single writer of both — set atomically.
-- Existing rows stay NULL (pre-scoring meals render the FE pending sparkle; no backfill).
ALTER TABLE meal ADD COLUMN score numeric;
