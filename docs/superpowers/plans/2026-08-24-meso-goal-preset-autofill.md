# Meso Goal Preset + Picker Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the wizard's goal choice as a machine key (`goalPreset`) on mesocycles and templates, and use it to auto-fill sets/reps/RIR from the generator's `SCHEMES` when an exercise is picked.

**Architecture:** One nullable text column on two tables + one optional contract field, carried through the template→run stamp and the legacy rerun materialization. On the frontend the preset flows from the hooks into a single new choke point in `exerciseDefaults.ts` that all pickers call; the wizard writes the preset it already knows, and the template editor gets a "Cél" dropdown.

**Tech Stack:** Spring Boot 3 / Java 21, Postgres + Liquibase, OpenAPI-generated DTOs; React + TypeScript + Vitest.

## Global Constraints

- Driving bd issue: **`mezo-dq60`**. Every commit subject carries it.
- Spec: [`2026-08-24-meso-goal-preset-and-muscle-priorities-design.md`](../specs/2026-08-24-meso-goal-preset-and-muscle-priorities-design.md), Slice 1 only. Slice 2 (`mezo-3m5m`, priority tiers) is OUT of scope.
- Branch `feat/meso-builder-auto-sets` already exists (cut from main after the mezo-gbo7 merge). Work on it.
- Liquibase: script name and changeSet id suffix MUST be `202608242315_mezo-dq60_goal_preset` (12-digit UTC minute, fixed — do not regenerate). Append at the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`; never edit an existing changeSet. `scripts/lint-liquibase.mjs` enforces the shape.
- The field is `goalPreset` (Java/TS/contract), column `goal_preset`. **No DB CHECK constraint** — the preset list is FE-owned (spec GD1).
- Valid preset ids: `hypertrophy`, `strength`, `cut-prep`, `recovery`, `sport`, `erohipertrofia`. NULL/absent → frontend falls back to `hypertrophy` at the point of USE (never backfill unknowns).
- Backend tests run with `-Dmezo.test.use-testcontainers=true`. This repo is on Jackson 3 (`tools.jackson.*`). `ownerId()` is a per-class helper in `feature/train` ITs (copy from a sibling), NOT inherited.
- Frontend tests must pass in BOTH modes (`pnpm test` and `VITE_USE_MOCK=false pnpm test`) plus `pnpm build`. Known flake: `ActiveWorkoutPage.test.tsx` times out under concurrent load, passes standalone (mezo-sw4w) — verify in isolation before blaming a change.
- Contract changes: edit `api/feature/train/train.yml`, then regenerate the merged bundle (`cd api/generate && pnpm generate:api`) BEFORE `cd frontend && pnpm generate:api`. Never hand-edit `api.gen.ts` or `api/openapi.yml`.
- **Field-enumeration trap:** `mesoTemplateHooks.ts` (`toUpsert`, `toMesoTemplate`, `mockCreate`, `mockUpdate`) and `MesocyclePlannerPage.saveTemplate` build payloads by listing fields explicitly. Every one must carry `goalPreset` or a save path silently drops it. mezo-gbo7's final review found a third unlisted site — grep, don't trust the list.
- Do not touch the live database; the migration handles live data.
- Do NOT push, open a PR, or close the bd issue — the controller handles those after the final review.

---

### Task 1: Persist `goal_preset` and backfill from the goal text

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608242315_mezo-dq60_goal_preset.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesocycleEntity.java` (next to `goal`, ~line 55)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesoTemplateEntity.java` (next to `goal`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/GoalPresetBackfillSqlIT.java`

**Interfaces:**
- Produces: `MesocycleEntity.getGoalPreset()/setGoalPreset(String)`, `MesoTemplateEntity.getGoalPreset()/setGoalPreset(String)`; columns `mesocycle.goal_preset`, `meso_template.goal_preset` (nullable text).

- [ ] **Step 1: Write the failing test**

