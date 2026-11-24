-- Master palettes are filled by ExerciseCatalogLoader at startup; user-authored rows stay NULL for legacy fallback.
ALTER TABLE exercise_catalog ADD COLUMN allowed_techniques varchar(16)[];

ALTER TABLE exercise DROP CONSTRAINT ck_exercise_technique;
ALTER TABLE exercise ADD CONSTRAINT ck_exercise_technique
  CHECK (technique IN ('none','rest_drop','drop','myo','partials','rest_pause','top_pause'));

ALTER TABLE exercise_set DROP CONSTRAINT ck_exercise_set_technique;
ALTER TABLE exercise_set ADD CONSTRAINT ck_exercise_set_technique
  CHECK (technique IN ('rest_drop','drop','myo','partials','rest_pause','top_pause'));
