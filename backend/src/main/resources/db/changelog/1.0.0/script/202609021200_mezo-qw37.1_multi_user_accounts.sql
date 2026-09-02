-- Multi-user accounts S1 (mezo-qw37.1): account role/status/timezone/onboarding columns,
-- the invite table that gates registration, and the never-read user_profiles table goes.
-- Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §5.

ALTER TABLE app_user ADD COLUMN role                 VARCHAR(16)  NOT NULL DEFAULT 'USER';
ALTER TABLE app_user ADD COLUMN status               VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE app_user ADD COLUMN timezone             VARCHAR(64)  NOT NULL DEFAULT 'Europe/Budapest';
ALTER TABLE app_user ADD COLUMN onboarded_at         TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN must_change_password BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN last_seen_at         TIMESTAMPTZ;

ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role   CHECK (role IN ('OWNER', 'USER'));
ALTER TABLE app_user ADD CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'DISABLED'));

-- Backfill: every pre-existing account is the founder — owner role, already onboarded.
UPDATE app_user SET role = 'OWNER', onboarded_at = COALESCE(onboarded_at, created_at);

CREATE TABLE invite (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    code       VARCHAR(32)  NOT NULL,
    label      VARCHAR(120),
    created_by UUID         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    used_by    UUID,
    used_at    TIMESTAMPTZ,
    CONSTRAINT pk_invite_id PRIMARY KEY (id),
    CONSTRAINT uq_invite_code UNIQUE (code),
    CONSTRAINT fk_invite_created_by_app_user_id FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_invite_used_by_app_user_id    FOREIGN KEY (used_by)    REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX idx_invite_created_by ON invite (created_by);

-- user_profiles: written only by OwnerSeedData, read by nobody (name lives on app_user).
DROP TABLE user_profiles;
