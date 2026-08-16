-- DDL: mesocycle templates (mezo-meyc.1) — reusable Meso builder blueprint, run from via mesocycle.template_id
CREATE TABLE meso_template (
    id                UUID DEFAULT gen_random_uuid(),
    created_by        UUID NOT NULL,
    title             TEXT NOT NULL,
    short_title       TEXT,
    goal              TEXT,
    weeks             INTEGER NOT NULL,
    split             TEXT,
    style             TEXT,
    phase_curve       TEXT[] NOT NULL DEFAULT '{}',
    notes             TEXT,
    days              JSONB NOT NULL DEFAULT '[]',
    volume_per_muscle JSONB,
    is_deleted        BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_meso_template_id PRIMARY KEY (id),
    CONSTRAINT fk_meso_template_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE INDEX idx_meso_template_created_by ON meso_template (created_by);
