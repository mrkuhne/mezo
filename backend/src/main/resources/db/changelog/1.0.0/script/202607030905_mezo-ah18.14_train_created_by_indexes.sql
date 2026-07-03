-- Owner-scoped finders on the Train child tables ran without a created_by index
-- (early-slice inconsistency; every later slice leads its composites with created_by,
-- and e.g. ExerciseSetRepository.findByCreatedByAndRepsNotNull filters created_by alone).
-- Single-column indexes suffice at single-user scale; the existing parent-FK indexes
-- keep serving the child-by-parent lookups.
CREATE INDEX idx_workout_session_created_by ON workout_session (created_by);
CREATE INDEX idx_exercise_created_by ON exercise (created_by);
CREATE INDEX idx_exercise_set_created_by ON exercise_set (created_by);
CREATE INDEX idx_exercise_feedback_created_by ON exercise_feedback (created_by);
CREATE INDEX idx_muscle_group_volume_log_created_by ON muscle_group_volume_log (created_by);
