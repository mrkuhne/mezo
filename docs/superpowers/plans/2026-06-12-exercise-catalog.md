# Exercise Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend-served curated exercise catalog (110 items incl. a 12-item plyo block) feeding the meso wizard's exercise picker, with `catalogId` linkage on picked exercises.

**Architecture:** New `exercise_catalog` master-data table (no `created_by`, no soft delete) loaded by an idempotent startup loader from a bundled JSON (upsert by `slug`, all profiles). New `GET /api/train/exercises` (contract-first). The existing `exercise` table gains a nullable `catalog_id` FK and the `type` taxonomy gains `plyo` everywhere (DB CHECK, contract enums, FE union). FE: `useTrain().exerciseLibrary` keeps its shape but maps from the API in real mode; the picker gains plyo/calf/core/traps filter chips.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase plain-SQL, PostgreSQL 16, MapStruct/Lombok, OpenAPI contract-first codegen, React 19 + TanStack Query + MSW/Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-exercise-catalog-design.md` · **bd:** mezo-7ot

**Conventions that bind every task:** docs/references/ `java_package_structure.md`, `spring_patterns.md`, `error_handling.md`, `liquibase_conventions.md`, `testing_standards.md`, `integration_test_framework.md`, `api_contract_conventions.md`. Always `./mvnw clean test` (never without `clean`). All `cd` commands use absolute paths (shell cwd resets between calls).

**Content-count note:** the curated list is exactly **110 items** (spec said ~120; smaller groups — rear-delt 5, traps 4, calf 5 — are realistically thinner than the 8–14 guideline; all 21 Phase-1 names/values are kept verbatim, and `Standing Calf Raise` is included because `frontend/src/features/train/planner.ts` generates it).

---

### Task 0: Branch + claim

- [ ] **Step 0.1:**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git checkout -b feat/exercise-catalog
bd update mezo-7ot --claim
```

---

### Task 1: Liquibase migration (schema only)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606121400_mezo-7ot_exercise_catalog.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (doc comment only)

- [ ] **Step 1.1: Write the SQL changeset**

```sql
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
```

- [ ] **Step 1.2: Register in the master changelog** — append to `1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202606121400_mezo-7ot_exercise_catalog"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606121400_mezo-7ot_exercise_catalog.sql
```

- [ ] **Step 1.3: ResetDatabase doc note** — in `ResetDatabase.java`, extend the class javadoc growth-rule paragraph with:

```java
 * <p><b>exercise_catalog is master data</b> (content, no created_by) — it must NOT join the
 * TRUNCATE list; the startup ExerciseCatalogLoader owns it.
```

