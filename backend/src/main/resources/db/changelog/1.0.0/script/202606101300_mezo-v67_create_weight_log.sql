CREATE TABLE weight_log (
    id         UUID DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    date       DATE NOT NULL,
    weight_kg  NUMERIC(5,2) NOT NULL,
    note       VARCHAR(500),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_weight_log_id PRIMARY KEY (id),
    CONSTRAINT fk_weight_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE INDEX idx_weight_log_created_by_date ON weight_log (created_by, date);
