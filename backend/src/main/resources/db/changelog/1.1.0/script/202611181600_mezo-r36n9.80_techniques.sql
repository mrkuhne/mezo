-- Technique model (mezo-r36n9.80, spec §6.3 / §6.6): a block flag, the per-exercise technique + challenge, the
-- logged set's technique and its legs. NB: no bare question mark anywhere in a changeset (a JDBC placeholder).
ALTER TABLE meso_template ADD COLUMN techniques_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE mesocycle ADD COLUMN techniques_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE exercise
  ADD COLUMN technique text NULL
    CONSTRAINT ck_exercise_technique CHECK (technique IN ('none','rest_drop','drop','myo','partials')),
  ADD COLUMN technique_source text NULL
    CONSTRAINT ck_exercise_technique_source CHECK (technique_source IN ('owner','planner','ai')),
  ADD COLUMN challenge boolean NOT NULL DEFAULT false;
ALTER TABLE exercise_set ADD COLUMN technique text NULL
  CONSTRAINT ck_exercise_set_technique CHECK (technique IN ('rest_drop','drop','myo','partials'));
-- Legs hang off a set and live and die with it: no owner / soft-delete columns, every reader reaches them
-- through a live parent set; a hard delete of the set cascades.
CREATE TABLE exercise_set_leg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_set_id uuid NOT NULL REFERENCES exercise_set(id) ON DELETE CASCADE,
  leg_index integer NOT NULL CHECK (leg_index >= 0),
  kind text NOT NULL CONSTRAINT ck_exercise_set_leg_kind CHECK (kind IN ('drop','mini','partials')),
  weight_kg numeric(6,2) NULL CHECK (weight_kg >= 0),
  reps integer NULL CHECK (reps >= 0),
  rest_sec integer NULL CHECK (rest_sec BETWEEN 0 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_exercise_set_leg UNIQUE (exercise_set_id, leg_index)
);
CREATE INDEX ix_exercise_set_leg_set ON exercise_set_leg (exercise_set_id);
