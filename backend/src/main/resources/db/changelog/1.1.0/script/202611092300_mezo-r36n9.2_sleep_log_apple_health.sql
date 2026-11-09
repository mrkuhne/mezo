-- Boop S2 (mezo-r36n9.2): Apple Health sleep nights land in sleep_log, one row per night,
-- upserted by the client's stable external id. source widens to carry 'apple_health'.
ALTER TABLE sleep_log ALTER COLUMN source TYPE varchar(16);
ALTER TABLE sleep_log DROP CONSTRAINT ck_sleep_log_source;
ALTER TABLE sleep_log ADD CONSTRAINT ck_sleep_log_source
    CHECK (source IS NULL OR source IN ('manual', 'screenshot', 'apple_health'));
ALTER TABLE sleep_log ADD COLUMN external_id varchar(64);
-- Spans soft-deleted rows on purpose: a deleted night keeps its slot and is revived by an upsert.
CREATE UNIQUE INDEX uq_sleep_log_owner_external ON sleep_log (created_by, external_id)
    WHERE external_id IS NOT NULL;
