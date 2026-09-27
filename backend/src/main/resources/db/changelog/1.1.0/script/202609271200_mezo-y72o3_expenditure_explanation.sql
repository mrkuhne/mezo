-- "Hogy tanultam?" (bd mezo-y72o3): how a week's learned base was computed, built in the weekly
-- run (ExpenditureExplanationJson). Nullable: rows written before it are backfilled on boot by
-- ExpenditureRolloutRunner re-reviewing each learner's latest week.
alter table expenditure_estimate add column explanation jsonb;
