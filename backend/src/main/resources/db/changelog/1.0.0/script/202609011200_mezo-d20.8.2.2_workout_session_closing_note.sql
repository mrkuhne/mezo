-- mezo-d20.8.2.2 — the workout-level closing note ("Hogy ment?"), written when the session is
-- finished and editable afterwards from the review page.
--
-- Deliberately a NEW column rather than a reuse of workout_session.note: that one is the
-- TEMPLATE day's plan note (written by TrainService on mesocycle creation, published as
-- MesoDay.note and snapshotted into MesoDayJson). The table holds both template rows
-- (template_session_id IS NULL) and instance rows, so reusing it would give one column two
-- meanings and could leak an instance's closing note onto the mesocycle-plan surface.
alter table workout_session add column closing_note text;
