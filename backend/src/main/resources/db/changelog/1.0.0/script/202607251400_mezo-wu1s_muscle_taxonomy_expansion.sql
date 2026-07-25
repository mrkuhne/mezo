-- mezo-wu1s: expand the exercise muscle taxonomy 13 -> 21 head/zone-specific tokens.
-- The curated catalog content itself is re-upserted from content/exercise-catalog.json by
-- ExerciseCatalogLoader on the NEXT startup (runs after Liquibase). This migration only has to
-- (a) satisfy the new CHECK for rows present at Liquibase time (incl. user-created catalog rows
-- the loader never touches) and (b) rewrite historical exercise.muscle so the muscle-week map
-- renders old workouts in the new breakdown. muscle_group_volume_log + workout_session.muscle
-- summary strings are intentionally left coarse (MEV/MAV/MRV are per muscle GROUP).

-- 1. Drop the old 13-token CHECK so we can rewrite the data.
ALTER TABLE exercise_catalog DROP CONSTRAINT ck_exercise_catalog_muscle;

-- 2. Rewrite curated catalog rows by slug (mirror of the CSV migration).
UPDATE exercise_catalog AS c SET muscle = m.new_muscle
FROM (VALUES
    ('arnold-press', 'shoulder-front'),
    ('back-extension-45', 'back-lower'),
    ('barbell-bench-press', 'chest-mid'),
    ('barbell-curl', 'biceps-long'),
    ('bent-over-reverse-fly', 'shoulder-rear'),
    ('cable-curl', 'biceps-long'),
    ('cable-fly', 'chest-mid'),
    ('cable-lateral-raise', 'shoulder-side'),
    ('cable-overhead-extension', 'triceps-long'),
    ('cable-rear-delt-fly', 'shoulder-rear'),
    ('cable-upright-row', 'shoulder-side'),
    ('chin-up', 'back-wide'),
    ('close-grip-bench-press', 'triceps-lateral'),
    ('concentration-curl', 'biceps-short'),
    ('cross-body-hammer-curl', 'biceps-brachialis'),
    ('db-bench-press', 'chest-mid'),
    ('dead-hang', 'back-wide'),
    ('deficit-push-up', 'chest-mid'),
    ('drag-curl', 'biceps-long'),
    ('ez-bar-curl', 'biceps-short'),
    ('face-pull', 'shoulder-rear'),
    ('hammer-curl', 'biceps-brachialis'),
    ('incline-barbell-press', 'chest-upper'),
    ('incline-db-curl', 'biceps-long'),
    ('incline-db-press', 'chest-upper'),
    ('jm-press', 'triceps-lateral'),
    ('lat-pulldown-neutral', 'back-wide'),
    ('lat-pulldown-pronated', 'back-wide'),
    ('lateral-raise', 'shoulder-side'),
    ('low-to-high-cable-fly', 'chest-upper'),
    ('machine-chest-press', 'chest-mid'),
    ('machine-lateral-raise', 'shoulder-side'),
    ('machine-pullover', 'back-wide'),
    ('machine-shoulder-press', 'shoulder-front'),
    ('overhead-press', 'shoulder-front'),
    ('overhead-tricep-ext', 'triceps-long'),
    ('pec-deck', 'chest-mid'),
    ('preacher-curl', 'biceps-short'),
    ('pull-up', 'back-wide'),
    ('rear-delt-row', 'shoulder-rear'),
    ('reverse-pec-deck', 'shoulder-rear'),
    ('seated-db-shoulder-press', 'shoulder-front'),
    ('single-arm-lat-pulldown', 'back-wide'),
    ('single-arm-pushdown', 'triceps-medial'),
    ('skullcrusher', 'triceps-medial'),
    ('spider-curl', 'biceps-short'),
    ('straight-arm-pulldown', 'back-wide'),
    ('tricep-pushdown', 'triceps-medial'),
    ('weighted-dip', 'chest-lower'),
    ('weighted-pull-up', 'back-wide')
) AS m(slug, new_muscle)
WHERE c.slug = m.slug;

-- 3. Generic fallback for any remaining old-token rows (e.g. user-created catalog exercises).
UPDATE exercise_catalog AS c SET muscle = m.new_muscle
FROM (VALUES
    ('chest', 'chest-mid'),
    ('shoulder', 'shoulder-front'),
    ('rear-delt', 'shoulder-rear'),
    ('lats', 'back-wide'),
    ('biceps', 'biceps-long'),
    ('triceps', 'triceps-medial')
) AS m(old_muscle, new_muscle)
WHERE c.muscle = m.old_muscle;

-- 4. Re-add the CHECK with the 21-token taxonomy.
ALTER TABLE exercise_catalog ADD CONSTRAINT ck_exercise_catalog_muscle CHECK (muscle IN
    ('chest-upper','chest-mid','chest-lower','back-wide','back-mid','back-lower','traps','shoulder-front','shoulder-side','shoulder-rear','biceps-long','biceps-short','biceps-brachialis','triceps-long','triceps-lateral','triceps-medial','quad','ham','glute','calf','core'));

-- 5. Migrate historical exercise.muscle: catalog_id join first (authoritative), ...
UPDATE exercise AS e SET muscle = c.muscle
FROM exercise_catalog AS c
WHERE e.catalog_id = c.id AND e.muscle <> c.muscle;

-- 6. ... then case-insensitive name match for rows without a catalog link, ...
UPDATE exercise AS e SET muscle = c.muscle
FROM exercise_catalog AS c
WHERE e.catalog_id IS NULL AND lower(e.name) = lower(c.name) AND e.muscle <> c.muscle;

-- 7. ... then the generic fallback for whatever old tokens still remain.
UPDATE exercise AS e SET muscle = m.new_muscle
FROM (VALUES
    ('chest', 'chest-mid'),
    ('shoulder', 'shoulder-front'),
    ('rear-delt', 'shoulder-rear'),
    ('lats', 'back-wide'),
    ('biceps', 'biceps-long'),
    ('triceps', 'triceps-medial')
) AS m(old_muscle, new_muscle)
WHERE e.muscle = m.old_muscle;
