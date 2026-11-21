-- The owner's fixed rest-pause technique (mezo-r36n9.125): widen both technique check constraints with 'rest_pause'.
ALTER TABLE exercise DROP CONSTRAINT ck_exercise_technique;
ALTER TABLE exercise ADD CONSTRAINT ck_exercise_technique
  CHECK (technique IN ('none','rest_drop','drop','myo','partials','rest_pause'));
ALTER TABLE exercise_set DROP CONSTRAINT ck_exercise_set_technique;
ALTER TABLE exercise_set ADD CONSTRAINT ck_exercise_set_technique
  CHECK (technique IN ('rest_drop','drop','myo','partials','rest_pause'));
