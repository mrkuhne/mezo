-- Emberek S1 (mezo-06o0): person CRUD + detektálás-kész séma (spec §2).
ALTER TABLE person
    ADD COLUMN aliases     TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN status      TEXT   NOT NULL DEFAULT 'active',
    ADD COLUMN source_kind TEXT   NOT NULL DEFAULT 'manual';
ALTER TABLE person
    ADD CONSTRAINT ck_person_status CHECK (status IN ('candidate','active','archived'));
ALTER TABLE person
    ADD CONSTRAINT ck_person_source_kind CHECK (source_kind IN ('manual','extractor','seed'));
ALTER TABLE person DROP CONSTRAINT ck_person_relationship;
ALTER TABLE person
    ADD CONSTRAINT ck_person_relationship
        CHECK (relationship IN ('partner','friend','family','colleague','teammate','mentee'));

ALTER TABLE mention
    ADD COLUMN intensity       SMALLINT,
    ADD COLUMN context_label   TEXT,
    ADD COLUMN source_ref_kind TEXT,
    ADD COLUMN source_ref_id   UUID;
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_intensity CHECK (intensity BETWEEN 1 AND 3);
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_context_label CHECK (context_label IN
        ('munka','csalad','baratok','edzes','konfliktus','kozos_program','segitseg','egyeb'));
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_source_ref_kind CHECK (source_ref_kind IN
        ('journal_entry','reflection','gratitude','decision','activity_note','checkin_note','chat_turn'));
ALTER TABLE mention DROP CONSTRAINT ck_mention_source;
ALTER TABLE mention
    ADD CONSTRAINT ck_mention_source CHECK (source IN ('voice','camera','chip','text','chat'));
-- S2 (auto-mention) tónus nélkül ír; az enrichment tölti. Entity-szinten S1-ben még @NotNull.
ALTER TABLE mention ALTER COLUMN tone DROP NOT NULL;
-- Automata útvonal dedup-horgonya (S2 használja; már most létezik, hogy a séma egyben legyen).
CREATE UNIQUE INDEX uq_mention_source_ref
    ON mention (created_by, person_id, source_ref_kind, source_ref_id)
    WHERE source IN ('text','chat') AND is_deleted = false;
