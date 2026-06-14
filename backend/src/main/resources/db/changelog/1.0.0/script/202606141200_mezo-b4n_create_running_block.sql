-- DDL: Futás R0 — running_block (interval-plan "Terv" with typed jsonb structure)
CREATE TABLE running_block (
    id           UUID DEFAULT gen_random_uuid(),
    created_by   UUID NOT NULL,
    title        TEXT NOT NULL,
    goal         TEXT,
    kind         TEXT NOT NULL DEFAULT 'interval',
    status       TEXT NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    weeks        INT  NOT NULL,
    current_week INT  NOT NULL DEFAULT 0,
    summary      TEXT,
    structure    JSONB NOT NULL,
    is_deleted   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_running_block_id PRIMARY KEY (id),
    CONSTRAINT fk_running_block_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_running_block_status CHECK (status IN ('planned','active','archived')),
    CONSTRAINT ck_running_block_kind CHECK (kind IN ('interval'))
);
CREATE INDEX idx_running_block_created_by ON running_block (created_by);
