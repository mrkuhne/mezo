-- mezo-7ot: exercise catalog (master data) + catalog linkage and plyo type on exercise.
-- exercise_catalog is CONTENT, not user data: no created_by, no is_deleted; rows are
-- upserted by slug from content/exercise-catalog.json at startup (ExerciseCatalogLoader).

CREATE TABLE exercise_catalog (
    id         UUID DEFAULT gen_random_uuid(),
    slug       TEXT NOT NULL,
    name       TEXT NOT NULL,
    muscle     TEXT NOT NULL,
    type       TEXT NOT NULL,
    stim       NUMERIC(3,2) NOT NULL,
    fatigue    NUMERIC(3,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_exercise_catalog_id PRIMARY KEY (id),
    CONSTRAINT uq_exercise_catalog_slug UNIQUE (slug),
    CONSTRAINT ck_exercise_catalog_muscle CHECK (muscle IN
        ('back-mid','lats','chest','shoulder','rear-delt','biceps','triceps',
         'quad','ham','glute','calf','core','traps')),
    CONSTRAINT ck_exercise_catalog_type CHECK (type IN ('compound','isolation','plyo')),
    CONSTRAINT ck_exercise_catalog_stim CHECK (stim >= 0 AND stim <= 1),
    CONSTRAINT ck_exercise_catalog_fatigue CHECK (fatigue >= 0 AND fatigue <= 1)
);

-- Nullable linkage from a planned day-exercise back to master data; catalog rows are
-- not deleted in practice, but a content removal must never break historical days.
ALTER TABLE exercise ADD COLUMN catalog_id UUID;
ALTER TABLE exercise ADD CONSTRAINT fk_exercise_catalog_id_exercise_catalog_id
    FOREIGN KEY (catalog_id) REFERENCES exercise_catalog(id) ON DELETE SET NULL;

-- plyo joins the type taxonomy (released changeset is immutable -> drop + re-add here).
ALTER TABLE exercise DROP CONSTRAINT ck_exercise_type;
ALTER TABLE exercise ADD CONSTRAINT ck_exercise_type
    CHECK (type IN ('compound','isolation','plyo'));
