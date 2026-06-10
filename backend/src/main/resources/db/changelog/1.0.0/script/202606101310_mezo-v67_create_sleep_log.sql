CREATE TABLE sleep_log (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    date        DATE NOT NULL,
    bedtime     VARCHAR(5),
    wakeup      VARCHAR(5),
    duration_h  NUMERIC(4,2),
    quality     INT,
    awakenings  INT,
    notes       VARCHAR(500),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_sleep_log_id PRIMARY KEY (id),
    CONSTRAINT fk_sleep_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_sleep_log_quality_range CHECK (quality IS NULL OR quality BETWEEN 1 AND 10)
);
CREATE INDEX idx_sleep_log_created_by_date ON sleep_log (created_by, date);
