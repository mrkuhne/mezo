-- DDL: one-off (non-recurring) sport events — a dated session/match outside the weekly
-- sport_schedule_slot rhythm (mezo-e1sp). Mirrors sport_schedule_slot's columns, with a
-- concrete DATE instead of day_of_week; kind/sport share the same CHECK vocabularies.
CREATE TABLE sport_event (
    id              UUID DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL,
    date            DATE NOT NULL,
    time            VARCHAR(5) NOT NULL,
    duration_min    INT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'training',
    sport           TEXT NOT NULL DEFAULT 'volleyball',
    location        TEXT,
    intensity_label TEXT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_sport_event_id PRIMARY KEY (id),
    CONSTRAINT fk_sport_event_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_sport_event_kind CHECK (kind IN ('training', 'match')),
    CONSTRAINT ck_sport_event_sport CHECK (sport IN ('volleyball', 'cross', 'trx'))
);
CREATE INDEX idx_sport_event_created_by_date ON sport_event (created_by, date);