- [ ] **Step 1.4: Verify the migration applies** (compose Postgres must be up: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose up -d`)

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=TrainSeedDataIT`
Expected: PASS (context boots ⇒ Liquibase ran both new statements).

Inspect: `docker exec backend-postgres-1 psql -U mezo -d mezo_test -c "\d exercise_catalog"` → table with the 6 CHECK/UQ constraints; `\d exercise` → `catalog_id` column + new `ck_exercise_type`.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add backend/src/main/resources/db backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java && git commit -m "feat(train): exercise_catalog schema + exercise.catalog_id + plyo type (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Content JSON + entity + repository + loader (TDD)

**Files:**
- Create: `backend/src/main/resources/content/exercise-catalog.json`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseCatalogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseCatalogRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoader.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoaderIT.java`

- [ ] **Step 2.1: Write the content JSON** — `backend/src/main/resources/content/exercise-catalog.json`. The 21 Phase-1 items keep their exact name/stim/fatigue (`frontend/src/data/train.ts:435`). Full content (110 items):

```json
[
  { "slug": "chest-supported-row", "name": "Chest Supported Row", "muscle": "back-mid", "type": "compound", "stim": 0.92, "fatigue": 0.55 },
  { "slug": "t-bar-row", "name": "T-Bar Row", "muscle": "back-mid", "type": "compound", "stim": 0.88, "fatigue": 0.65 },
  { "slug": "cable-pull-around", "name": "Cable Pull-Around", "muscle": "back-mid", "type": "isolation", "stim": 0.72, "fatigue": 0.25 },
  { "slug": "barbell-row", "name": "Barbell Row", "muscle": "back-mid", "type": "compound", "stim": 0.86, "fatigue": 0.70 },
  { "slug": "pendlay-row", "name": "Pendlay Row", "muscle": "back-mid", "type": "compound", "stim": 0.84, "fatigue": 0.68 },
  { "slug": "single-arm-db-row", "name": "Single-Arm DB Row", "muscle": "back-mid", "type": "compound", "stim": 0.82, "fatigue": 0.45 },
  { "slug": "seal-row", "name": "Seal Row", "muscle": "back-mid", "type": "compound", "stim": 0.88, "fatigue": 0.50 },
  { "slug": "seated-cable-row-neutral", "name": "Seated Cable Row · Neutral", "muscle": "back-mid", "type": "compound", "stim": 0.84, "fatigue": 0.45 },
  { "slug": "meadows-row", "name": "Meadows Row", "muscle": "back-mid", "type": "compound", "stim": 0.78, "fatigue": 0.50 },
  { "slug": "inverted-row", "name": "Inverted Row", "muscle": "back-mid", "type": "compound", "stim": 0.68, "fatigue": 0.30 },
  { "slug": "machine-high-row", "name": "Machine High Row", "muscle": "back-mid", "type": "compound", "stim": 0.80, "fatigue": 0.40 },
  { "slug": "lat-pulldown-pronated", "name": "Lat Pulldown · Pronated", "muscle": "lats", "type": "compound", "stim": 0.84, "fatigue": 0.40 },
  { "slug": "lat-pulldown-neutral", "name": "Lat Pulldown · Neutral", "muscle": "lats", "type": "compound", "stim": 0.82, "fatigue": 0.40 },
  { "slug": "pull-up", "name": "Pull-Up", "muscle": "lats", "type": "compound", "stim": 0.90, "fatigue": 0.50 },
  { "slug": "chin-up", "name": "Chin-Up", "muscle": "lats", "type": "compound", "stim": 0.88, "fatigue": 0.50 },
  { "slug": "weighted-pull-up", "name": "Weighted Pull-Up", "muscle": "lats", "type": "compound", "stim": 0.92, "fatigue": 0.60 },
  { "slug": "straight-arm-pulldown", "name": "Straight-Arm Pulldown", "muscle": "lats", "type": "isolation", "stim": 0.70, "fatigue": 0.22 },
  { "slug": "single-arm-lat-pulldown", "name": "Single-Arm Lat Pulldown", "muscle": "lats", "type": "compound", "stim": 0.78, "fatigue": 0.35 },
  { "slug": "machine-pullover", "name": "Machine Pullover", "muscle": "lats", "type": "isolation", "stim": 0.74, "fatigue": 0.25 },
  { "slug": "barbell-bench-press", "name": "Barbell Bench Press", "muscle": "chest", "type": "compound", "stim": 0.94, "fatigue": 0.70 },
  { "slug": "incline-db-press", "name": "Incline DB Press", "muscle": "chest", "type": "compound", "stim": 0.86, "fatigue": 0.50 },
  { "slug": "cable-fly", "name": "Cable Fly", "muscle": "chest", "type": "isolation", "stim": 0.74, "fatigue": 0.25 },
  { "slug": "db-bench-press", "name": "DB Bench Press", "muscle": "chest", "type": "compound", "stim": 0.88, "fatigue": 0.55 },
  { "slug": "incline-barbell-press", "name": "Incline Barbell Press", "muscle": "chest", "type": "compound", "stim": 0.90, "fatigue": 0.65 },
  { "slug": "machine-chest-press", "name": "Machine Chest Press", "muscle": "chest", "type": "compound", "stim": 0.82, "fatigue": 0.40 },
  { "slug": "weighted-dip", "name": "Weighted Dip", "muscle": "chest", "type": "compound", "stim": 0.88, "fatigue": 0.60 },
  { "slug": "deficit-push-up", "name": "Deficit Push-Up", "muscle": "chest", "type": "compound", "stim": 0.70, "fatigue": 0.30 },
  { "slug": "pec-deck", "name": "Pec Deck", "muscle": "chest", "type": "isolation", "stim": 0.72, "fatigue": 0.22 },
  { "slug": "low-to-high-cable-fly", "name": "Low-to-High Cable Fly", "muscle": "chest", "type": "isolation", "stim": 0.70, "fatigue": 0.22 },
  { "slug": "overhead-press", "name": "Overhead Press", "muscle": "shoulder", "type": "compound", "stim": 0.86, "fatigue": 0.55 },
  { "slug": "lateral-raise", "name": "Lateral Raise", "muscle": "shoulder", "type": "isolation", "stim": 0.72, "fatigue": 0.20 },
  { "slug": "seated-db-shoulder-press", "name": "Seated DB Shoulder Press", "muscle": "shoulder", "type": "compound", "stim": 0.84, "fatigue": 0.50 },
  { "slug": "machine-shoulder-press", "name": "Machine Shoulder Press", "muscle": "shoulder", "type": "compound", "stim": 0.80, "fatigue": 0.40 },
  { "slug": "arnold-press", "name": "Arnold Press", "muscle": "shoulder", "type": "compound", "stim": 0.82, "fatigue": 0.50 },
  { "slug": "cable-lateral-raise", "name": "Cable Lateral Raise", "muscle": "shoulder", "type": "isolation", "stim": 0.74, "fatigue": 0.20 },
  { "slug": "machine-lateral-raise", "name": "Machine Lateral Raise", "muscle": "shoulder", "type": "isolation", "stim": 0.70, "fatigue": 0.18 },
  { "slug": "cable-upright-row", "name": "Cable Upright Row", "muscle": "shoulder", "type": "compound", "stim": 0.68, "fatigue": 0.30 },
  { "slug": "face-pull", "name": "Face Pull", "muscle": "rear-delt", "type": "isolation", "stim": 0.70, "fatigue": 0.18 },
  { "slug": "reverse-pec-deck", "name": "Reverse Pec Deck", "muscle": "rear-delt", "type": "isolation", "stim": 0.66, "fatigue": 0.18 },
  { "slug": "bent-over-reverse-fly", "name": "Bent-Over Reverse Fly", "muscle": "rear-delt", "type": "isolation", "stim": 0.64, "fatigue": 0.20 },
  { "slug": "cable-rear-delt-fly", "name": "Cable Rear-Delt Fly", "muscle": "rear-delt", "type": "isolation", "stim": 0.68, "fatigue": 0.18 },
  { "slug": "rear-delt-row", "name": "Rear-Delt Row", "muscle": "rear-delt", "type": "compound", "stim": 0.70, "fatigue": 0.30 },
  { "slug": "hammer-curl", "name": "Hammer Curl", "muscle": "biceps", "type": "isolation", "stim": 0.68, "fatigue": 0.20 },
  { "slug": "incline-db-curl", "name": "Incline DB Curl", "muscle": "biceps", "type": "isolation", "stim": 0.74, "fatigue": 0.22 },
  { "slug": "barbell-curl", "name": "Barbell Curl", "muscle": "biceps", "type": "isolation", "stim": 0.72, "fatigue": 0.25 },
  { "slug": "ez-bar-curl", "name": "EZ-Bar Curl", "muscle": "biceps", "type": "isolation", "stim": 0.72, "fatigue": 0.22 },
  { "slug": "preacher-curl", "name": "Preacher Curl", "muscle": "biceps", "type": "isolation", "stim": 0.76, "fatigue": 0.22 },
  { "slug": "cable-curl", "name": "Cable Curl", "muscle": "biceps", "type": "isolation", "stim": 0.70, "fatigue": 0.18 },
  { "slug": "concentration-curl", "name": "Concentration Curl", "muscle": "biceps", "type": "isolation", "stim": 0.66, "fatigue": 0.15 },
  { "slug": "tricep-pushdown", "name": "Tricep Pushdown", "muscle": "triceps", "type": "isolation", "stim": 0.70, "fatigue": 0.20 },
  { "slug": "overhead-tricep-ext", "name": "Overhead Tricep Ext", "muscle": "triceps", "type": "isolation", "stim": 0.74, "fatigue": 0.22 },
  { "slug": "skullcrusher", "name": "Skullcrusher", "muscle": "triceps", "type": "isolation", "stim": 0.76, "fatigue": 0.30 },
  { "slug": "close-grip-bench-press", "name": "Close-Grip Bench Press", "muscle": "triceps", "type": "compound", "stim": 0.80, "fatigue": 0.50 },
  { "slug": "cable-overhead-extension", "name": "Cable Overhead Extension", "muscle": "triceps", "type": "isolation", "stim": 0.72, "fatigue": 0.20 },
  { "slug": "single-arm-pushdown", "name": "Single-Arm Pushdown", "muscle": "triceps", "type": "isolation", "stim": 0.64, "fatigue": 0.15 },
  { "slug": "jm-press", "name": "JM Press", "muscle": "triceps", "type": "compound", "stim": 0.74, "fatigue": 0.40 },
  { "slug": "barbell-squat", "name": "Barbell Squat", "muscle": "quad", "type": "compound", "stim": 0.94, "fatigue": 0.85 },
  { "slug": "leg-press", "name": "Leg Press", "muscle": "quad", "type": "compound", "stim": 0.84, "fatigue": 0.60 },
  { "slug": "hack-squat", "name": "Hack Squat", "muscle": "quad", "type": "compound", "stim": 0.88, "fatigue": 0.65 },
  { "slug": "front-squat", "name": "Front Squat", "muscle": "quad", "type": "compound", "stim": 0.88, "fatigue": 0.75 },
  { "slug": "smith-machine-squat", "name": "Smith Machine Squat", "muscle": "quad", "type": "compound", "stim": 0.80, "fatigue": 0.55 },
  { "slug": "bulgarian-split-squat", "name": "Bulgarian Split Squat", "muscle": "quad", "type": "compound", "stim": 0.86, "fatigue": 0.60 },
  { "slug": "walking-lunge", "name": "Walking Lunge", "muscle": "quad", "type": "compound", "stim": 0.80, "fatigue": 0.55 },
  { "slug": "reverse-lunge", "name": "Reverse Lunge", "muscle": "quad", "type": "compound", "stim": 0.78, "fatigue": 0.50 },
  { "slug": "step-up", "name": "Step-Up", "muscle": "quad", "type": "compound", "stim": 0.72, "fatigue": 0.40 },
  { "slug": "leg-extension", "name": "Leg Extension", "muscle": "quad", "type": "isolation", "stim": 0.70, "fatigue": 0.25 },
  { "slug": "sissy-squat", "name": "Sissy Squat", "muscle": "quad", "type": "isolation", "stim": 0.74, "fatigue": 0.30 },
  { "slug": "romanian-deadlift", "name": "Romanian Deadlift", "muscle": "ham", "type": "compound", "stim": 0.90, "fatigue": 0.75 },
  { "slug": "leg-curl", "name": "Leg Curl", "muscle": "ham", "type": "isolation", "stim": 0.74, "fatigue": 0.25 },
  { "slug": "conventional-deadlift", "name": "Conventional Deadlift", "muscle": "ham", "type": "compound", "stim": 0.92, "fatigue": 0.90 },
  { "slug": "seated-leg-curl", "name": "Seated Leg Curl", "muscle": "ham", "type": "isolation", "stim": 0.76, "fatigue": 0.25 },
  { "slug": "stiff-leg-deadlift", "name": "Stiff-Leg Deadlift", "muscle": "ham", "type": "compound", "stim": 0.86, "fatigue": 0.70 },
  { "slug": "good-morning", "name": "Good Morning", "muscle": "ham", "type": "compound", "stim": 0.78, "fatigue": 0.60 },
  { "slug": "nordic-ham-curl", "name": "Nordic Ham Curl", "muscle": "ham", "type": "isolation", "stim": 0.80, "fatigue": 0.40 },
  { "slug": "single-leg-rdl", "name": "Single-Leg RDL", "muscle": "ham", "type": "compound", "stim": 0.74, "fatigue": 0.45 },
  { "slug": "hip-thrust", "name": "Hip Thrust", "muscle": "glute", "type": "compound", "stim": 0.86, "fatigue": 0.55 },
  { "slug": "glute-bridge", "name": "Glute Bridge", "muscle": "glute", "type": "compound", "stim": 0.72, "fatigue": 0.35 },
  { "slug": "cable-kickback", "name": "Cable Kickback", "muscle": "glute", "type": "isolation", "stim": 0.62, "fatigue": 0.15 },
  { "slug": "machine-hip-abduction", "name": "Machine Hip Abduction", "muscle": "glute", "type": "isolation", "stim": 0.60, "fatigue": 0.15 },
  { "slug": "sumo-deadlift", "name": "Sumo Deadlift", "muscle": "glute", "type": "compound", "stim": 0.88, "fatigue": 0.85 },
  { "slug": "back-extension-45", "name": "45° Back Extension", "muscle": "glute", "type": "isolation", "stim": 0.68, "fatigue": 0.30 },
  { "slug": "standing-calf-raise", "name": "Standing Calf Raise", "muscle": "calf", "type": "isolation", "stim": 0.72, "fatigue": 0.20 },
  { "slug": "seated-calf-raise", "name": "Seated Calf Raise", "muscle": "calf", "type": "isolation", "stim": 0.68, "fatigue": 0.18 },
  { "slug": "leg-press-calf-raise", "name": "Leg-Press Calf Raise", "muscle": "calf", "type": "isolation", "stim": 0.70, "fatigue": 0.18 },
  { "slug": "smith-calf-raise", "name": "Smith Calf Raise", "muscle": "calf", "type": "isolation", "stim": 0.68, "fatigue": 0.18 },
  { "slug": "single-leg-calf-raise", "name": "Single-Leg Calf Raise", "muscle": "calf", "type": "isolation", "stim": 0.66, "fatigue": 0.15 },
  { "slug": "cable-crunch", "name": "Cable Crunch", "muscle": "core", "type": "isolation", "stim": 0.72, "fatigue": 0.20 },
  { "slug": "hanging-leg-raise", "name": "Hanging Leg Raise", "muscle": "core", "type": "isolation", "stim": 0.76, "fatigue": 0.25 },
  { "slug": "ab-wheel-rollout", "name": "Ab-Wheel Rollout", "muscle": "core", "type": "compound", "stim": 0.78, "fatigue": 0.30 },
  { "slug": "machine-crunch", "name": "Machine Crunch", "muscle": "core", "type": "isolation", "stim": 0.68, "fatigue": 0.15 },
  { "slug": "plank", "name": "Plank", "muscle": "core", "type": "isolation", "stim": 0.50, "fatigue": 0.10 },
  { "slug": "side-plank", "name": "Side Plank", "muscle": "core", "type": "isolation", "stim": 0.48, "fatigue": 0.10 },
  { "slug": "pallof-press", "name": "Pallof Press", "muscle": "core", "type": "isolation", "stim": 0.55, "fatigue": 0.12 },
  { "slug": "dead-bug", "name": "Dead Bug", "muscle": "core", "type": "isolation", "stim": 0.45, "fatigue": 0.08 },
  { "slug": "barbell-shrug", "name": "Barbell Shrug", "muscle": "traps", "type": "isolation", "stim": 0.70, "fatigue": 0.30 },
  { "slug": "db-shrug", "name": "DB Shrug", "muscle": "traps", "type": "isolation", "stim": 0.66, "fatigue": 0.25 },
  { "slug": "cable-shrug", "name": "Cable Shrug", "muscle": "traps", "type": "isolation", "stim": 0.64, "fatigue": 0.20 },
  { "slug": "farmers-carry", "name": "Farmer's Carry", "muscle": "traps", "type": "compound", "stim": 0.60, "fatigue": 0.35 },
  { "slug": "box-jump", "name": "Box Jump", "muscle": "quad", "type": "plyo", "stim": 0.60, "fatigue": 0.35 },
  { "slug": "depth-jump", "name": "Depth Jump", "muscle": "quad", "type": "plyo", "stim": 0.70, "fatigue": 0.60 },
  { "slug": "depth-drop", "name": "Depth Drop", "muscle": "quad", "type": "plyo", "stim": 0.55, "fatigue": 0.45 },
  { "slug": "broad-jump", "name": "Broad Jump", "muscle": "glute", "type": "plyo", "stim": 0.62, "fatigue": 0.45 },
  { "slug": "seated-box-jump", "name": "Seated Box Jump", "muscle": "quad", "type": "plyo", "stim": 0.58, "fatigue": 0.35 },
  { "slug": "tuck-jump", "name": "Tuck Jump", "muscle": "quad", "type": "plyo", "stim": 0.55, "fatigue": 0.40 },
  { "slug": "pogo-hops", "name": "Pogo Hops", "muscle": "calf", "type": "plyo", "stim": 0.50, "fatigue": 0.25 },
  { "slug": "single-leg-bound", "name": "Single-Leg Bound", "muscle": "glute", "type": "plyo", "stim": 0.62, "fatigue": 0.50 },
  { "slug": "lateral-bound", "name": "Lateral Bound", "muscle": "glute", "type": "plyo", "stim": 0.58, "fatigue": 0.45 },
  { "slug": "jump-squat", "name": "Jump Squat", "muscle": "quad", "type": "plyo", "stim": 0.64, "fatigue": 0.50 },
  { "slug": "trap-bar-jump", "name": "Trap-Bar Jump", "muscle": "quad", "type": "plyo", "stim": 0.66, "fatigue": 0.55 },
  { "slug": "approach-jump", "name": "Approach Jump", "muscle": "quad", "type": "plyo", "stim": 0.60, "fatigue": 0.40 }
]
```

- [ ] **Step 2.2: Write the failing IT** — `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogLoaderIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader.CatalogJsonItem;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Master-data loader IT: the curated catalog loads at startup, re-running is idempotent,
 * content edits upsert by slug, and invalid content fails fast (never reaches the DB).
 */
@Transactional
class ExerciseCatalogLoaderIT extends AbstractIntegrationTest {

    @Autowired private ExerciseCatalogLoader loader;
    @Autowired private ExerciseCatalogRepository repository;

    @Test
    void testRun_shouldLoadCuratedCatalog_whenContextStarts() {
        // The loader is profile-independent and already ran at context startup.
        assertThat(repository.count()).isEqualTo(110);
        ExerciseCatalogEntity row = repository.findBySlug("chest-supported-row").orElseThrow();
        assertThat(row.getName()).isEqualTo("Chest Supported Row");
        assertThat(row.getMuscle()).isEqualTo("back-mid");
        assertThat(row.getType()).isEqualTo("compound");
        assertThat(row.getStim()).isEqualByComparingTo("0.92");
        assertThat(row.getFatigue()).isEqualByComparingTo("0.55");
    }

    @Test
    void testRun_shouldContainPlyoBlock_whenLoaded() {
        List<ExerciseCatalogEntity> plyo = repository.findAll().stream()
            .filter(e -> "plyo".equals(e.getType())).toList();
        assertThat(plyo).hasSize(12);
        assertThat(plyo).extracting(ExerciseCatalogEntity::getSlug).contains("box-jump", "depth-jump", "approach-jump");
    }

    @Test
    void testRun_shouldBeIdempotent_whenRunTwice() {
        loader.run();
        loader.run();
        assertThat(repository.count()).isEqualTo(110);
    }

    @Test
    void testRun_shouldUpsertChangedValues_whenDbRowDrifted() {
        ExerciseCatalogEntity drifted = repository.findBySlug("box-jump").orElseThrow();
        drifted.setStim(new BigDecimal("0.10"));
        repository.saveAndFlush(drifted);

        loader.run();

        assertThat(repository.findBySlug("box-jump").orElseThrow().getStim())
            .isEqualByComparingTo("0.60");
    }

    @Test
    void testLoad_shouldFailFast_whenContentInvalid() {
        CatalogJsonItem bad = new CatalogJsonItem(
            "bad-item", "Bad Item", "not-a-muscle", "compound",
            new BigDecimal("0.50"), new BigDecimal("0.50"));
        assertThatThrownBy(() -> loader.load(List.of(bad)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bad-item");
    }
}
```

- [ ] **Step 2.3: Run to verify it fails**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseCatalogLoaderIT`
Expected: COMPILE FAILURE (`ExerciseCatalogLoader`, `ExerciseCatalogEntity`, `ExerciseCatalogRepository` do not exist) — that is the red phase for new classes.

- [ ] **Step 2.4: Implement entity** — `ExerciseCatalogEntity.java`:

```java
package io.mrkuhne.mezo.feature.train.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Curated exercise catalog row — MASTER DATA, not user data: no {@code createdBy}, no soft
 * delete. Content lives in {@code content/exercise-catalog.json} and is upserted by
 * {@code slug} at startup ({@link io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader});
 * {@code type} is {@code compound|isolation|plyo}, {@code muscle} a token of the picker
 * taxonomy (both DB CHECKed).
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_catalog")
public class ExerciseCatalogEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, unique = true)
    private String slug;

    @NotNull
    @Column(nullable = false)
    private String name;

    @NotNull
    @Column(nullable = false)
    private String muscle;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal stim;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal fatigue;
}
```

- [ ] **Step 2.5: Implement repository** — `ExerciseCatalogRepository.java`:

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for the {@link ExerciseCatalogEntity} master-data table. No ownership scoping —
 * the catalog is content shared by every environment (the GET endpoint still sits behind auth).
 */
public interface ExerciseCatalogRepository extends JpaRepository<ExerciseCatalogEntity, UUID> {

    Optional<ExerciseCatalogEntity> findBySlug(String slug);

    List<ExerciseCatalogEntity> findAllByOrderByMuscleAscNameAsc();
}
```

- [ ] **Step 2.6: Implement loader** — `ExerciseCatalogLoader.java` (feature root, next to `TrainSeedData`):

```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Startup content loader for the curated exercise catalog. Runs in EVERY profile (the catalog
 * is content needed in prod too — unlike the {@code demodata}/{@code demofixtures} seeders) and
 * upserts by {@code slug}: missing rows are inserted, drifted fields updated, nothing is ever
 * deleted. Content tuning = edit {@code content/exercise-catalog.json}; Liquibase owns schema
 * only. Invalid content (unknown muscle/type token, missing field) fails startup fast instead
 * of surfacing as a runtime 500 later.
 */
@Component
@Order(50) // before TrainSeedData(100); independent of the demodata owner
@RequiredArgsConstructor
public class ExerciseCatalogLoader implements CommandLineRunner {

    private static final Set<String> MUSCLES = Set.of(
        "back-mid", "lats", "chest", "shoulder", "rear-delt", "biceps", "triceps",
        "quad", "ham", "glute", "calf", "core", "traps");
    private static final Set<String> TYPES = Set.of("compound", "isolation", "plyo");

    private final ExerciseCatalogRepository repository;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /** One catalog row as authored in content/exercise-catalog.json. */
    public record CatalogJsonItem(
        String slug, String name, String muscle, String type, BigDecimal stim, BigDecimal fatigue) {}

    // Same self-invocation note as TrainSeedData: startup enters via run(String...), the IT
    // calls run() through the proxy — both overloads carry @Transactional.
    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-run against a drifted DB. */
    @Transactional
    public void run() {
        load(readContent());
    }

    private List<CatalogJsonItem> readContent() {
        try (InputStream in = new ClassPathResource("content/exercise-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, CatalogJsonItem.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/exercise-catalog.json is unreadable", e);
        }
    }

    /** Validates every item, then upserts by slug. Package-private for the fail-fast IT. */
    @Transactional
    void load(List<CatalogJsonItem> items) {
        items.forEach(this::validate);
        Map<String, ExerciseCatalogEntity> bySlug = new HashMap<>();
        repository.findAll().forEach(e -> bySlug.put(e.getSlug(), e));
        for (CatalogJsonItem item : items) {
            ExerciseCatalogEntity e = bySlug.getOrDefault(item.slug(), new ExerciseCatalogEntity());
            e.setSlug(item.slug());
            e.setName(item.name());
            e.setMuscle(item.muscle());
            e.setType(item.type());
            e.setStim(item.stim());
            e.setFatigue(item.fatigue());
            repository.save(e);
        }
    }

    private void validate(CatalogJsonItem item) {
        boolean valid = item.slug() != null && !item.slug().isBlank()
            && item.name() != null && !item.name().isBlank()
            && MUSCLES.contains(item.muscle()) && TYPES.contains(item.type())
            && item.stim() != null && item.fatigue() != null;
        if (!valid) {
            throw new IllegalStateException("Invalid exercise-catalog item: " + item.slug());
        }
    }
}
```

- [ ] **Step 2.7: Run to verify it passes**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseCatalogLoaderIT`
Expected: 5/5 PASS.

- [ ] **Step 2.8: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add backend/src && git commit -m "feat(train): curated exercise catalog content + idempotent startup loader (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Contract + GET endpoint + catalogId persist (TDD)

The generated `TrainApi` methods are **abstract** — the contract edit and the controller implementation must land in one compiling commit (T3 lesson). Red phase = controller stub returning a wrong value, then implement.

**Files:**
- Modify: `api/feature/train/train.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseCatalogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseCatalogContractIT.java`

- [ ] **Step 3.1: Contract edits in `api/feature/train/train.yml`**

(a) New path — insert between the `/api/train/mesocycles/{id}/days/{dayId}/exercises` block and `/api/train/sport-sessions:`:

```yaml
  /api/train/exercises:
    get:
      tags: [Train]
      operationId: getExerciseCatalog
      summary: Curated exercise catalog (master data), muscle then name ascending
      responses:
        '200':
          description: Catalog items
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ExerciseCatalogItem'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

(b) New schema — append after `GymExerciseInput` (before `WorkoutTodayResponse`):

```yaml
    ExerciseCatalogItem:
      type: object
      required:
        - id
        - slug
        - name
        - muscle
        - type
        - stim
        - fatigue
      properties:
        id:
          type: string
          format: uuid
        slug:
          type: string
        name:
          type: string
        muscle:
          type: string
        type:
          type: string
          enum: [compound, isolation, plyo]
        stim:
          type: number
          minimum: 0
          maximum: 1
        fatigue:
          type: number
          minimum: 0
          maximum: 1
```

(c) `GymExercise` schema: extend the enum to `enum: [compound, isolation, plyo]` and add after `warning`:

```yaml
        catalogId:
          type: string
          format: uuid
          description: Optional reference to the exercise_catalog row this exercise was picked from
```

(d) `GymExerciseInput` schema: extend the enum to `enum: [compound, isolation, plyo]` and add after `warning`:

```yaml
        catalogId:
          type: string
          format: uuid
```

(e) `TodayExercise` schema: extend the enum to `enum: [compound, isolation, plyo]`.

- [ ] **Step 3.2: Regenerate both sides**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `frontend/src/lib/api.gen.ts` updated; backend Java types regenerate inside the next Maven run.

- [ ] **Step 3.3: Entity linkage** — `ExerciseEntity.java`: update the type comment and add the column after `warning`:

```java
    @NotNull
    @Column(nullable = false)
    private String type; // compound|isolation|plyo (DB CHECK)

    @Column
    private String warning;

    /** Optional reference to the exercise_catalog row this exercise was picked from. */
    @Column(name = "catalog_id")
    private UUID catalogId;
```

- [ ] **Step 3.4: Controller STUB so the codebase compiles red** — `TrainController.java`: add import `io.mrkuhne.mezo.api.dto.ExerciseCatalogItem` and:

```java
    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return List.of(); // stub — replaced by ExerciseCatalogService in step 3.8
    }
```

- [ ] **Step 3.5: Write the failing contract IT** — `ExerciseCatalogContractIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract tests for GET /api/train/exercises and the catalogId linkage on
 * the day-exercises PUT (round-trip + unknown-id 400 via SystemMessage field error).
 */
class ExerciseCatalogContractIT extends ApiIntegrationTest {

    @Test
    void testGetExerciseCatalog_shouldReturn401_whenNoToken() {
        getForBody("/api/train/exercises", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetExerciseCatalog_shouldReturnCuratedItemsSorted_whenAuthenticated() {
        List<ExerciseCatalogItem> items =
            getForList("/api/train/exercises", ownerAuthHeaders(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(items).hasSize(110);
        assertThat(items).isSortedAccordingTo(
            Comparator.comparing(ExerciseCatalogItem::getMuscle).thenComparing(ExerciseCatalogItem::getName));
        assertThat(items).anySatisfy(i -> {
            assertThat(i.getSlug()).isEqualTo("box-jump");
            assertThat(i.getType()).isEqualTo(ExerciseCatalogItem.TypeEnum.PLYO);
            assertThat(i.getId()).isNotNull();
        });
    }

    @Test
    void testReplaceDayExercises_shouldPersistCatalogId_whenProvided() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = catalogIdOf(auth, "hip-thrust");
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Hip Thrust").muscle("glute").sets(3).targetReps("8-12").targetRIR(1)
            .type(GymExerciseInput.TypeEnum.COMPOUND).catalogId(catalogId)
            .build();
        MesoDay day = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.OK, MesoDay.class);

        assertThat(day.getExercises()).hasSize(1);
        assertThat(day.getExercises().get(0).getCatalogId()).isEqualTo(catalogId);
    }

    @Test
    void testReplaceDayExercises_shouldReturn400_whenCatalogIdUnknown() {
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Ghost Exercise").muscle("glute").sets(3).targetReps("8-12").targetRIR(1)
            .type(GymExerciseInput.TypeEnum.COMPOUND).catalogId(UUID.randomUUID())
            .build();
        String body = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "catalogId", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReplaceDayExercises_shouldPersistPlyoType_whenPicked() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = catalogIdOf(auth, "box-jump");
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Box Jump").muscle("quad").sets(3).targetReps("5").targetRIR(2)
            .type(GymExerciseInput.TypeEnum.PLYO).catalogId(catalogId)
            .build();
        MesoDay day = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.OK, MesoDay.class);

        assertThat(day.getExercises().get(0).getType().getValue()).isEqualTo("plyo");
    }

    private UUID catalogIdOf(HttpHeaders auth, String slug) {
        return getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(i -> slug.equals(i.getSlug())).findFirst().orElseThrow().getId();
    }

    private MesocycleResponse createMesoWithOneDay(HttpHeaders auth) {
        MesocycleCreateRequest req = MesocycleCreateRequest.builder()
            .title("Catalog IT meso").status(MesocycleCreateRequest.StatusEnum.PLANNED)
            .startDate(LocalDate.of(2026, 6, 15)).weeks(4)
            .split("Upper / Lower · 4×/hét").style("Linear · 4 hét")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV,
                MesocycleCreateRequest.PhaseCurveEnum.MAV))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Upper").muscle("back").build()))
            .build();
        return postForBody("/api/train/mesocycles", req, auth, HttpStatus.CREATED, MesocycleResponse.class);
    }
}
```

- [ ] **Step 3.6: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseCatalogContractIT`
Expected: compiles (codegen + stub); `testGetExerciseCatalog_shouldReturnCuratedItemsSorted…` FAILS (stub returns 0 items), `…shouldPersistCatalogId…` FAILS (`catalogId` null in response), `…shouldReturn400_whenCatalogIdUnknown` FAILS (200 instead of 400). The 401 test may already pass.

- [ ] **Step 3.7: Implement mapper + service + controller**

`TrainMapper.java` — add import `io.mrkuhne.mezo.api.dto.ExerciseCatalogItem` and entity import, plus:

```java
    @Mapping(target = "type", expression = "java(ExerciseCatalogItem.TypeEnum.fromValue(entity.getType()))")
    ExerciseCatalogItem toCatalogItem(io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity entity);
```

(`toGymExercise` picks up `catalogId` automatically by name — no annotation change needed.)

New `ExerciseCatalogService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Read side of the exercise catalog: master data, identical for every authenticated user
 * (no ownership scoping). Sorted muscle-then-name so the picker renders grouped.
 */
@Service
@RequiredArgsConstructor
public class ExerciseCatalogService {

    private final ExerciseCatalogRepository repository;
    private final TrainMapper mapper;

    public List<ExerciseCatalogItem> list() {
        return repository.findAllByOrderByMuscleAscNameAsc().stream().map(mapper::toCatalogItem).toList();
    }
}
```

`TrainService.java` — add field `private final ExerciseCatalogRepository exerciseCatalogRepository;` (+ import) and extend `toExerciseEntity` (validation BEFORE the entity is built; unknown id must be a 400 field error, never a raw FK 500):

```java
    private ExerciseEntity toExerciseEntity(UUID createdBy, UUID workoutSessionId, GymExerciseInput in, int orderIndex) {
        if (in.getCatalogId() != null && !exerciseCatalogRepository.existsById(in.getCatalogId())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "catalogId").build(), HttpStatus.BAD_REQUEST);
        }
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(in.getName());
        e.setMuscle(in.getMuscle() != null ? in.getMuscle() : "");
        e.setSets(in.getSets());
        e.setTargetReps(in.getTargetReps());
        e.setTargetRir(in.getTargetRIR());
        e.setType(in.getType().getValue());
        e.setWarning(in.getWarning());
        e.setCatalogId(in.getCatalogId());
        e.setOrderIndex(orderIndex);
        return e;
    }
```

`TrainController.java` — replace the stub: add field `private final ExerciseCatalogService exerciseCatalogService;` and:

```java
    @Override
    public List<ExerciseCatalogItem> getExerciseCatalog() {
        return exerciseCatalogService.list();
    }
```

- [ ] **Step 3.8: Run to verify green, then the full backend suite in BOTH DB modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseCatalogContractIT
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Expected: 5/5 PASS, then ALL backend tests PASS in both modes.

- [ ] **Step 3.9: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add api backend/src frontend/src/lib/api.gen.ts && git commit -m "feat(train): GET /api/train/exercises + catalogId linkage on day exercises (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: FE data layer — types, API client, hook (TDD)

**Files:**
- Modify: `frontend/src/data/types.ts` (`ExerciseKind`, `GymExercise`, `ExerciseLibraryItem`)
- Modify: `frontend/src/lib/trainApi.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `frontend/src/data/trainHooks.ts`
- Test: `frontend/src/data/trainHooks.test.tsx`

- [ ] **Step 4.1: MSW default handler** — in `handlers.ts`, after the sport-schedule GET fixture add (Hip Thrust is REQUIRED — the existing real-mode `MesoExercises` test picks it):

```ts
  // Exercise catalog fixture — small slice across muscles incl. one plyo item.
  // Hip Thrust must stay: the real-mode MesoExercises test picks it from the sheet.
  http.get(`${API_BASE}/api/train/exercises`, () =>
    HttpResponse.json([
      { id: 'f1e3a0e2-0000-4000-8000-000000000070', slug: 'chest-supported-row', name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound', stim: 0.92, fatigue: 0.55 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000071', slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'glute', type: 'compound', stim: 0.86, fatigue: 0.55 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000072', slug: 'box-jump', name: 'Box Jump', muscle: 'quad', type: 'plyo', stim: 0.6, fatigue: 0.35 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000073', slug: 'lateral-raise', name: 'Lateral Raise', muscle: 'shoulder', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000074', slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscle: 'calf', type: 'isolation', stim: 0.72, fatigue: 0.2 },
      { id: 'f1e3a0e2-0000-4000-8000-000000000075', slug: 'cable-crunch', name: 'Cable Crunch', muscle: 'core', type: 'isolation', stim: 0.72, fatigue: 0.2 },
    ]),
  ),
```

- [ ] **Step 4.2: Replace the stale hook test and add the mock-mode pin** — in `trainHooks.test.tsx`, REPLACE the test `useTrain (real mode) keeps static exerciseLibrary catalog` (line ~35) with:

```ts
test('useTrain (real mode) maps the API exercise catalog into exerciseLibrary', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.exerciseLibrary.length).toBe(6))
  const boxJump = result.current.exerciseLibrary.find((e) => e.name === 'Box Jump')
  expect(boxJump).toMatchObject({
    id: 'f1e3a0e2-0000-4000-8000-000000000072',
    catalogId: 'f1e3a0e2-0000-4000-8000-000000000072',
    muscle: 'quad',
    type: 'plyo',
    stim: 0.6,
  })
})

