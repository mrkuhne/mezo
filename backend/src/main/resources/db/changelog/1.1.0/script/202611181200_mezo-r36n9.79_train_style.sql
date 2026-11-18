ALTER TABLE exercise_catalog
  ADD COLUMN equipment text NOT NULL DEFAULT 'other'
    CONSTRAINT ck_exercise_catalog_equipment CHECK (equipment IN ('machine','cable','dumbbell','barbell','bodyweight','kettlebell','other')),
  ADD COLUMN stability text NOT NULL DEFAULT 'free'
    CONSTRAINT ck_exercise_catalog_stability CHECK (stability IN ('stable','free')),
  ADD COLUMN lengthened_friendly boolean NOT NULL DEFAULT false;
ALTER TABLE meso_template ADD COLUMN training_style text NULL
  CONSTRAINT ck_meso_template_training_style CHECK (training_style IN ('balanced','volume','heavy','allout'));
ALTER TABLE mesocycle ADD COLUMN training_style text NULL
  CONSTRAINT ck_mesocycle_training_style CHECK (training_style IN ('balanced','volume','heavy','allout'));
ALTER TABLE exercise
  ADD COLUMN training_style text NULL
    CONSTRAINT ck_exercise_training_style CHECK (training_style IN ('balanced','volume','heavy','allout')),
  ADD COLUMN rest_sec integer NULL CONSTRAINT ck_exercise_rest_sec CHECK (rest_sec BETWEEN 30 AND 600),
  ADD COLUMN overrides jsonb NULL;
ALTER TABLE exercise_set ADD COLUMN target_rep_min integer NULL, ADD COLUMN target_rep_max integer NULL;
