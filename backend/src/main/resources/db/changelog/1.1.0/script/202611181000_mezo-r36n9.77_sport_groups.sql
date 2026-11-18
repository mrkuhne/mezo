-- Volume engine v2 S2 (mezo-r36n9.77): coarse muscle groups a sport already loads. null = none, no backfill.
ALTER TABLE meso_template ADD COLUMN sport_groups jsonb NULL;
ALTER TABLE mesocycle ADD COLUMN sport_groups jsonb NULL;
