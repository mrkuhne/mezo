-- Check-in 2.0 (mezo-ck2): 14 items, per-slot plan, question of the day, quick exit.
-- Every new answer column is NULLABLE with NO default: NULL = not answered (skipped or not asked).
-- asked_items tells the two apart (asked + NULL = skipped); NULL asked_items = legacy row.
ALTER TABLE check_in
    ADD COLUMN mood            SMALLINT,
    ADD COLUMN rested          SMALLINT,
    ADD COLUMN soreness        SMALLINT,
    ADD COLUMN pain            BOOLEAN,
    ADD COLUMN pain_regions    VARCHAR(16)[],
    ADD COLUMN pain_intensity  SMALLINT,
    ADD COLUMN motivation      SMALLINT,
    ADD COLUMN hunger          SMALLINT,
    ADD COLUMN craving         SMALLINT,
    ADD COLUMN craving_kinds   VARCHAR(8)[],
    ADD COLUMN digestion       SMALLINT,
    ADD COLUMN connection      SMALLINT,
    ADD COLUMN day_rating      SMALLINT,
    ADD COLUMN asked_items     VARCHAR(16)[],
    ADD COLUMN adaptive_item   VARCHAR(16),
    ADD COLUMN adaptive_reason VARCHAR(16),
    ADD COLUMN quick_exit      BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE check_in
    ADD CONSTRAINT ck_check_in_mood_range           CHECK (mood BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_rested_range         CHECK (rested BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_soreness_range       CHECK (soreness BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_pain_intensity_range CHECK (pain_intensity BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_motivation_range     CHECK (motivation BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_hunger_range         CHECK (hunger BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_craving_range        CHECK (craving BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_digestion_range      CHECK (digestion BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_connection_range     CHECK (connection BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_day_rating_range     CHECK (day_rating BETWEEN 1 AND 10),
    ADD CONSTRAINT ck_check_in_pain_regions CHECK (pain_regions <@ ARRAY[
        'FEJ','NYAK','VALL','KONYOK','CSUKLO_KEZ','FELSO_HAT','DEREK','CSIPO','HAS','TERD',
        'BOKA_LABFEJ','EGYEB']::VARCHAR(16)[]),
    ADD CONSTRAINT ck_check_in_craving_kinds CHECK (craving_kinds <@ ARRAY[
        'EDES','SOS','ZSIROS','BARMIT']::VARCHAR(8)[]),
    ADD CONSTRAINT ck_check_in_asked_items CHECK (asked_items <@ ARRAY[
        'energy','mood','stress','body','mental','rested','soreness','pain','motivation','hunger',
        'craving','digestion','connection','day']::VARCHAR(16)[]),
    ADD CONSTRAINT ck_check_in_adaptive_item CHECK (adaptive_item IN (
        'energy','mood','stress','body','mental','rested','soreness','pain','motivation','hunger',
        'craving','digestion','connection','day')),
    ADD CONSTRAINT ck_check_in_adaptive_reason CHECK (adaptive_reason IN ('NEED','RANDOM'));
