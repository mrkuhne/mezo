-- DDL: mezo-05v6 — sport discriminator on the recurring weekly sport schedule slots,
-- so TRX/cross slots can be scheduled alongside volleyball (same token set as
-- ck_sport_session_sport). Existing rows become volleyball via the default.
ALTER TABLE sport_schedule_slot
    ADD COLUMN sport TEXT NOT NULL DEFAULT 'volleyball';
ALTER TABLE sport_schedule_slot
    ADD CONSTRAINT ck_sport_schedule_slot_sport CHECK (sport IN ('volleyball', 'cross', 'trx'));
