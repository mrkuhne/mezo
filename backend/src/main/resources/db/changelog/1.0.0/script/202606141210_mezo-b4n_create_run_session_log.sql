-- DDL: Futás R0 — run_session_log (logged actuals vs a prescribed session)
CREATE TABLE run_session_log (
    id               UUID DEFAULT gen_random_uuid(),
    created_by       UUID NOT NULL,
    block_id         UUID NOT NULL,
    week_number      INT  NOT NULL,
    session_key      TEXT NOT NULL,
    date             DATE NOT NULL,
    completed_rounds INT,
    rpe_actual       INT,
    hr_recovery_sec  INT,
    sprint_landmark  TEXT,
    duration_min     INT,
    notes            TEXT,
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_run_session_log_id PRIMARY KEY (id),
    CONSTRAINT fk_run_session_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_session_log_block
        FOREIGN KEY (block_id) REFERENCES running_block(id) ON DELETE CASCADE,
    CONSTRAINT ck_run_session_log_rpe CHECK (rpe_actual IS NULL OR rpe_actual BETWEEN 1 AND 10)
);
CREATE INDEX idx_run_session_log_created_by ON run_session_log (created_by);
CREATE INDEX idx_run_session_log_block ON run_session_log (block_id);
