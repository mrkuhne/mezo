CREATE TABLE person (
    id                    UUID DEFAULT gen_random_uuid(),
    created_by            UUID NOT NULL,
    name                  VARCHAR(120) NOT NULL,
    initial               VARCHAR(8) NOT NULL,
    relationship          TEXT NOT NULL,
    relationship_hu       VARCHAR(120) NOT NULL,
    affect_baseline       TEXT NOT NULL,
    contact_cadence_label VARCHAR(120),
    notes                 VARCHAR(500),
    known_facts           TEXT[] NOT NULL DEFAULT '{}',
    ties                  TEXT[] NOT NULL DEFAULT '{}',
    affect_trend          INTEGER[] NOT NULL DEFAULT '{}',
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_person_id PRIMARY KEY (id),
    CONSTRAINT fk_person_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_person_relationship CHECK (relationship IN ('partner','teammate','mentee')),
    CONSTRAINT ck_person_affect_baseline
        CHECK (affect_baseline IN ('positive','neutral','mixed','negative'))
);
CREATE INDEX idx_person_created_by ON person (created_by);

CREATE TABLE mention (
    id            UUID DEFAULT gen_random_uuid(),
    created_by    UUID NOT NULL,
    person_id     UUID NOT NULL,
    ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
    source        TEXT NOT NULL,
    duration_s    INTEGER,
    excerpt       VARCHAR(500) NOT NULL DEFAULT '',
    tone          TEXT NOT NULL,
    tied_to_kind  VARCHAR(40),
    tied_to_label VARCHAR(120),
    flagged       BOOLEAN NOT NULL DEFAULT false,
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_mention_id PRIMARY KEY (id),
    CONSTRAINT fk_mention_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_mention_person_id_person_id
        FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE CASCADE,
    CONSTRAINT ck_mention_source CHECK (source IN ('voice','camera','chip','text')),
    CONSTRAINT ck_mention_tone CHECK (tone IN ('positive','neutral','mixed','negative'))
);
CREATE INDEX idx_mention_created_by_ts ON mention (created_by, ts);
