-- 202606271000_mezo-lmox_generalize_sport_session.sql
-- Generalize sport_session into a 3-kind modality (volleyball|cross|trx) for the progression
-- SPORT family. Reuse the existing `sport` column as the typed discriminator (add a CHECK); add a
-- `rounds` effort column for cross/TRX. Existing rows are all 'volleyball' -> no backfill needed.

ALTER TABLE sport_session
    ADD COLUMN rounds INT;

ALTER TABLE sport_session
    ADD CONSTRAINT ck_sport_session_sport CHECK (sport IN ('volleyball', 'cross', 'trx'));