Model the class on `MesoTemplateVolumeBackfillSqlIT` (same package): it reads the shipped migration script, extracts and executes its `update` statements via `jdbcTemplate`, and asserts on rows it inserted first.

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** mezo-dq60: the goal_preset backfill maps the known GOAL_PRESETS descriptions, leaves the rest NULL. */
class GoalPresetBackfillSqlIT extends AbstractIntegrationTest {

    @Autowired JdbcTemplate jdbcTemplate;
    // copy the ownerId() helper + its two @Autowired fields from MesoTemplateVolumeBackfillSqlIT

    @Test
    void testBackfill_shouldMapKnownDescription_andLeaveUnknownNull() throws Exception {
        UUID owner = ownerId();
        UUID known = insertTemplate(owner, "Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk");
        UUID edited = insertTemplate(owner, "saját szöveg, átírva");
        UUID noGoal = insertTemplate(owner, null);

        for (String stmt : backfillStatements()) jdbcTemplate.update(stmt);

        assertThat(preset(known)).isEqualTo("hypertrophy");
        assertThat(preset(edited)).isNull();
        assertThat(preset(noGoal)).isNull();
    }

    private UUID insertTemplate(UUID owner, String goal) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into meso_template (id, created_by, title, goal, weeks, phase_curve, days)
            values (?, ?, 'T', ?, 6, '{MEV}', '[]'::jsonb)""", id, owner, goal);
        return id;
    }

    private String preset(UUID id) {
        return jdbcTemplate.queryForObject(
            "select goal_preset from meso_template where id = ?", String.class, id);
    }

    private java.util.List<String> backfillStatements() throws Exception {
        String sql = Files.readString(Path.of(
            "src/main/resources/db/changelog/1.0.0/script/202608242315_mezo-dq60_goal_preset.sql"));
        // every UPDATE in the script, split on ';' after the ALTERs — extract with indexOf like
        // MesoTemplateVolumeBackfillSqlIT does; the ALTER already ran via Liquibase in the test DB.
        return java.util.Arrays.stream(sql.split(";"))
            .map(String::trim).filter(s -> s.toLowerCase().startsWith("update")).toList();
    }
}
```

- [ ] **Step 2: Run it — expect FAIL** (missing script file / missing column):
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=GoalPresetBackfillSqlIT test`

- [ ] **Step 3: Write the migration**

```sql
-- mezo-dq60: machine-readable goal preset (the wizard's choice; goal stays the human prose).
alter table mesocycle    add column goal_preset text;
alter table meso_template add column goal_preset text;

-- Backfill from the exact GOAL_PRESETS[].description strings the wizard has been writing
-- into `goal` (point-in-time snapshot, same convention as the mezo-gbo7 slug backfill).
-- An edited/unknown goal stays NULL — the FE falls back to hypertrophy at the point of use.
update mesocycle set goal_preset = case goal
    when 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' then 'hypertrophy'
    when 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' then 'strength'
    when 'Volumen-tartás · izom-megőrzés · deficit nélkül' then 'cut-prep'
    when 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' then 'recovery'
    when 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' then 'sport'
    when 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' then 'erohipertrofia'
    end
where goal_preset is null;

update meso_template set goal_preset = case goal
    when 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' then 'hypertrophy'
    when 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' then 'strength'
    when 'Volumen-tartás · izom-megőrzés · deficit nélkül' then 'cut-prep'
    when 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' then 'recovery'
    when 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' then 'sport'
    when 'Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső' then 'erohipertrofia'
    end
where goal_preset is null;
```

Register in `1.0.0_master.yml` (author `daniel.kuhne`, id `"1.0.0:202608242315_mezo-dq60_goal_preset"`, same shape as the previous entry).

- [ ] **Step 4: Add the entity fields** — both entities, directly after `goal`:

```java
    /** Machine key of the wizard's goal choice (hypertrophy/strength/…); null = unknown/legacy (mezo-dq60). */
    @Column(name = "goal_preset")
    private String goalPreset;
```

- [ ] **Step 5: Run the test + linter — expect PASS:**
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=GoalPresetBackfillSqlIT test && cd .. && node scripts/lint-liquibase.mjs`

- [ ] **Step 6: Commit** — `feat(train): persist goalPreset on mesocycle + template with description backfill (mezo-dq60)`

---

### Task 2: Contract field + every backend carry path

**Files:**
- Modify: `api/feature/train/train.yml` (`MesocycleResponse`, `MesoTemplateResponse`, `MesoTemplateUpsertRequest` — after each schema's `goal` property)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (`StampSource` record ~line 146, `stampRun` ~line 178)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoTemplateService.java` (`applyUpsert`, `start`, `rerun`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (only if MapStruct errors — same-name fields normally map alone)
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/GoalPresetCarryIT.java`

**Interfaces:**
- Consumes: Task 1's entity fields.
- Produces: contract property `goalPreset?: string | null` on the three schemas; a run stamped from a template carries the template's preset; `rerun` materializes it back.

- [ ] **Step 1: Failing test** — create a template with `goalPreset` via the API, start a run, assert the run row and response carry it; then rerun-materialize a legacy run and assert the new template inherits the run's preset. Drive it the way `MesoTemplateIT` drives create/start (reuse its helpers/style; add the `ownerId()` helper if the class is new):

```java
    @Test
    void testStartTemplate_shouldCarryGoalPresetOntoTheRun() { /* create upsert with goalPreset: "strength",
        POST start, assert GET /mesocycles row has goalPreset "strength" and the mesocycle table column matches */ }

    @Test
    void testRerun_shouldMaterializeGoalPresetFromLegacyRun() { /* build a run with setGoalPreset("sport"),
        templateId null, call rerun, assert the created template's goalPreset is "sport" */ }
```

Write these as REAL tests with the same populator/API calls `MesoTemplateIT` uses — the comment form above only names the scenario; the implementer writes full bodies before running.

- [ ] **Step 2: Run — expect FAIL** (unknown property `goalPreset`).

- [ ] **Step 3: Contract.** Add to all three schemas after `goal`:

```yaml
        goalPreset:
          type: string
          nullable: true
          description: Machine key of the wizard's goal choice (hypertrophy/strength/cut-prep/recovery/sport/erohipertrofia); null for legacy/edited goals (mezo-dq60)
```

Regenerate: `cd api/generate && pnpm generate:api`, then `cd frontend && pnpm generate:api`. Commit the regenerated bundle + client with this task.

- [ ] **Step 4: Carry paths.**
- `StampSource`: add `String goalPreset` after `goal`; `stampRun` adds `m.setGoalPreset(src.goalPreset());`.
- `MesoTemplateService.start`: pass `t.getGoalPreset()` in the `StampSource` construction.
- `applyUpsert`: `template.setGoalPreset(req.getGoalPreset());` (full-replace semantics, like every other field).
- `rerun` (legacy materialization): `template.setGoalPreset(run.getGoalPreset());`.
- `toResponse`/mappers: same-name — expect MapStruct to map automatically; add explicit `@Mapping` only if the build demands it.

- [ ] **Step 5: Run — expect PASS:**
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='GoalPresetCarryIT,MesoTemplateIT' test`

- [ ] **Step 6: Commit** — `feat(api): carry goalPreset through contract, stamp and rerun (mezo-dq60)`

---

### Task 3: Frontend data layer — types, hooks, every payload site

**Files:**
- Modify: `frontend/src/data/types.ts` (`Mesocycle` after `goal`, `MesoTemplate` equivalently)
- Modify: `frontend/src/data/train/mesoTemplateHooks.ts` (`toMesoTemplate` ~line 25, `toUpsert`, `mockCreate` ~line 149, `mockUpdate`)
- Modify: `frontend/src/data/train/trainHooks.ts` (the `Mesocycle` mapper, if it enumerates fields)
- Test: `frontend/src/data/train/mesoTemplateHooks.test.ts`

**Interfaces:**
- Consumes: `goalPreset` on the generated client types (Task 2).
- Produces: `Mesocycle.goalPreset?: string | null`, `MesoTemplate.goalPreset?: string | null`, surviving every save/hydrate round-trip.

- [ ] **Step 1: Failing test** — a round-trip pin in `mesoTemplateHooks.test.ts`:

```ts
test('goalPreset survives the template hydrate and upsert round-trip', () => {
  const hydrated = toMesoTemplate({ ...baseTemplateResponse, goalPreset: 'strength' })
  expect(hydrated.goalPreset).toBe('strength')
  expect(toUpsertForTest(hydrated).goalPreset).toBe('strength')
})
```

Use the file's existing response fixture and export-or-test-via-mock pattern; if `toUpsert` is not exported, assert through `mockUpdate`'s stored result instead — the point is that BOTH directions carry the field.

- [ ] **Step 2: Run — FAIL** (`goalPreset` undefined). **Step 3:** add `goalPreset: r.goalPreset ?? null` / `goalPreset: input.goalPreset ?? null` to every enumerated payload in the two hook files and the type fields in `types.ts`. Then **grep the whole frontend** for other objects listing `goal:` next to `weeks:`/`split:` and patch any further site (the enumeration trap). **Step 4:** `cd frontend && pnpm vitest run src/data/train/mesoTemplateHooks.test.ts` — PASS. **Step 5: Commit** — `feat(train): goalPreset in FE types and template hooks (mezo-dq60)`

---

### Task 4: Picker auto-fill from SCHEMES

**Files:**
- Modify: `frontend/src/features/train/logic/planner.ts` (export `PLYO_SCHEME`; keep `SCHEMES` exported as-is)
- Modify: `frontend/src/features/train/logic/exerciseDefaults.ts` (rewrite)
- Modify: `frontend/src/features/train/components/MesoExercises.tsx:72-80` (`addExercise`)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx:141` (wizard picker)
- Modify: `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx:146` (template editor picker)
- Test: `frontend/src/features/train/logic/exerciseDefaults.test.ts` (create)

**Interfaces:**
- Consumes: `SCHEMES: Record<string, GoalScheme>` (entries `{reps: '8-10', rir, sets}`), `PLYO_SCHEME = {reps: 5, sets: 3}`, `suggestedWarmupSets(day: MesoDay, exId: string): number`, `Mesocycle.goalPreset` / `MesoTemplate.goalPreset` (Task 3).
- Produces:
  - `libraryToGymExercise(item: ExerciseLibraryItem, preset?: string | null): GymExercise` — scheme-filled recipe, baseline warmups (compound 2 / isolation 1 / plyo 0), plyo gets `repMin: 5, repMax: 5, targetRIR: 0, countsTowardVolume: false`.
  - `addExerciseWithDefaults(day: MesoDay, item: ExerciseLibraryItem, preset?: string | null): MesoDay` — inserts, then refines warmups via `suggestedWarmupSets` on the post-insert day.

- [ ] **Step 1: Failing tests**

```ts
import { libraryToGymExercise, addExerciseWithDefaults } from './exerciseDefaults'

const compound = { id: 'c1', name: 'Front Squat', muscle: 'quad', type: 'compound' as const }
const iso = { id: 'i1', name: 'Leg Extension', muscle: 'quad', type: 'isolation' as const }
const plyo = { id: 'p1', name: 'Box Jump', muscle: 'quad', type: 'plyo' as const }

test('hypertrophy scheme fills a compound as 4×8-10 RIR1', () => {
  const ex = libraryToGymExercise(compound, 'hypertrophy')
  expect([ex.workingSets, ex.repMin, ex.repMax, ex.targetRIR]).toEqual([4, 8, 10, 1])
})

test('erohipertrofia scheme fills an isolation as 2×8-10 RIR0', () => {
  const ex = libraryToGymExercise(iso, 'erohipertrofia')
  expect([ex.workingSets, ex.repMin, ex.repMax, ex.targetRIR]).toEqual([2, 8, 10, 0])
})

test('no preset falls back to the hypertrophy scheme', () => {
  expect(libraryToGymExercise(iso, null).workingSets).toBe(3)
})

test('plyo is 3×5, zero warmups, RIR0, exempt from volume', () => {
  const ex = libraryToGymExercise(plyo, 'hypertrophy')
  expect([ex.warmupSets, ex.workingSets, ex.repMin, ex.repMax, ex.targetRIR]).toEqual([0, 3, 5, 5, 0])
  expect(ex.countsTowardVolume).toBe(false)
})

test('addExerciseWithDefaults refines warmups from warmupSuggest on the inserted day', () => {
  const day = { day: 'Hét', type: 'Push', muscle: 'quad', exerciseCount: 0, exercises: [] }
  const next = addExerciseWithDefaults(day, compound, 'hypertrophy')
  const added = next.exercises[0]
  expect(next.exercises).toHaveLength(1)
  expect(added.warmupSets).toBe(suggestedWarmupSets(next, added.id))
})
```

The last assertion deliberately compares against the real `suggestedWarmupSets` output rather than a literal — the suggestion rules are that module's contract, not this one's.

- [ ] **Step 2: Run — FAIL.** **Step 3: Implement** in `exerciseDefaults.ts`:

```ts
import { SCHEMES, PLYO_SCHEME } from '@/features/train/logic/planner'
import { suggestedWarmupSets } from '@/features/train/logic/warmupSuggest'

const parseReps = (reps: string): [number, number] => {
  const [lo, hi] = reps.split('-').map(Number)
  return [lo, hi ?? lo]
}

export function libraryToGymExercise(item: ExerciseLibraryItem, preset?: string | null): GymExercise {
  const base = { id: `${item.id}-${crypto.randomUUID()}`, name: item.name, muscle: item.muscle,
    type: item.type, ...(item.catalogId ? { catalogId: item.catalogId } : {}) }
  if (item.type === 'plyo') {
    return { ...base, warmupSets: 0, workingSets: PLYO_SCHEME.sets,
      repMin: PLYO_SCHEME.reps, repMax: PLYO_SCHEME.reps, targetRIR: 0, countsTowardVolume: false }
  }
  const scheme = (SCHEMES[preset ?? 'hypertrophy'] ?? SCHEMES.hypertrophy)[item.type]
  const [repMin, repMax] = parseReps(scheme.reps)
  return { ...base, warmupSets: item.type === 'compound' ? 2 : 1,
    workingSets: scheme.sets, repMin, repMax, targetRIR: scheme.rir }
}

export function addExerciseWithDefaults(day: MesoDay, item: ExerciseLibraryItem, preset?: string | null): MesoDay {
  const ex = libraryToGymExercise(item, preset)
  const inserted = { ...day, exercises: [...day.exercises, ex], exerciseCount: day.exercises.length + 1 }
  const warmupSets = ex.type === 'plyo' ? 0 : suggestedWarmupSets(inserted, ex.id)
  return { ...inserted, exercises: inserted.exercises.map((e) => e.id === ex.id ? { ...e, warmupSets } : e) }
}
```

Export `PLYO_SCHEME` from `planner.ts` (it is currently module-private). Rewire the three call sites to `addExerciseWithDefaults(d, item, <context preset>)`: `MesoExercises` gets the preset from its `meso` prop, `MesocyclePlannerPage` from its selected `goal?.id`, `MesoTemplateEditorPage` from `template.goalPreset`. `CustomWorkoutBuilderPage` does not use this helper today — check its add path; if it builds its own defaults, leave it (custom workouts have no meso context; hypertrophy behaviour is the status quo there).

- [ ] **Step 4: Run — PASS**, plus the callers' page tests: `pnpm vitest run src/features/train/logic/exerciseDefaults.test.ts src/features/train/pages/MesocyclePlannerPage.test.tsx src/features/train/pages/MesoTemplateEditorPage.test.tsx`. Existing page tests asserting the OLD default (3×6-8 RIR2) will need their expectations updated to the scheme values — that is the intended behaviour change; update them, do not weaken them.
- [ ] **Step 5: Commit** — `feat(train): goal+type-aware picker auto-fill from SCHEMES (mezo-dq60)`

---

### Task 5: Wizard writes the preset; template editor gets a "Cél" dropdown

**Files:**
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx:195-205` (`saveTemplate` request)
- Modify: `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx` (meta header area, ~lines 73-85)
- Test: `frontend/src/features/train/pages/MesoTemplateEditorPage.test.tsx`, `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`

**Interfaces:**
- Consumes: `GOAL_PRESETS` from `@/data/train/train`, `updateTemplate(id, input)` from `useMesoTemplates()` (Task 3's carried field).
- Produces: wizard saves `goalPreset: goal?.id`; the template editor renders a `<select aria-label="Cél">` with the six presets plus an empty option, persisting via full-upsert.

- [ ] **Step 1: Failing tests** — wizard: extend the existing save-flow test to assert the created request carries `goalPreset` equal to the chosen preset id. Editor: render with a template whose `goalPreset` is `'strength'`, assert the select shows it; change it to `'hypertrophy'`, assert `updateTemplate` was called with `goalPreset: 'hypertrophy'` and every other field unchanged (full-replace semantics — reuse the file's existing mock of `useMesoTemplates`).
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.** Wizard: add `goalPreset: goal?.id` to the request literal. Editor: a labelled select in the meta block, options from `GOAL_PRESETS.map(p => ({value: p.id, label: p.label}))` plus `{value: '', label: '—'}` mapping to null, styled with the file's existing idiom; on change build the full upsert from the current template (via the same helper the exercise-save path uses) with the new preset.
- [ ] **Step 4: Run — PASS.** **Step 5: Commit** — `feat(train): wizard persists goalPreset; template editor Cél dropdown (mezo-dq60)`

---

### Task 6: Docs + gates

**Files:**
- Modify: `docs/features/train.md` (the Meso builder / template sections: document `goalPreset` and the scheme-driven picker fill; fix any sentence still claiming the picker seeds a flat `3×6-8 RIR2`)
- Modify: `docs/CODEMAP.md` (regenerate)

- [ ] **Step 1:** Update `train.md`: search it for the old default description (`libraryToGymExercise seeds warmupSets: 2` appears in a `MesoEditor.tsx` comment reference at minimum) and rewrite affected sentences to the new behaviour, naming the fallback rule (no preset → hypertrophy).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs` — all clean.
- [ ] **Step 3:** Backend gate — verify every named class exists first (`find backend/src/test -name 'GoalPreset*' -o -name 'MesoTemplate*IT.java' -o -name 'TrainServiceIT.java'`), then:
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='GoalPreset*IT,MesoTemplate*IT,TrainServiceIT,Volume*IT,Workout*IT' test` — report the REAL class/test counts from the Surefire output.
- [ ] **Step 4:** Frontend gate — `cd frontend && pnpm test`, `VITE_USE_MOCK=false pnpm test`, `pnpm build`.
- [ ] **Step 5: Commit** — `docs(train): goalPreset + scheme-driven picker fill (mezo-dq60)`

---

## Notes for the implementer

- **`ExerciseAccordionRow`/`ExerciseRecipeRow` need no change** — they render whatever recipe the exercise carries.
- **The MesoEditor comment at `MesoEditor.tsx:77`** says "libraryToGymExercise seeds warmupSets: 2 for every pick" — update it in Task 4, it becomes false.
- **`suggestedWarmupSets` is order-sensitive** (it reads the day the exercise sits in). `addExerciseWithDefaults` computes it AFTER insertion on purpose; do not "optimize" it to run on the bare item.
- **The old flat default (`3×6-8 RIR2`) disappears.** Tests that pinned it must move to the scheme values, and mock-mode budget numbers in unrelated page tests may shift if a fixture used the picker path at runtime — investigate each before touching an expectation.
