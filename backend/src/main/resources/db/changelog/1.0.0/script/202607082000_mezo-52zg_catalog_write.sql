-- mezo-52zg: make exercise_catalog writable (user-authored exercises) + demo video.
-- created_by NULL = master content (loader-owned); set = user-authored (soft-deletable).
-- video_url settable on any row; the loader preserves it (never clobbers a user video).
ALTER TABLE exercise_catalog ADD COLUMN created_by UUID;
ALTER TABLE exercise_catalog ADD CONSTRAINT fk_exercise_catalog_created_by_app_user_id
    FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE;
ALTER TABLE exercise_catalog ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exercise_catalog ADD COLUMN video_url TEXT;
CREATE INDEX idx_exercise_catalog_created_by ON exercise_catalog (created_by);