test('useTrain (mock mode) keeps the static Phase-1 exerciseLibrary', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true') // override the file-level real-mode stub
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseLibrary.length).toBe(21)
  expect(result.current.exerciseLibrary[0].id).toBe('exl-1')
})
```

- [ ] **Step 4.3: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/data/trainHooks.test.tsx`
Expected: the new real-mode test FAILS (library is still the 21 static items, no `catalogId`); the mock test passes.

- [ ] **Step 4.4: Implement the data layer**

`types.ts`:

```ts
export type ExerciseKind = 'compound' | 'isolation' | 'plyo'
```

`GymExercise` gains an optional field after `warning?`:

```ts
  catalogId?: string  // exercise_catalog row when picked from the API catalog (real mode)
```

`ExerciseLibraryItem` gains the same optional field:

```ts
export interface ExerciseLibraryItem {
  id: string; name: string; muscle: string; type: ExerciseKind; stim: number; fatigue: number
  catalogId?: string  // set when the item comes from the backend catalog (real mode)
}
```

`trainApi.ts` — add the type export and client method:

```ts
export type ExerciseCatalogItem = components['schemas']['ExerciseCatalogItem']
```

```ts
  exerciseCatalog: (): Promise<ExerciseCatalogItem[]> =>
    apiFetch<ExerciseCatalogItem[]>('/api/train/exercises'),
```

