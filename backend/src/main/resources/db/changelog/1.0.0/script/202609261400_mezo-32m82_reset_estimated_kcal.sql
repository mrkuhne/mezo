-- mezo-32m82: the activity-energy model became net-of-rest (Compendium 2024). Old ESTIMATES were
-- gross MET and are dropped once here; ActivityModelMigrationRunner re-estimates every row with
-- kcal IS NULL at boot. User-typed values (kcal_is_estimate = false) are untouched.
UPDATE sport_session SET kcal = NULL, kcal_is_estimate = NULL WHERE kcal_is_estimate = true;
UPDATE run_session_log SET kcal = NULL, kcal_is_estimate = NULL WHERE kcal_is_estimate = true;
