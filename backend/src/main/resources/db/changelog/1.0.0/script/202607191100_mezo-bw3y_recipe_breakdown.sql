-- Recipe template breakdown cache (mezo-bw3y): the deterministic 3-dim envelope + AI prose,
-- persisted on first successful prose enrichment; NULL = never generated / invalidated
-- (RecipeService.update nulls it; numeric drift regenerates at read).
ALTER TABLE recipe ADD COLUMN breakdown jsonb;