`trainHooks.ts` — import `type ExerciseCatalogItem` from `@/lib/trainApi`, add the mapper next to `toSportSchedule`:

```ts
// Catalog row -> the Phase-1 library shape; `id` doubles as the catalog uuid and
// `catalogId` flags "came from the backend catalog" (mock statics never set it).
function toLibraryItem(r: ExerciseCatalogItem): ExerciseLibraryItem {
  return { id: r.id, catalogId: r.id, name: r.name, muscle: r.muscle, type: r.type, stim: r.stim, fatigue: r.fatigue }
}
```

Add the query after the `workoutToday` query:

```ts
  // Exercise catalog — master data; one fetch per app session is plenty.
  const { data: catalogData } = useQuery({
    queryKey: ['train', 'exerciseCatalog'],
    queryFn: mock ? async () => exerciseLibrary : () => trainApi.exerciseCatalog().then((rs) => rs.map(toLibraryItem)),
    initialData: mock ? exerciseLibrary : undefined,
    staleTime: 60 * 60 * 1000,
  })
```

Change the return field (and update the line-162 comment block: `exerciseLibrary` now loads from `GET /api/train/exercises` in real mode, statics in mock):

```ts
    exerciseLibrary: catalogData ?? [],
```

- [ ] **Step 4.5: Run to verify green (both modes)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/data/trainHooks.test.tsx
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test -- src/data/trainHooks.test.tsx
```

Expected: PASS in both.

- [ ] **Step 4.6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add frontend/src && git commit -m "feat(train): exerciseLibrary served by the API catalog in real mode (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Picker chips + catalogId flow in the builder (TDD)

**Files:**
- Modify: `frontend/src/data/train.ts` (`MUSCLE_LABELS` += core, traps)
- Modify: `frontend/src/features/train/components/ExercisePickerSheet.tsx`
- Modify: `frontend/src/features/train/components/MesoExercises.tsx`
- Test: `frontend/src/features/train/components/ExercisePickerSheet.test.tsx`
- Test: `frontend/src/features/train/components/MesoExercises.test.tsx`

- [ ] **Step 5.1: Write the failing tests**

`ExercisePickerSheet.test.tsx` — append:

```ts
test('plyo chip filters by type in real mode (API catalog)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // override the file-level mock pin
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(await screen.findByText('Box Jump')).toBeInTheDocument()
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(screen.getByText('Box Jump')).toBeInTheDocument()
  expect(screen.queryByText('Hip Thrust')).not.toBeInTheDocument()
})

