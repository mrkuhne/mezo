CREATE TABLE goal (
    id                       UUID DEFAULT gen_random_uuid(),
    created_by               UUID NOT NULL,
    title                    TEXT NOT NULL,
    trajectory               TEXT NOT NULL,
    guards                   TEXT[] NOT NULL DEFAULT '{}',
    status                   TEXT NOT NULL,
    start_date               DATE NOT NULL,
    target_date              DATE NOT NULL,
    start_weight_kg          NUMERIC(5,2) NOT NULL,
    target_weight_kg         NUMERIC(5,2),
    rate_target_pct_per_week NUMERIC(4,2) NOT NULL,
    identity_frame           TEXT,
    is_deleted               BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_goal_id PRIMARY KEY (id),
    CONSTRAINT fk_goal_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_goal_trajectory CHECK (trajectory IN ('cut','bulk','maintain')),
    CONSTRAINT ck_goal_status CHECK (status IN ('planned','active','archived'))
);
CREATE INDEX idx_goal_created_by ON goal (created_by);

CREATE TABLE biometric_profile (
    id            UUID DEFAULT gen_random_uuid(),
    created_by    UUID NOT NULL,
    sex           TEXT NOT NULL,
    height_cm     NUMERIC(5,2) NOT NULL,
    birth_date    DATE NOT NULL,
    body_fat_pct  NUMERIC(4,2),
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_biometric_profile_id PRIMARY KEY (id),
    CONSTRAINT fk_biometric_profile_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_biometric_profile_sex CHECK (sex IN ('M','F')),
    CONSTRAINT uq_biometric_profile_created_by UNIQUE (created_by)
);
