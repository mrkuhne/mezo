-- mezo-jcpt.4 — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score is a pure write-through CACHE of a deterministic computation over the week's logs
-- (see WeeklyScoreService: every full computation of a week upserts the row, and every read of a
-- cached value recomputes it when the week's inputs moved). Nothing is stored here that cannot be
-- derived again from the logs, so deleting a row costs nothing but one recomputation on the next
-- read of that week.
--
-- Why now: DayScoreService switched from the four legacy subscores to the 6-dimension
-- DayEvaluationEngine. Existing rows therefore hold PRE-ENGINE numbers -- most visibly checkin_avg,
-- whose successor dimension (logging) scores an untouched day as an honest 0 where the old
-- check-in subscore was null. The freshness probe only recomputes a week whose LOGS moved, so
-- without this delete a trend chart would render old-formula and new-formula points side by side
-- indefinitely. One-off invalidation is the whole fix; no schema change, no version column.

delete from weekly_score;