test('calf and core chips filter the API catalog by muscle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  await screen.findByText('Box Jump')
  await userEvent.click(screen.getByRole('button', { name: 'Vádli' }))
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
  expect(screen.queryByText('Box Jump')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Core' }))
  expect(screen.getByText('Cable Crunch')).toBeInTheDocument()
})
```

`MesoExercises.test.tsx` — in the existing real-mode test (`adding an exercise persists the day list in real mode`), change the `puts` element type to `{ url: string; body: { name: string; catalogId?: string }[] }[]` and append after the existing assertions:

```ts
  // The picked item carries the catalog uuid; the pre-existing row stays unlinked.
  expect(puts[0].body[1].catalogId).toBe('f1e3a0e2-0000-4000-8000-000000000071')
  expect(puts[0].body[0].catalogId).toBeUndefined()
```

- [ ] **Step 5.2: Run to verify red**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/components/ExercisePickerSheet.test.tsx src/features/train/components/MesoExercises.test.tsx
```

Expected: new picker tests FAIL (no Plyo/Vádli/Core chip — chips not in `MUSCLE_FILTERS`); the catalogId assertion FAILS (`undefined`).

- [ ] **Step 5.3: Implement**

`train.ts` `MUSCLE_LABELS` — extend (calf already exists):

```ts
export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Mell', back: 'Hát', 'back-mid': 'Hát (közép)', lats: 'Lat', shoulder: 'Váll',
  'rear-delt': 'Hátsó váll', biceps: 'Bicep', triceps: 'Tricep',
  quad: 'Comb', ham: 'Lábhajlító', glute: 'Far', calf: 'Vádli',
  core: 'Core', traps: 'Trapéz',
}
```

