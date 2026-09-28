-- S8 (bd mezo-d6ivw.12): "ezt ne jegyezd meg". forgotten_memories = what a forget request on
-- THIS user message forgot (typed jsonb envelope, the recalled_memories precedent; null when the
-- message forgot nothing). extraction_blocked = the per-message no-extract marker: the post-turn
-- fact and person-fact extractors re-read it FOR SHARE right before saving, so a forget that
-- commits first always wins over an in-flight extraction of the same turn. Additive.
alter table ai_message add column forgotten_memories jsonb;
alter table ai_message add column extraction_blocked boolean not null default false;
