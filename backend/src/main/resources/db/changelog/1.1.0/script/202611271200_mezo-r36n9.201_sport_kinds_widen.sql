-- 202611271200_mezo-r36n9.201_sport_kinds_widen.sql
-- Boop Sport S1: one sport vocabulary everywhere. The weekly sport slots and the one-off events only
-- accepted volleyball|cross|trx while the log accepted ten kinds; all three now take the log's ten plus
-- `running` (journal + schedule only, owner Q1 2026-11-27). Pure widening — every existing row stays valid.

ALTER TABLE sport_session DROP CONSTRAINT ck_sport_session_sport;
ALTER TABLE sport_session ADD CONSTRAINT ck_sport_session_sport CHECK (sport IN (
    'volleyball', 'cross', 'trx', 'bike', 'swim', 'football',
    'basketball', 'tennis', 'hike', 'running', 'other'));

ALTER TABLE sport_schedule_slot DROP CONSTRAINT ck_sport_schedule_slot_sport;
ALTER TABLE sport_schedule_slot ADD CONSTRAINT ck_sport_schedule_slot_sport CHECK (sport IN (
    'volleyball', 'cross', 'trx', 'bike', 'swim', 'football',
    'basketball', 'tennis', 'hike', 'running', 'other'));

ALTER TABLE sport_event DROP CONSTRAINT ck_sport_event_sport;
ALTER TABLE sport_event ADD CONSTRAINT ck_sport_event_sport CHECK (sport IN (
    'volleyball', 'cross', 'trx', 'bike', 'swim', 'football',
    'basketball', 'tennis', 'hike', 'running', 'other'));