`ExercisePickerSheet.tsx` — replace the filter constant + predicate + chip label:

```ts
// Muscle filter tokens — the prototype's curated order, 'all' first; 'plyo' is a TYPE
// filter chip (vertical-jump block), the rest filter by muscle. calf/core/traps joined
// with the backend catalog (mezo-7ot).
const MUSCLE_FILTERS = ['all', 'plyo', 'back-mid', 'lats', 'chest', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf', 'rear-delt', 'core', 'traps']
const FILTER_LABELS: Record<string, string> = { all: 'Összes', plyo: 'Plyo' }
```

```ts
  const filtered = exerciseLibrary.filter(
    (e) =>
      (filter === 'all' || (filter === 'plyo' ? e.type === 'plyo' : e.muscle === filter)) &&
      (search === '' || e.name.toLowerCase().includes(search.toLowerCase())),
  )
```

Chip render label (replace the `'Összes'` ternary):

```tsx
                {FILTER_LABELS[m] ?? MUSCLE_LABELS[m] ?? m}
```

`MesoExercises.tsx` — `libraryToGymExercise` carries the linkage, `persistDay` forwards it (JSON.stringify drops `undefined`, so unlinked rows stay clean):

```ts
function libraryToGymExercise(item: ExerciseLibraryItem): MesoDay['exercises'][number] {
  return {
    id: `${item.id}-${Date.now()}`,
    name: item.name,
    muscle: item.muscle,
    sets: 3,
    targetReps: '8-12',
    targetRIR: 1,
    type: item.type,
    ...(item.catalogId ? { catalogId: item.catalogId } : {}),
  }
}
```

