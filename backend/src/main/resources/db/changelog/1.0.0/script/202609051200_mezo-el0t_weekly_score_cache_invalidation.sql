-- mezo-el0t — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score is a pure write-through CACHE of a deterministic computation over the week's logs
-- (see WeeklyScoreService: every full computation of a week upserts the row, and every read of a
-- cached value recomputes it when the week's inputs moved). Nothing is stored here that cannot be
-- derived again from the logs, so deleting a row costs nothing but one recomputation on the next
-- read of that week.
--
-- Why now: this is NOT a formula change to checkin_avg -- WeeklyScoreService.aggregate still
-- averages the non-null logging sub-scores exactly as before. What changed is the MEANING of a
-- non-null logging value. DayEvaluationEngine now scores a completely untouched day's logging
-- dimension as null (not-measurable) instead of an honest-looking 0, so those days now DROP OUT
-- of the average instead of dragging it toward 0. Existing rows still hold checkin_avg computed
-- under the old meaning. The freshness probe only recomputes a week whose LOGS moved, so without
-- this delete a trend chart would render old-meaning and new-meaning checkin_avg points side by
-- side indefinitely. One-off invalidation is the whole fix; no schema change, no version column.

delete from weekly_score;
