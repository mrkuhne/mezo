-- DDL: Slice B (Train) — mesocycles, volume logs, workout sessions, exercises, sets, sport sessions
CREATE TABLE mesocycle (
    id               UUID DEFAULT gen_random_uuid(),
    created_by       UUID NOT NULL,
    title            TEXT NOT NULL,
    short_title      TEXT NOT NULL,
    status           TEXT NOT NULL,
    goal             TEXT,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    weeks            INT NOT NULL,
    current_week     INT NOT NULL DEFAULT 0,
    split            TEXT NOT NULL,
    style            TEXT NOT NULL,
    phase_curve      TEXT[] NOT NULL,
    notes            TEXT,
    summary          TEXT,
    volume_recompute JSONB,
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_mesocycle_id PRIMARY KEY (id),
    CONSTRAINT fk_mesocycle_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_mesocycle_status CHECK (status IN ('active','planned','archived'))
);
CREATE INDEX idx_mesocycle_created_by ON mesocycle (created_by);

CREATE TABLE muscle_group_volume_log (
    id           UUID DEFAULT gen_random_uuid(),
    created_by   UUID NOT NULL,
    mesocycle_id UUID NOT NULL,
    muscle       TEXT NOT NULL,
    mev          INT NOT NULL,
    mav          INT NOT NULL,
    mrv          INT NOT NULL,
    current_sets INT NOT NULL,
    source       JSONB NOT NULL,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_muscle_group_volume_log_id PRIMARY KEY (id),
    CONSTRAINT fk_muscle_group_volume_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_muscle_group_volume_log_mesocycle_id_mesocycle_id
        FOREIGN KEY (mesocycle_id) REFERENCES mesocycle(id) ON DELETE CASCADE,
    CONSTRAINT uq_muscle_group_volume_log_mesocycle_id_muscle UNIQUE (mesocycle_id, muscle)
);
CREATE INDEX idx_muscle_group_volume_log_mesocycle_id ON muscle_group_volume_log (mesocycle_id);

CREATE TABLE workout_session (
    id            UUID DEFAULT gen_random_uuid(),
    created_by    UUID NOT NULL,
    mesocycle_id  UUID,
    day_label     TEXT NOT NULL,
    type          TEXT NOT NULL,
    muscle        TEXT NOT NULL DEFAULT '',
    muscle_accent BOOLEAN NOT NULL DEFAULT false,
    note          TEXT,
    date          DATE,
    status        TEXT NOT NULL DEFAULT 'planned',
    duration_est  INT,
    order_index   INT NOT NULL DEFAULT 0,
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_workout_session_id PRIMARY KEY (id),
    CONSTRAINT fk_workout_session_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_session_mesocycle_id_mesocycle_id
        FOREIGN KEY (mesocycle_id) REFERENCES mesocycle(id) ON DELETE SET NULL,
    CONSTRAINT ck_workout_session_status CHECK (status IN ('planned','active','completed','skipped'))
);
CREATE INDEX idx_workout_session_mesocycle_id ON workout_session (mesocycle_id);

CREATE TABLE exercise (
    id                 UUID DEFAULT gen_random_uuid(),
    created_by         UUID NOT NULL,
    workout_session_id UUID NOT NULL,
    name               TEXT NOT NULL,
    muscle             TEXT NOT NULL DEFAULT '',
    sets               INT NOT NULL,
    target_reps        TEXT NOT NULL,
    target_rir         INT NOT NULL,
    type               TEXT NOT NULL,
    warning            TEXT,
    order_index        INT NOT NULL DEFAULT 0,
    is_deleted         BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_exercise_id PRIMARY KEY (id),
    CONSTRAINT fk_exercise_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_workout_session_id_workout_session_id
        FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE,
    CONSTRAINT ck_exercise_type CHECK (type IN ('compound','isolation'))
);
CREATE INDEX idx_exercise_workout_session_id ON exercise (workout_session_id);

CREATE TABLE exercise_set (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    exercise_id UUID NOT NULL,
    set_index   INT NOT NULL,
    weight_kg   NUMERIC(6,2),
    reps        INT,
    rir         INT,
    side        TEXT,
    voice_note  TEXT,
    done_at     TIMESTAMPTZ,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_exercise_set_id PRIMARY KEY (id),
    CONSTRAINT fk_exercise_set_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_set_exercise_id_exercise_id
        FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE,
    CONSTRAINT ck_exercise_set_side CHECK (side IS NULL OR side IN ('L','B','R'))
);
CREATE INDEX idx_exercise_set_exercise_id ON exercise_set (exercise_id);

CREATE TABLE sport_session (
    id              UUID DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL,
    sport           TEXT NOT NULL DEFAULT 'volleyball',
    date            DATE NOT NULL,
    time            VARCHAR(5),
    duration_min    INT,
    sets_played     INT,
    intensity       INT,
    rpe             NUMERIC(3,1),
    shoulder_strain INT,
    jump_count      INT,
    notes           TEXT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_sport_session_id PRIMARY KEY (id),
    CONSTRAINT fk_sport_session_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_sport_session_intensity
        CHECK (intensity IS NULL OR intensity BETWEEN 1 AND 10),
    CONSTRAINT ck_sport_session_shoulder_strain
        CHECK (shoulder_strain IS NULL OR shoulder_strain BETWEEN 1 AND 10)
);
CREATE INDEX idx_sport_session_created_by_date ON sport_session (created_by, date);
