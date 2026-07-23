-- mezo-ws2x: workout_session.origin — discriminates mesocycle-plan rows from custom (saját)
-- workout templates/instances. Existing rows backfill to 'meso' via the column default.
ALTER TABLE workout_session
    ADD COLUMN origin TEXT NOT NULL DEFAULT 'meso';
ALTER TABLE workout_session
    ADD CONSTRAINT ck_workout_session_origin CHECK (origin IN ('meso', 'custom'));
