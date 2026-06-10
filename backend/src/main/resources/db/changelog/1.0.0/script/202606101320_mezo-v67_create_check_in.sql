CREATE TABLE check_in (
    id          UUID DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    date        DATE NOT NULL,
    slot_time   VARCHAR(5) NOT NULL,
    state       VARCHAR(10) NOT NULL,
    energy      INT,
    stress      INT,
    body        INT,
    mental      INT,
    note        VARCHAR(500),
    saved_at    TIMESTAMPTZ,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_check_in_id PRIMARY KEY (id),
    CONSTRAINT fk_check_in_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_check_in_created_by_date_slot UNIQUE (created_by, date, slot_time),
    CONSTRAINT ck_check_in_state CHECK (state IN ('done','now','skipped','pending'))
);
CREATE INDEX idx_check_in_created_by_date ON check_in (created_by, date);
