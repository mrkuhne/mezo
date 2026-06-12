-- DDL: T3 (sport) — recurring weekly sport schedule slots (volleyball week plan).
-- day_of_week: 0=Hét .. 6=Vas (matches the FE DAY_ORDER index).
CREATE TABLE sport_schedule_slot (
    id              UUID DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL,
    day_of_week     SMALLINT NOT NULL,
    time            VARCHAR(5) NOT NULL,
    duration_min    INT NOT NULL,
    kind            TEXT NOT NULL,
    location        TEXT,
    intensity_label TEXT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_sport_schedule_slot_id PRIMARY KEY (id),
    CONSTRAINT fk_sport_schedule_slot_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_sport_schedule_slot_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT ck_sport_schedule_slot_kind CHECK (kind IN ('training', 'match'))
);
CREATE INDEX idx_sport_schedule_slot_created_by_day_of_week
    ON sport_schedule_slot (created_by, day_of_week);
