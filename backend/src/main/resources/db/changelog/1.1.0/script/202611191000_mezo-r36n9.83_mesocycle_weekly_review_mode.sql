-- Per-run weekly review mode (mezo-r36n9.83, owner decision #51): the run's own auto|manual choice; NULL = the
-- server default (mezo.volume.weekly-review.mode). NB: no bare question mark anywhere in a changeset.
ALTER TABLE mesocycle ADD COLUMN weekly_review_mode varchar(16) NULL
  CONSTRAINT ck_mesocycle_weekly_review_mode CHECK (weekly_review_mode IN ('auto','manual'));