```ts
    saveDayExercises(meso.id, day.id, day.exercises.map((e) => ({
      name: e.name, muscle: e.muscle, sets: e.sets, targetReps: e.targetReps,
      targetRIR: e.targetRIR, type: e.type, warning: e.warning, catalogId: e.catalogId,
    })))
```

- [ ] **Step 5.4: Run to verify green (both modes)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/components/ExercisePickerSheet.test.tsx src/features/train/components/MesoExercises.test.tsx
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test -- src/features/train/components/ExercisePickerSheet.test.tsx src/features/train/components/MesoExercises.test.tsx
```

Expected: PASS in both (mock-mode picker shows no Plyo ITEMS — the static 21 has none — but the chips render in both modes; the new chip tests pin real mode explicitly).

- [ ] **Step 5.5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add frontend/src && git commit -m "feat(train): picker plyo/calf/core/traps chips + catalogId flows through day saves (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full gates

- [ ] **Step 6.1: Backend, both DB modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Expected: ALL PASS (was 100; now 100 + 9 new ITs = 109).

- [ ] **Step 6.2: Frontend, both modes + build**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build
```

Expected: ALL PASS (was 320; now 320 + 5 new/changed = ~325), build clean.

- [ ] **Step 6.3: Parity**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm parity
```

Expected: 45/45 (the exercise picker is NOT in the parity shot set — verified; only the Fuel stack picker is captured).

- [ ] **Step 6.4: Commit anything pending (beads ledger churn etc.)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git status --short
```

