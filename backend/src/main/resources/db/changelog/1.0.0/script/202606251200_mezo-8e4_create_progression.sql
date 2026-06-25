-- Progression domain (mezo-8e4): per-skill XP accumulator, XP-grant event ledger, perk unlocks.

CREATE TABLE skill_progress (
    id             UUID DEFAULT gen_random_uuid(),
    created_by     UUID NOT NULL,
    skill_key      TEXT NOT NULL,
    skill_kind     TEXT NOT NULL,        -- ATHLETIC|MUSCLE (DB CHECK)
    cumulative_xp  BIGINT NOT NULL DEFAULT 0,
    current_level  INTEGER NOT NULL DEFAULT 1,
    is_deleted     BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_skill_progress_id PRIMARY KEY (id),
    CONSTRAINT fk_skill_progress_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_skill_progress_kind CHECK (skill_kind IN ('ATHLETIC', 'MUSCLE')),
    CONSTRAINT ck_skill_progress_level CHECK (current_level >= 1),
    CONSTRAINT uq_skill_progress_created_by_skill_key UNIQUE (created_by, skill_key)
);
CREATE INDEX idx_skill_progress_created_by ON skill_progress (created_by);

-- One row per XP-granting workout regardless of whether a level was crossed (levelUps[] may be empty).
CREATE TABLE level_up_event (
    id             UUID DEFAULT gen_random_uuid(),
    created_by     UUID NOT NULL,
    source_type    TEXT NOT NULL,        -- GYM|SPORT|RUN (DB CHECK)
    source_ref_id  UUID NOT NULL,        -- polymorphic ref to gym instance / sport / run session; intentionally NOT an FK
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_xp       BIGINT NOT NULL,
    payload        JSONB NOT NULL,
    is_deleted     BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_level_up_event_id PRIMARY KEY (id),
    CONSTRAINT fk_level_up_event_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_level_up_event_source_type CHECK (source_type IN ('GYM', 'SPORT', 'RUN')),
    CONSTRAINT uq_level_up_event_created_by_source UNIQUE (created_by, source_type, source_ref_id)
);
CREATE INDEX idx_level_up_event_created_by ON level_up_event (created_by);

CREATE TABLE perk_unlock (
    id              UUID DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL,
    skill_key       TEXT NOT NULL,
    perk_key        TEXT NOT NULL,
    milestone_level INTEGER NOT NULL,
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_perk_unlock_id PRIMARY KEY (id),
    CONSTRAINT fk_perk_unlock_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_perk_unlock_milestone CHECK (milestone_level >= 1),
    CONSTRAINT uq_perk_unlock_created_by_perk UNIQUE (created_by, perk_key)
);
CREATE INDEX idx_perk_unlock_created_by ON perk_unlock (created_by);
