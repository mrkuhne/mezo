-- "Hogy tanultam?" (bd mezo-y72o3): how a week's learned base was computed, built in the weekly
-- run (ExpenditureExplanationJson). Nullable: rows written before it are backfilled on boot by
-- ExpenditureRolloutRunner with an explain-only replay of each learner's latest week — only this
-- column is set; the served decision (status, posterior, applied base, step) is left untouched.
alter table expenditure_estimate add column explanation jsonb;