If only `.beads/issues.jsonl` reordering: `git add .beads && git commit -m "chore(beads): sync issue ledger"` (repeat until clean).

---

### Task 7: Live smoke + finish

- [ ] **Step 7.1: Start the stack** (background tasks)

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose up -d
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # :8090, clean slate + owner
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm dev   # :5180 real mode
```

- [ ] **Step 7.2: Browser smoke** (chrome-devtools MCP; click via `evaluate_script` textContent `.click()`, screenshots into repo `.smoke/`):
  1. Login → Train → create a mesocycle via the wizard (or reuse one) → Gyakorlatok tab → `+ Gyakorlat hozzáadása`.
  2. Picker shows the catalog (~110 items scrollable), `Plyo` chip → only the 12 plyo items; search `jump` narrows.
  3. Pick `Box Jump` → day list shows it →
     `docker exec backend-postgres-1 psql -U mezo -d mezo -c "SELECT name, type, catalog_id IS NOT NULL AS linked FROM exercise WHERE is_deleted = false ORDER BY created_at DESC LIMIT 3"` → Box Jump row `type=plyo`, `linked=t`.
  4. `SELECT count(*) FROM exercise_catalog` → 110.
  5. Hard reload → picker still serves the catalog (staleTime refetch OK).
- [ ] **Step 7.3: Cleanup** — truncate any smoke-created Train rows in the dev DB (keep `exercise_catalog`!), stop dev servers (TaskStop), `rm -rf .smoke`.

```bash
docker exec backend-postgres-1 psql -U mezo -d mezo -c "TRUNCATE TABLE exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle CASCADE"
```

- [ ] **Step 7.4: Spec as-built note** — append to `docs/superpowers/specs/2026-06-12-exercise-catalog-design.md` a short "As built" section: 110 items (not ~120 — thin groups), `plyo` chip placed right after `Összes`, wizard-generated (planner) exercises intentionally stay `catalogId=NULL`.

- [ ] **Step 7.5: Merge + push + close** (per CLAUDE.md git workflow)

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git checkout main && git pull --rebase
git merge --no-ff feat/exercise-catalog -m "feat(train): backend exercise catalog — 110 curated items incl. plyo block, picker chips, catalogId linkage (mezo-7ot)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git branch -d feat/exercise-catalog
bd close mezo-7ot --reason="Exercise catalog shipped: exercise_catalog table + JSON loader (110 items, 12 plyo), GET /api/train/exercises, catalogId linkage, picker plyo/calf/core/traps chips; all gates green"
git pull --rebase && bd dolt push && git push
git status   # MUST be "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** §1 schema → Task 1; §2 loader → Task 2; §3 contract → Task 3 (path, `ExerciseCatalogItem`, `catalogId` on input+response, three enums + plyo); §4 FE → Tasks 4–5 (query+staleTime, shape-preserving mapping, plyo chip, MUSCLE_LABELS, msw, catalogId in `onPick` flow); §5 content → Task 2 JSON (110 items, 21 verbatim, 12 plyo, Standing Calf Raise); §6 testing → Tasks 2/3/4/5/6 (loader idempotence+upsert+fail-fast, 401/200/sort/plyo, catalogId round-trip + unknown-id 400 field error, ResetDatabase exclusion, FE both modes, parity).
- **Deviation from spec, documented:** 110 items instead of ~120 (header note + as-built note in 7.4); `ON DELETE SET NULL` matches spec.
- **Type consistency:** `CatalogJsonItem` record fields = JSON keys = entity setters; `findBySlug`/`findAllByOrderByMuscleAscNameAsc` used exactly as declared; FE `toLibraryItem` returns the `ExerciseLibraryItem` shape with optional `catalogId`; `GymExerciseInput.builder().catalogId(...)` exists because step 3.1(d) adds the field before codegen in 3.2.
