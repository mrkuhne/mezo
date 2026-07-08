-- mezo-dhdr: prescribed sets — warmup/working recipe on the template exercise + set kind flag.
-- Approach A: the recipe lives here; concrete per-set targets are computed on-the-fly by
-- SetRecommendationService. exercise_set.kind classifies logged sets; warmups are excluded
-- from records/e1RM/progression.

-- exercise: rename sets -> working_sets; add warmup_sets / rep_min / rep_max / anchor_weight_kg;
-- migrate target_reps ("a-b" | "a") into rep_min/rep_max; drop target_reps.
ALTER TABLE exercise RENAME COLUMN sets TO working_sets;
ALTER TABLE exercise ADD COLUMN warmup_sets INT NOT NULL DEFAULT 0;
ALTER TABLE exercise ADD COLUMN rep_min INT;
ALTER TABLE exercise ADD COLUMN rep_max INT;
ALTER TABLE exercise ADD COLUMN anchor_weight_kg NUMERIC(6,2);

UPDATE exercise SET
    rep_min = COALESCE(NULLIF(split_part(target_reps, '-', 1), '') ::int, 8),
    rep_max = COALESCE(NULLIF(split_part(target_reps, '-', 2), '') ::int,
                       NULLIF(split_part(target_reps, '-', 1), '') ::int, 12);

ALTER TABLE exercise ALTER COLUMN rep_min SET NOT NULL;
ALTER TABLE exercise ALTER COLUMN rep_max SET NOT NULL;
ALTER TABLE exercise ADD CONSTRAINT ck_exercise_rep_range CHECK (rep_min >= 1 AND rep_max >= rep_min);
ALTER TABLE exercise DROP COLUMN target_reps;

-- exercise_set: classify each logged set; existing rows default to working.
ALTER TABLE exercise_set ADD COLUMN kind VARCHAR(7) NOT NULL DEFAULT 'working';
ALTER TABLE exercise_set ADD CONSTRAINT ck_exercise_set_kind CHECK (kind IN ('warmup','working'));
