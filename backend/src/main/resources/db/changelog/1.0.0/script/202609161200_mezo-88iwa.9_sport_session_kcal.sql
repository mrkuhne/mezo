-- 202609161200_mezo-88iwa.9_sport_session_kcal.sql
-- Sport and run sessions carry the burnt energy: `kcal` plus `kcal_is_estimate` (true = the
-- backend's personalised MET estimate, false = the user's own override). Both stay NULL when the
-- athlete's weight is unknown — a missing estimate is never stored as 0.
-- The sport vocabulary also widens from the 3-kind modality to the ten Titanium sports; existing
-- rows keep their spelling (volleyball|cross|trx), so no backfill is needed.

ALTER TABLE sport_session
    ADD COLUMN kcal INT,
    ADD COLUMN kcal_is_estimate BOOLEAN;

ALTER TABLE sport_session
    DROP CONSTRAINT ck_sport_session_sport;

ALTER TABLE sport_session
    ADD CONSTRAINT ck_sport_session_sport CHECK (sport IN (
        'volleyball', 'cross', 'trx', 'bike', 'swim', 'football',
        'basketball', 'tennis', 'hike', 'other'));

ALTER TABLE run_session_log
    ADD COLUMN kcal INT,
    ADD COLUMN kcal_is_estimate BOOLEAN;
