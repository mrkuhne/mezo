-- DDL: identity + profile (single-user; created_by lives on owned domain tables, not here)
CREATE TABLE app_user (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_email UNIQUE (email)
);

CREATE TABLE user_profiles (
    created_by   UUID PRIMARY KEY,
    handle       VARCHAR(60),
    birth_date   DATE,
    member_since DATE NOT NULL DEFAULT current_date,
    streak_days  INT NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_profiles_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
