# Muscle Priority Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-coarse-muscle priority tiers (Emphasize / Grow / Maintain) chosen in the wizard and editable later, retargeting the weekly volume ramp (MRV / MAV / MEV ceilings), reframing the budget card pills against each group's own tier target, silencing frequency/variety lint for Maintain groups, and adding a peak-week session-time fit signal.

**Architecture:** One nullable jsonb map column on two tables (`muscle_priorities`, sparse — only non-Grow entries), carried through the same contract schemas and stamp/rerun paths as `goalPreset` (mezo-dq60), plus one new focused `PUT /mesocycles/{id}/muscle-priorities` endpoint for mid-cycle edits. The engine coupling is a single point: `VolumeDecider.Input` gains `rampCeiling` + `rampEnabled` (resolved by the caller from the tier); `plannedScaffold` and the FE mock arc mirror the same ceiling. On the FE, a shared `MusclePriorityPicker` mounts in the wizard's new Fókusz step, the template editor, and the run editor; `setBudget`/`structureLint`/new `peakWeekFit` take an optional tier map defaulting to all-Grow.

**Tech Stack:** Spring Boot 3 / Java 21, Postgres + Liquibase (Hibernate 6 `@JdbcTypeCode(SqlTypes.JSON)`, no converters), OpenAPI-generated DTOs; React + TypeScript + Vitest + MSW.

**Spec:** [`../specs/2026-08-24-meso-goal-preset-and-muscle-priorities-design.md`](../specs/2026-08-24-meso-goal-preset-and-muscle-priorities-design.md), Slice 2 (GD3–GD7). Slice 1 (`mezo-dq60`) is already on main.

## Global Constraints

- Driving bd issue: **`mezo-3m5m`**. Every commit subject carries it.
- Branch: `feat/muscle-priority-tiers` (cut from current main). Work on it.
- Liquibase: script name and changeSet id suffix MUST be `202608251200_mezo-3m5m_muscle_priorities` (12-digit UTC minute, fixed — do not regenerate). Append at the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`; never edit an existing changeSet. `node scripts/lint-liquibase.mjs` enforces the shape.
- Field is `musclePriorities` (Java/TS/contract), column `muscle_priorities` (jsonb, nullable). **No backfill** — NULL = all Grow, live behaviour must not jump on deploy (spec GD3/§Slice-2 data model). **No DB CHECK.**
- Tier values on the wire: `"emphasize"` / `"grow"` / `"maintain"`. Stored SPARSELY: only non-Grow entries; absent key / unknown value / NULL map = Grow. FE never writes `"grow"` entries.
- Tier → ceiling: Emphasize→MRV, Grow→MAV, Maintain→MEV with ramp disabled (spec GD4). Grind / early-deload / deload-fraction logic untouched — early-deload keeps detecting at raw MRV.
- Tier-able groups: exactly the 9 backend baseline groups `chest, back, shoulder, biceps, triceps, quad, ham, glute, calf`. `traps`/`core` have no landmarks and no tier (spec: "no row, no tier").
- Backend tests run with `-Dmezo.test.use-testcontainers=true`. Jackson 3 (`tools.jackson.*`). `ownerId()` is a per-class helper in `feature/train` ITs (copy from `GoalPresetCarryIT`), NOT inherited. Always `./mvnw clean test` for full runs (Lombok+MapStruct incremental compile is flaky) — but use `-Dtest=` focused runs per task; NEVER the whole backend suite locally.
- Frontend tests must pass in BOTH modes (`pnpm test` = real/MSW, and `VITE_USE_MOCK=true pnpm test` = mock) plus `pnpm build`. Known flake: `ActiveWorkoutPage.test.tsx` times out under concurrent load, passes standalone (mezo-sw4w).
- Contract changes: edit `api/feature/train/train.yml`, then `cd api/generate && npm run generate:api` (merged bundle) BEFORE `cd frontend && pnpm generate:api`. Never hand-edit `api.gen.ts` or `api/openapi.yml`. Commit regenerated artifacts with the task that changed the contract.
- **Field-enumeration trap** (bit mezo-gbo7 AND mezo-dq60): every payload builder that lists fields explicitly must carry `musclePriorities` — the full checklist is in Task 5. Grep, don't trust the list.
- **Stale-cache lesson** (commit `ae8c8a5b`, `MesoTemplateEditorPage.tsx:121-130`): any persisting control in the template editor must build its upsert from `TemplateDayEditor`'s live `days` state, never the parent's query-cache copy.
- Do not touch the live database.
- Do NOT push, open a PR, or close the bd issue from a task — the controller handles ship flow after the final review.

## Locked design decisions (assumptions the spec left open)

- **AD1 — Grow pills stay compact:** the tier word appears in a pill only for non-Grow groups (`Hát · Emphasize · 84%`, `Farizom · Maintain · 100%`); the default Grow renders `Mell 84%` (percent of MAV). Matches GD3's sparse philosophy.
- **AD2 — Maintain never cuts down:** ramp disabled means the RAMP branch is skipped; a mid-cycle switch to Maintain holds current sets (GD7: nothing rewritten retroactively). Fresh mesos start at MEV anyway.
- **AD3 — Emphasize hard cap 2** in the picker (other groups' Emphasize option disabled once 2 are chosen).
- **AD4 — planned deload week derives from the tier ceiling** (`round(ceiling × deloadFraction)`) so the planned curve stays internally consistent with the actual decider (whose prevSets ≈ ceiling at deload time).
- **AD5 — FE landmark fallback:** budget/fit math prefers the context's `volumePerMuscle` (run `VolumeProfile` / template `VolumeBaseline`), falling back to a new `GROUP_LANDMARKS` table in `setBudget.ts` copied verbatim from `application.yml` `mezo.volume.baselines`. Groups without landmarks (traps/core) render a set-count-only pill, no %.
- **AD6 — tiers do NOT join `programSignature`** in the wizard — changing tiers must not regenerate (and wipe) the program; the generator upgrade is a separate epic (mezo-oyhy). `programFit.ts`'s hard frequency/variety legality checks also stay unchanged (`mezo-yqpf` territory).
- **AD7 — the fit signal is its own card** (`PeakFitCard`), distinct from lint R8 (which keeps firing on the template's own minutes) — R8 measures today, the fit card measures the projected peak week.

---

### Task 1: Persist `muscle_priorities` + contract + every backend carry path

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608251200_mezo-3m5m_muscle_priorities.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesocycleEntity.java` (after `goalPreset`, ~line 59)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesoTemplateEntity.java` (after `goalPreset`, ~line 55)
- Modify: `api/feature/train/train.yml` (`MesocycleResponse` ~:1566, `MesoTemplateResponse` ~:1634, `MesoTemplateUpsertRequest` ~:1979 — after each schema's `goalPreset`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoTemplateService.java` (`applyUpsert` ~:150, `start` ~:95-103, `rerun` ~:124)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (`StampSource` record ~:139-161, `stampRun` ~:180)
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MusclePrioritiesCarryIT.java`

**Interfaces:**
- Produces: `MesocycleEntity.getMusclePriorities()/setMusclePriorities(Map<String,String>)`, same on `MesoTemplateEntity`; contract property `musclePriorities?: {[key: string]: string} | null` on the three schemas; a run stamped from a template carries the template's map; `rerun` materializes it back.

- [ ] **Step 1: Write the failing test** — clone `GoalPresetCarryIT` (same package) structure exactly: extends `ApiIntegrationTest`, `@Autowired OwnerProperties`, `TrainPopulator`, `JdbcTemplate`, per-class `ownerId()` helper, `TEMPLATES`/`MESOCYCLES` constants, minimal single-Rest-day `upsertRequest()` fixture.

```java
package io.mrkuhne.mezo.feature.train;

// imports modeled on GoalPresetCarryIT

/** mezo-3m5m: the sparse musclePriorities map survives upsert -> start -> run, and rerun materializes it back. */
class MusclePrioritiesCarryIT extends ApiIntegrationTest {

    @Test
    void testStartTemplate_shouldCarryMusclePrioritiesOntoTheRun() {
        // POST upsert with musclePriorities: {"back":"emphasize","glute":"maintain"} -> assert response carries it;
        // POST /start -> assert MesocycleResponse.musclePriorities equals the map;
        // GET /mesocycles list -> the run row carries it;
        // DB column: select muscle_priorities::text from mesocycle where id = ? -> contains "emphasize".
    }

    @Test
    void testRerun_shouldMaterializeMusclePrioritiesFromLegacyRun() {
        // trainPopulator.createMesocycle(owner, "Legacy blokk", "archived");
        // raw SQL: update mesocycle set muscle_priorities = '{"back":"emphasize"}'::jsonb where id = ?;
        // POST /rerun -> find the materialized template in the list GET -> assert musclePriorities carries {"back":"emphasize"}.
    }

    @Test
    void testUpsert_withNullMap_shouldPersistNull() {
        // POST upsert without musclePriorities -> start -> DB column is null (all-Grow default).
    }
}
```

Write REAL bodies with `GoalPresetCarryIT`'s exact API-driving style (its `startRequest(...)`/`upsertRequest()` builders) before running. The map on the request DTO will be `java.util.Map.of("back", "emphasize", "glute", "maintain")`.

- [ ] **Step 2: Run — expect FAIL** (unknown property):
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=MusclePrioritiesCarryIT clean test`

- [ ] **Step 3: Migration**

```sql
-- mezo-3m5m: sparse per-coarse-muscle priority tier map ({"back":"emphasize","glute":"maintain"}).
-- Absent key = grow. No backfill: NULL = all grow, so live behaviour does not jump on deploy (spec GD3).
alter table mesocycle     add column muscle_priorities jsonb;
alter table meso_template add column muscle_priorities jsonb;
```

Register in `1.0.0_master.yml` at the END (author `daniel.kuhne`, id `"1.0.0:202608251200_mezo-3m5m_muscle_priorities"`, `sqlFile` + `relativeToChangelogFile: true`, same shape as the `202608242315_mezo-dq60_goal_preset` entry at ~:807-813).

- [ ] **Step 4: Entity fields** — both entities, directly after `goalPreset` (imports `org.hibernate.annotations.JdbcTypeCode`, `org.hibernate.type.SqlTypes`, `java.util.Map` already present on `MesoTemplateEntity`; add to `MesocycleEntity` as needed):

```java
    /** Sparse per-coarse-muscle priority tiers ("emphasize"/"maintain"; absent key = grow); null = all grow (mezo-3m5m). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "muscle_priorities", columnDefinition = "jsonb")
    private Map<String, String> musclePriorities;
```

- [ ] **Step 5: Contract** — add to all three schemas after `goalPreset`:

```yaml
        musclePriorities:
          type: object
          nullable: true
          description: Sparse per-coarse-muscle priority tier map (emphasize/maintain; absent key = grow); null/empty = all grow (mezo-3m5m)
          additionalProperties:
            type: string
```

Regenerate: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Commit the regenerated bundle + client with this task.

- [ ] **Step 6: Carry paths.**
- `TrainService.StampSource`: add `Map<String, String> musclePriorities` as the LAST component (the record is positional — appending avoids silent shifts; there is exactly one construction site).
- `TrainService.stampRun`: after `m.setGoalPreset(...)` add the defensive copy (managed→new entity must not share the map instance — same reason as the `List.copyOf(src.phaseCurve())` at ~:188):
```java
        m.setMusclePriorities(src.musclePriorities() != null ? Map.copyOf(src.musclePriorities()) : null);
```
- `MesoTemplateService.start`: append `t.getMusclePriorities()` to the `StampSource` construction (last position).
- `MesoTemplateService.applyUpsert`: `template.setMusclePriorities(req.getMusclePriorities());` (full-replace semantics).
- `MesoTemplateService.rerun`: `template.setMusclePriorities(run.getMusclePriorities() != null ? Map.copyOf(run.getMusclePriorities()) : null);`
- `TrainMapper`: `Map<String,String>` is name-identical on entity↔DTO — expect MapStruct to auto-map (goalPreset needed zero mapper changes); add an explicit method only if the build demands it.

- [ ] **Step 7: Run — expect PASS:**
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='MusclePrioritiesCarryIT,GoalPresetCarryIT,MesoTemplateIT' clean test && cd .. && node scripts/lint-liquibase.mjs`

- [ ] **Step 8: Commit** — `feat(api): persist musclePriorities on mesocycle + template, carry through stamp and rerun (mezo-3m5m)`

---

### Task 2: `PriorityTier` + tier-aware `VolumeDecider`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/PriorityTier.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeDecider.java` (`Input` record :12-14, RAMP branch :27-32)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/VolumeDeciderTest.java` (extend), `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/PriorityTierTest.java` (create)

**Interfaces:**
- Consumes: nothing new (pure logic).
- Produces:
  - `enum PriorityTier { EMPHASIZE, GROW, MAINTAIN }` with `static PriorityTier of(Map<String,String> priorities, String muscle)` (null map / absent key / unknown value → GROW), `int ceiling(int mev, int mav, int mrv)` (EMPHASIZE→mrv, GROW→mav, MAINTAIN→mev), `boolean rampEnabled()` (false only for MAINTAIN).
  - `VolumeDecider.Input` with two appended components: `int rampCeiling, boolean rampEnabled`. All other branches (START, deload/early-deload, HOLD) byte-identical.

- [ ] **Step 1: Failing tests.** In `VolumeDeciderTest`, update the fixture (landmarks stay `mev=8, mav=14, mrv=20, step=2`) and add tier cases. Give the helper an explicit ceiling variant:

```java
    private Input in(int week, int prev, boolean deload, int logged, boolean grind) {
        return tiered(week, prev, deload, logged, grind, 20, true); // legacy = emphasize semantics
    }
    private Input tiered(int week, int prev, boolean deload, int logged, boolean grind,
            int rampCeiling, boolean rampEnabled) {
        return new Input(week, prev, 8, 14, 20, deload, logged, grind, 2, HALF, rampCeiling, rampEnabled);
    }
    @Test void growTier_clampsRampAtItsCeiling() {
        Result r = VolumeDecider.decide(tiered(3, 13, false, 13, false, 14, true));
        assertThat(r.lever()).isEqualTo(Lever.RAMP); assertThat(r.targetSets()).isEqualTo(14); // 13+2 clamped to MAV
    }
    @Test void growTier_atCeiling_holds() {
        Result r = VolumeDecider.decide(tiered(4, 14, false, 14, false, 14, true));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(14);
    }
    @Test void maintainTier_neverRamps() {
        Result r = VolumeDecider.decide(tiered(3, 8, false, 8, false, 8, false));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(8);
    }
    @Test void maintainTier_midCycleSwitch_holdsAboveCeilingWithoutCutting() {
        Result r = VolumeDecider.decide(tiered(4, 12, false, 12, false, 8, false));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(12); // AD2 / GD7
    }
    @Test void earlyDeload_stillDetectsAtRawMrv_regardlessOfTier() {
        Result r = VolumeDecider.decide(tiered(4, 20, false, 20, true, 14, true)); // prev>=mrv && grind
        assertThat(r.lever()).isEqualTo(Lever.DELOAD);
    }
```

`PriorityTierTest`: `of` with null map → GROW; `{"back":"emphasize"}` + "back" → EMPHASIZE; unknown value `"typo"` → GROW; `ceiling(8,14,20)` per tier → 20/14/8; `rampEnabled` false only for MAINTAIN.

- [ ] **Step 2: Run — FAIL** (record arity): `cd backend && ./mvnw -q -Dtest='VolumeDeciderTest,PriorityTierTest' test`

- [ ] **Step 3: Implement.**

```java
/** Per-muscle priority tier — picks which volume landmark is "100%" for the weekly ramp (mezo-3m5m, spec GD4). */
public enum PriorityTier {
    EMPHASIZE, GROW, MAINTAIN;

    /** Sparse-map resolve: null map, absent key, or unknown value all mean the GROW default. */
    public static PriorityTier of(Map<String, String> priorities, String muscle) {
        if (priorities == null) return GROW;
        return switch (priorities.getOrDefault(muscle, "grow")) {
            case "emphasize" -> EMPHASIZE;
            case "maintain" -> MAINTAIN;
            default -> GROW;
        };
    }

    public int ceiling(int mev, int mav, int mrv) {
        return switch (this) { case EMPHASIZE -> mrv; case GROW -> mav; case MAINTAIN -> mev; };
    }

    public boolean rampEnabled() {
        return this != MAINTAIN;
    }
}
```

`VolumeDecider.Input` — append `int rampCeiling, boolean rampEnabled`. RAMP branch becomes:

```java
        boolean targetHit = in.loggedLastWeek() >= in.prevSets();
        if (in.rampEnabled() && targetHit && !in.grind() && in.prevSets() < in.rampCeiling()) {
            int target = Math.min(in.prevSets() + in.step(), in.rampCeiling());
            return new Result(target, Lever.RAMP, "+" + (target - in.prevSets())
                + " (" + in.prevSets() + " → " + target + ")");
        }
```

Early-deload keeps `in.prevSets() >= in.mrv() && in.grind()` — raw MRV (GD4: grind/early-deload untouched). Fix the one production call site (`VolumeProgressionService:140-144`) minimally in THIS task to keep the build green: pass `row.getMrv(), true` (behaviour-neutral placeholder; Task 3 wires the real tier). Grep for any other `VolumeDecider.decide` caller.

- [ ] **Step 4: Run — PASS:** `cd backend && ./mvnw -q -Dtest='VolumeDeciderTest,PriorityTierTest' test`
- [ ] **Step 5: Commit** — `feat(train): PriorityTier + tier-resolved ramp ceiling in VolumeDecider (mezo-3m5m)`

---

### Task 3: Tier wiring — rollover + planned scaffold

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeProgressionService.java` (`rolloverIfDue` ~:124-156)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeArcService.java` (`buildMuscleArc` ~:110-130, `plannedScaffold` :150-165)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeProgressionTierIT.java` (create), `backend/src/test/java/io/mrkuhne/mezo/feature/train/VolumeArcContractIT.java` (extend if its planned-curve pins break)

**Interfaces:**
- Consumes: Task 1's `meso.getMusclePriorities()`, Task 2's `PriorityTier`.
- Produces: rollover ramps each muscle toward its tier ceiling; `plannedScaffold(List<String> phaseCurve, int weeks, int mev, int ceiling)` — the former `mrv` param renamed to `ceiling`, deload week = `round(ceiling * deloadFraction)` (AD4).

- [ ] **Step 1: Failing IT** — model on `VolumeProgressionServiceIT` (same package, its populator/fixture style; copy its meso+log-row+workout seeding helpers). Seed one meso with `musclePriorities = Map.of("back", "emphasize", "glute", "maintain")` and three log rows (back, glute, chest) mid-cycle with logged volume hitting target:

```java
    @Test
    void testRollover_shouldRampTowardTierCeilings() {
        // back (emphasize, mev 10/mav 16/mrv 22, current 16, logged 16): ramps 16 -> 18 (past MAV, toward MRV)
        // chest (no entry = grow, mev 8/mav 14/mrv 20, current 14, logged 14): HOLDs at 14 (MAV ceiling)
        // glute (maintain, mev 8, current 8, logged 8): HOLDs at 8 (never ramps)
    }
```

Write the real body: assert the three `current_sets` values after `rolloverIfDue`, plus the `volumeRecompute` change labels.

- [ ] **Step 2: Run — FAIL** (chest ramps past MAV today): `cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=VolumeProgressionTierIT clean test`

- [ ] **Step 3: Implement.** In `rolloverIfDue`, inside the per-row loop (before the decide call):

```java
            PriorityTier tier = PriorityTier.of(meso.getMusclePriorities(), muscle);
            VolumeDecider.Result result = VolumeDecider.decide(new VolumeDecider.Input(
                calWeek, row.getCurrentSets(), row.getMev(), row.getMav(), row.getMrv(), deloadPhase,
                signals.loggedLastWeek().getOrDefault(muscle, 0),
                signals.grind().getOrDefault(muscle, false),
                props.step(), props.deloadFraction(),
                tier.ceiling(row.getMev(), row.getMav(), row.getMrv()), tier.rampEnabled()));
```

In `VolumeArcService.buildMuscleArc`: resolve the tier from the meso's map for the row's muscle, pass `tier.ceiling(...)` into `plannedScaffold` (the `arc` method at :76 already loads the `MesocycleEntity` — thread it or the resolved ceiling down). In `plannedScaffold`, rename the `mrv` param to `ceiling` and change the deload-week line from `round(mrv * fraction)` to `round(ceiling * fraction)`; ramp clamp `Math.min(ramp + props.step(), ceiling)`. The arc RESPONSE keeps emitting the raw row `mrv` (the chart's scale/caption stay factual).

- [ ] **Step 4: Run tier IT + the engine regression set — PASS** (existing planned-curve pins in `VolumeArcContractIT` will shift because Grow now peaks at MAV — that is the intended GD4 behaviour change; update expectations, don't weaken assertions):
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='VolumeProgressionTierIT,VolumeProgressionServiceIT,VolumeArcContractIT,VolumeArcVolumeFlagIT,VolumeEffectiveSetsIT' clean test`
- [ ] **Step 5: Commit** — `feat(train): tier-targeted weekly ramp + planned scaffold ceiling (mezo-3m5m)`

---

### Task 4: Run-level tier edit endpoint

**Files:**
- Modify: `api/feature/train/train.yml` (new path after `/api/train/mesocycles/{id}/close`; new schema `MusclePrioritiesUpdateRequest` near `MesoTemplateStartRequest`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (implement the generated interface method, next to `activateMesocycle` ~:163)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (new method next to `activateMesocycle` ~:231)
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/train/MusclePrioritiesCarryIT.java`

**Interfaces:**
- Consumes: Task 1's entity field.
- Produces: `PUT /api/train/mesocycles/{id}/muscle-priorities` (operationId `updateMesocycleMusclePriorities`) → `MesocycleResponse`; `TrainService.updateMusclePriorities(UUID createdBy, UUID id, Map<String,String> priorities)`.

- [ ] **Step 1: Failing test** in `MusclePrioritiesCarryIT`:

```java
    @Test
    void testUpdateMusclePriorities_shouldReplaceTheMapOnTheRun() {
        // create+start a run with {"back":"emphasize"}; PUT /muscle-priorities with {"glute":"maintain"};
        // assert response map == {"glute":"maintain"}; DB column no longer contains "emphasize";
        // PUT with empty map -> column is null (empty normalizes to null / all-Grow).
    }
```

Drive with the class's existing API style (the PUT body is the generated `MusclePrioritiesUpdateRequest`).

- [ ] **Step 2: Run — FAIL** (404 / missing operation).

- [ ] **Step 3: Contract.** Path (model the parameter/401/404 shape on `/activate` at :29-58, but as `put` with a requestBody):

```yaml
  /api/train/mesocycles/{id}/muscle-priorities:
    put:
      tags: [Train]
      operationId: updateMesocycleMusclePriorities
      summary: Replace the run's muscle priority tier map — takes effect at the next weekly rollover (mezo-3m5m)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MusclePrioritiesUpdateRequest'
      responses:
        '200':
          description: Updated mesocycle
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MesocycleResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Not found or not owned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

Schema (in `components.schemas`):

```yaml
    MusclePrioritiesUpdateRequest:
      type: object
      properties:
        musclePriorities:
          type: object
          nullable: true
          description: Sparse per-coarse-muscle priority tier map (emphasize/maintain; absent key = grow); null/empty = all grow (mezo-3m5m)
          additionalProperties:
            type: string
```

Regenerate both (api bundle, then FE client).

- [ ] **Step 4: Implement.** Service (mirror `activateMesocycle`'s ownership idiom):

```java
    /** GD7: the map change is stored now, applied at the next weekly rollover — nothing rewritten retroactively. */
    @Transactional
    public MesocycleResponse updateMusclePriorities(UUID createdBy, UUID id, Map<String, String> priorities) {
        MesocycleEntity m = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(id), createdBy);
        m.setMusclePriorities(priorities == null || priorities.isEmpty() ? null : Map.copyOf(priorities));
        return mapper.toResponse(m);
    }
```

Controller: implement the generated method, delegating with `currentUserId.get()` like `activateMesocycle`.

- [ ] **Step 5: Run — PASS:** `cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest=MusclePrioritiesCarryIT clean test`
- [ ] **Step 6: Commit** — `feat(api): PUT mesocycle muscle-priorities for mid-cycle tier edits (mezo-3m5m)`

---

### Task 5: Frontend data layer — types, every payload site, mock arc parity

**Files:**
- Modify: `frontend/src/data/types.ts` (`MuscleTier`/`MusclePriorities` types; `Mesocycle` ~:1016, `MesoTemplate` ~:1044 — after `goalPreset`)
- Modify: `frontend/src/data/train/mesoTemplateHooks.ts` (`toMesoTemplate` ~:28, `mockCreate` ~:153, `mockUpdate` ~:174, `mockStart` ~:203, mock rerun ~:238)
- Modify: `frontend/src/features/train/logic/runToTemplate.ts` (~:52)
- Modify: `frontend/src/features/train/pages/MesoTemplatesPage.tsx` (`duplicate` ~:53)
- Modify: `frontend/src/data/train/trainApi.ts` (new `updateMusclePriorities` next to `activate` ~:71)
- Modify: `frontend/src/data/train/trainHooks.ts` (new mutation on the hook owning the mesocycles cache, mock branch included — follow the file's existing activate/close mutation pattern with `setQueryData`)
- Modify: `frontend/src/test/msw/handlers.ts` (POST template ~:649, PUT template ~:668, `/start` ~:679-695; new PUT `/api/train/mesocycles/:id/muscle-priorities` handler)
- Modify: `frontend/src/data/train/train.ts` (`mesoTemplatesMock` second entry ~:421; `mockMuscleArc` ceiling ~:498-524)
- Test: `frontend/src/data/train/mesoTemplateHooks.test.ts`, `frontend/src/data/train/train.test.ts` (or wherever the mock arc is pinned — grep `mockMuscleArc`/`mesoVolumeArcMock` tests)

**Interfaces:**
- Consumes: `musclePriorities` on the generated client types (Tasks 1+4).
- Produces:
  - `export type MuscleTier = 'emphasize' | 'grow' | 'maintain'` and `export type MusclePriorities = Record<string, MuscleTier>` in `types.ts`; `musclePriorities?: MusclePriorities | null` on `Mesocycle` and `MesoTemplate`.
  - Every save/hydrate round-trip carries the field; `trainApi.updateMusclePriorities(id, map)` + a `updateMusclePriorities` mutation usable by Task 8.
  - `mockMuscleArc` ramps to the tier ceiling (mock⇄backend arc parity).

- [ ] **Step 1: Failing tests** — clone the two goalPreset round-trip pins in `mesoTemplateHooks.test.ts` (:146 hydrate, :172 mock create/update) for `musclePriorities: { back: 'emphasize' }`, plus a mockStart carry pin (the stamp path re-armed the mezo-gbo7 defect — spec calls for a dedicated stamp test on BOTH modes; the real-mode stamp is covered by `MusclePrioritiesCarryIT`, this is the mock mirror):

```ts
it('musclePriorities survives the template hydrate round-trip (real mode GET)', ...)
it('musclePriorities survives the template save round-trip (mock createTemplate/updateTemplate)', ...)
it('musclePriorities is stamped onto the run by mock startTemplate', ...)
```

And a mock-arc ceiling pin (grow default → planned curve peaks at MAV, maintain → flat MEV) in the file that already tests the mock arc — grep for existing `mesoVolumeArcMock` tests and extend there with a fixture meso carrying `musclePriorities`.

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.** The enumeration checklist — EVERY site, then grep `goalPreset` across `frontend/src` and confirm every hit-file also handles `musclePriorities` (the generated `api.gen.ts` type is `{[key: string]: string}` — cast to `MusclePriorities` at the `toMesoTemplate`/`toMesocycle` boundary):
  - `types.ts`: types + both interfaces.
  - `mesoTemplateHooks.ts`: `toMesoTemplate` (`musclePriorities: (r.musclePriorities as MusclePriorities | null) ?? null`), `mockCreate`, `mockUpdate` (`input.musclePriorities ?? null`), `mockStart` (`tpl?.musclePriorities ?? null`), mock rerun (`meso?.musclePriorities ?? null`).
  - `runToTemplate.ts`: `musclePriorities: meso.musclePriorities ?? null`.
  - `MesoTemplatesPage.tsx` duplicate: `musclePriorities: t.musclePriorities`.
  - `trainHooks.ts` `toMesocycle` spreads `...r` — rides along; just verify.
  - msw: POST/PUT template echo `musclePriorities: body.musclePriorities ?? null`; `/start` handler response gains `musclePriorities` (and while there, `goalPreset` — the run-side mock surface was left thin by mezo-dq60; add both so real-mode stamp tests can assert); new PUT muscle-priorities handler echoing the body onto the mock run shape.
  - `trainApi.ts`:
```ts
  updateMusclePriorities: (id: string, musclePriorities: MusclePriorities | null): Promise<MesocycleResponse> =>
    apiFetch<MesocycleResponse>(`/api/train/mesocycles/${id}/muscle-priorities`, {
      method: 'PUT',
      body: JSON.stringify({ musclePriorities }),
    }),
```
  - `trainHooks.ts`: mutation calling it in real mode; mock mode updates the mesocycles cache via `setQueryData` (copy the activate/close mock-branch idiom exactly — mind the mock-cache clobber pattern: the cache write must stick, mirror how existing mutations there do it).
  - `train.ts`: `mesoTemplatesMock[1]` gains `musclePriorities: { back: 'emphasize' }` (the fresh template — demonstrates carry in mock mode); the `mesocycles` run fixtures gain `musclePriorities: null` explicitly. `mockMuscleArc`: resolve tier per muscle from the fixture meso's map with a tiny local `tierCeiling(tier, vp)` and clamp `Math.min(ramp + MOCK_STEP, ceiling)`; deload week mirrors AD4 (`ceiling * MOCK_DELOAD_FRACTION`).
- [ ] **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/data/train/ && VITE_USE_MOCK=true pnpm vitest run src/data/train/`
- [ ] **Step 5: Commit** — `feat(train): musclePriorities in FE types, hooks, mocks and arc parity (mezo-3m5m)`

---

### Task 6: `MusclePriorityPicker` component

**Files:**
- Create: `frontend/src/features/train/logic/musclePriorities.ts`
- Create: `frontend/src/features/train/components/MusclePriorityPicker.tsx`
- Test: `frontend/src/features/train/logic/musclePriorities.test.ts`, `frontend/src/features/train/components/MusclePriorityPicker.test.tsx`

**Interfaces:**
- Consumes: `MusclePriorities`/`MuscleTier` from `types.ts` (Task 5), `BUDGET_GROUP_LABELS` from `logic/setBudget.ts`.
- Produces:
  - `logic/musclePriorities.ts`: `export const TIER_GROUPS = ['chest','back','shoulder','biceps','triceps','quad','ham','glute','calf'] as const` (the 9 landmark groups — traps/core excluded, spec "no row, no tier"); `export const TIER_LABELS: Record<MuscleTier, string> = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' }`; `export const EMPHASIZE_CAP = 2`; `export function tierOf(priorities: MusclePriorities | null | undefined, group: string): MuscleTier` (absent/unknown → `'grow'`); `export function setTier(priorities: MusclePriorities, group: string, tier: MuscleTier): MusclePriorities` (returns a NEW sparse map — `'grow'` deletes the key); `export function tierTargetOf(tier: MuscleTier, lm: { mev: number; mav: number; mrv: number }): number` (emphasize→mrv, grow→mav, maintain→mev).
  - `MusclePriorityPicker({ value, onChange }: { value: MusclePriorities; onChange: (next: MusclePriorities) => void })` — one row per `TIER_GROUPS` entry (label from `BUDGET_GROUP_LABELS`), a 3-way segmented control per row (`aria-label={`${label} prioritás`}`, buttons labeled Emphasize/Grow/Maintain with `aria-pressed`), Emphasize options disabled (not hidden) on other rows once `EMPHASIZE_CAP` groups are emphasized. Header copy: **"Mire gyúr ez a blokk?"**, helper line: "Válassz 1–2 hangsúlyt — a többi magától nő, a Maintain szinten tart." Styling: match the app idiom (soft cards, `var(--surface-2)` / `var(--border-subtle)` / muscle family washes via `muscleColor` for the row label chip — copy the visual language of `SetBudgetCard`'s pills and the wizard's split cards).

- [ ] **Step 1: Failing tests.** Logic: `tierOf` default, `setTier` sparseness (`setTier({back:'emphasize'}, 'back', 'grow')` → `{}`), `tierTargetOf` table. Component: renders 9 rows; all default Grow; clicking Emphasize on two rows disables Emphasize on the rest but leaves Grow/Maintain clickable; `onChange` receives the sparse map (never a `'grow'` entry).
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.** **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/features/train/logic/musclePriorities.test.ts src/features/train/components/MusclePriorityPicker.test.tsx`
- [ ] **Step 5: Commit** — `feat(train): MusclePriorityPicker + tier helpers (mezo-3m5m)`

---

### Task 7: Budget card measures against the tier target (GD5)

**Files:**
- Modify: `frontend/src/features/train/logic/setBudget.ts` (add `GROUP_LANDMARKS`; rework `muscleBudgets` + `MuscleBudgetRow`; retire the fatigue-cap budget)
- Modify: `frontend/src/features/train/components/SetBudgetCard.tsx` (pill + expanded-row rendering, over/under warning copy)
- Test: `frontend/src/features/train/logic/setBudget.test.ts`, `frontend/src/features/train/components/SetBudgetCard.test.tsx`

**Interfaces:**
- Consumes: `tierOf`/`tierTargetOf` from Task 6, `MusclePriorities` from Task 5.
- Produces:
  - `export const GROUP_LANDMARKS: Record<string, { mev: number; mav: number; mrv: number }>` — copied VERBATIM from `backend/src/main/resources/application.yml` `mezo.volume.baselines` (chest 8/14/20, back 10/16/22, shoulder 8/12/18, biceps 6/10/14, triceps 6/10/14, quad 8/12/18, ham 6/10/14, glute 8/12/18, calf 6/10/16) with a `// MIRROR of application.yml mezo.volume.baselines (mezo-3m5m)` comment.
  - `muscleBudgets(days: MesoDay[], priorities?: MusclePriorities | null, volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null): MuscleBudgetRow[]` — landmark source: `volumePerMuscle?.[group] ?? GROUP_LANDMARKS[group] ?? null` (AD5).
  - `MuscleBudgetRow` gains `tier: MuscleTier` and `target: number | null`; `budget` becomes `workingSets / target` (counted sets over the tier target; `null` target → `budget: null`). `level`: `'over'` if `workingSets > target`, `'near'` if `budget >= NEAR_THRESHOLD`, `'under'` if `workingSets < mev` (landmark mev), else `'ok'`; no target → `'ok'`. `zoneStart = mev / target`; `setsToZone`/`suggestedDay` keep their semantics against landmark mev.

- [ ] **Step 1: Failing tests.** setBudget: a fixture week with back exercises totaling 14 counted sets → grow: `target 16, budget 0.875, level 'near'`; same days with `{back:'emphasize'}` → `target 22, level 'ok'`; `{back:'maintain'}` → `target 10, level 'over'`; a `traps` exercise → `target null, budget null, level 'ok'`. Card: pill text `Hát · Emphasize · 64%` for non-grow, `Mell 88%` for grow (AD1), `Trapéz · 3 szett` for target-less, `↓` prefix retained for under.
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.**
  - `muscleBudgets`: keep the existing grouping/counting (`countsForVolume`, `budgetGroup`), replace the `budgetOf` computation with the tier-target math above. Keep `SESSION_MUSCLE_CAP` + `sessionCapWarnings` + `daySessionBreakdown` + `leastLoadedDayFor` untouched.
  - Retire the fatigue model: grep consumers of `setStyle`/`SetStyle`/`budgetOf`/`budgetLevel`/`FAILURE_WEEKLY_CAP`/`VOLUME_WEEKLY_CAP` across `frontend/src` FIRST — delete only what nothing else imports (the rep-zone lint may use `setStyle`; if so it stays), and delete their orphaned tests. `GROUP_MEV` is superseded by `GROUP_LANDMARKS` — migrate its consumers (`zoneStart`/under logic here; grep for external importers) and remove it.
  - `SetBudgetCard.tsx`: pill body `{row.label}{row.tier !== 'grow' ? ` · ${TIER_LABELS[row.tier]}` : ''}{row.budget !== null ? ` ${row.level === 'under' ? '↓' : ''}${pct(row.budget)}%` : ` · ${row.workingSets} szett`}` (the `·` separators per the spec's `Hát · Emphasize · 84%`); expanded rows show `N/target szett` and the ZoneTrack scaled so 100% = the tier target with the green zone starting at `zoneStart`; the over-warning copy names the tier target ("Hát: 24 szett — Emphasize plafon 22 (MRV)"-style, reuse the existing sentence frame); footnote updated to name the tier model instead of the failure/volume caps.
- [ ] **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/features/train/logic/setBudget.test.ts src/features/train/components/SetBudgetCard.test.tsx src/features/train/components/MesoEditor.test.tsx` (MesoEditor renders the card — its pinned pill texts may need the same update).
- [ ] **Step 5: Commit** — `feat(train): budget card measures each group against its tier target (mezo-3m5m)`

---

### Task 8: structureLint goes silent for Maintain (R3 frequency, R4 variety)

**Files:**
- Modify: `frontend/src/features/train/logic/structureLint.ts` (signature :90, R3 :184-193, R4 :195-211)
- Test: `frontend/src/features/train/logic/structureLint.test.ts`

**Interfaces:**
- Consumes: `tierOf` from Task 6.
- Produces: `structureLint(days: MesoDay[], priorities?: MusclePriorities | null): StructureFinding[]` — R3 and R4 `continue` when `tierOf(priorities, group) === 'maintain'`; every other rule (R8 included) tier-blind. No-arg behaviour byte-identical (all existing callers/tests unaffected).

- [ ] **Step 1: Failing tests** in the existing `describe('frequency (R3)')` / variety blocks: a fixture that trips R3 for `back` goes silent with `{ back: 'maintain' }` but still fires with `{ back: 'emphasize' }` and with no map; same pair for R4's "1 gyakorlat egész héten" arm; a maintain group still trips R8 (session-length is tier-blind).
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement** — one guard at the top of each of the two loops:

```ts
    if (tierOf(priorities, group) === 'maintain') continue // maintenance: 1 session/week is defensible (GD5)
```

- [ ] **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/features/train/logic/structureLint.test.ts`
- [ ] **Step 5: Commit** — `feat(train): frequency/variety lint silent for Maintain groups (mezo-3m5m)`

---

### Task 9: Peak-week time fit signal (GD6) + MesoEditor threading

**Files:**
- Create: `frontend/src/features/train/logic/peakWeekFit.ts`
- Create: `frontend/src/features/train/components/PeakFitCard.tsx`
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (props :30-38, derivations :56-72, card mounts ~:187-191)
- Test: `frontend/src/features/train/logic/peakWeekFit.test.ts`, `frontend/src/features/train/components/PeakFitCard.test.tsx`, `frontend/src/features/train/components/MesoEditor.test.tsx` (extend)

**Interfaces:**
- Consumes: `estimateSessionMinutes` + `SessionTimeExercise` (`logic/sessionLength.ts`), `SESSION_LENGTH_BAND` (`logic/structureLint.ts`), `budgetGroup`/`countsForVolume`/`GROUP_LANDMARKS` (Task 7), `tierOf`/`tierTargetOf` (Task 6).
- Produces:
  - `export interface PeakDayFit { day: string; minutes: number; direction: 'over' | 'under' }`
  - `export function peakWeekFit(days: MesoDay[], priorities?: MusclePriorities | null, volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null): PeakDayFit[]` — returns ONLY the out-of-band days.
  - `PeakFitCard({ fits }: { fits: PeakDayFit[] })` — renders `null` when empty.
  - `MesoEditorProps` gains `priorities?: MusclePriorities | null` and `volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null`, threaded into `muscleBudgets`, `structureLint`, and `peakWeekFit`; `<PeakFitCard fits={peakFit} />` mounted between the budget card and the lint card. All-optional → every existing parent compiles unchanged.

- [ ] **Step 1: Failing tests.** Deterministic fixture (spec's "deterministic peak-week projection fixture"): 2 days, back-only compounds with known `workingSets`/`repMin`/`repMax`/`warmupSets`, tier `{ back: 'emphasize' }` → hand-compute the projection (below) and the resulting `estimateSessionMinutes`; assert the flagged day + minutes exactly. Second case: all-Grow small plan → `[]`. Third: plyo/`countsTowardVolume:false` exercises keep template sets in the projection. Card: renders `Szo: csúcshéten ~104 perc — vegyél el, vagy tedd át.` for over and `Sze: csúcshéten is csak ~38 perc — férne még bele inger.` for under; `null` when empty.
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement** — the projection is an FE mirror of the backend distributor (`WorkoutService.effectiveWorkingSets`, :380-441): per budget group with landmarks, peak target = `tierTargetOf(tier, lm)`; collect the WEEK's counted exercises of that group across all days; if `target <= count` → every one gets 1 set; else reserve 1 each and distribute `target - count` by largest remainder weighted by template `workingSets` (ties → bigger template `workingSets`, then stable order; `templateSum <= 0` → split evenly). Exercises in groups without landmarks, and non-counted exercises, keep template sets. Then per day `estimateSessionMinutes` over the projected copies; keep days outside `SESSION_LENGTH_BAND`.

```ts
export function peakWeekFit(days, priorities, volumePerMuscle): PeakDayFit[] {
  const projected = new Map<GymExercise, number>() // identity-keyed: ids can repeat across days
  const byGroup = new Map<string, GymExercise[]>()
  for (const d of days) for (const ex of d.exercises) {
    const g = budgetGroup(ex.muscle)
    if (g && countsForVolume(ex)) (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(ex)
  }
  for (const [group, list] of byGroup) {
    const lm = volumePerMuscle?.[group] ?? GROUP_LANDMARKS[group]
    if (!lm) continue
    const target = tierTargetOf(tierOf(priorities, group), lm)
    // >=1 floor + largest-remainder over template workingSets — mirror of WorkoutService.effectiveWorkingSets
    ...
  }
  return days.map((d) => ({ day: d.day, minutes: estimateSessionMinutes(
      d.exercises.map((e) => projected.has(e) ? { ...e, workingSets: projected.get(e)! } : e)) }))
    .filter(...)  // outside SESSION_LENGTH_BAND, tagging direction
}
```

Write the full distributor (no placeholder) following the backend's exact tie-break order. `PeakFitCard` visual: model on `StructureLintCard` (soft grey rows, count pill in the header, never red, never force-opens); title "Csúcshét · időbecslés".

- [ ] **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/features/train/logic/peakWeekFit.test.ts src/features/train/components/PeakFitCard.test.tsx src/features/train/components/MesoEditor.test.tsx`
- [ ] **Step 5: Commit** — `feat(train): peak-week session-time fit signal in the builder (mezo-3m5m)`

---

### Task 10: Wizard Fókusz step

**Files:**
- Modify: `frontend/src/features/train/logic/planner.ts` (`stepLabels` :19)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` (`STEP_COUNT` :37, `PAGE_TITLES` :41-46, state ~:55-78, `canNext` :227-229, step switch :286-327, footer :330-382, `saveTemplate` :191-202, `Step3Program`'s `MesoEditor` mount ~:910)
- Test: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`

**Interfaces:**
- Consumes: `MusclePriorityPicker` (Task 6), Task 9's `MesoEditor` props.
- Produces: 5-step wizard `['Cél', 'Hossz + fázisok', 'Split + napok', 'Fókusz', 'Program']` — the new step at index 3, Program at 4; `saveTemplate` carries `musclePriorities` (sparse map, `null` when empty); the Program step's `MesoEditor` receives `priorities` so the budget/fit cards reflect the choice live.

- [ ] **Step 1: Failing tests.** Extend the wizard save-flow test: walk to the Fókusz step, emphasize `back`, finish, assert `postedTemplate!.musclePriorities` equals `{ back: 'emphasize' }`; a no-touch walk posts `musclePriorities: null`; the step indicator test gains `'4. lépés · Fókusz'`; the existing `'3. lépés · Split + napok'` pin (:341) still passes (index unchanged); any test pinning the Program step as step 4-of-4 moves to 5.
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.**
  - `stepLabels`: insert `'Fókusz'` before `'Program'`; `STEP_COUNT = 5`; `PAGE_TITLES` gains the Fókusz title ("Mire gyúr ez a blokk?").
  - State: `const [priorities, setPriorities] = useState<MusclePriorities>({})`. NOT part of `programSignature` (AD6 — a tier change must not wipe a hand-edited program).
  - New `Step3Focus` sub-component (between `Step2Split` and the renamed program step): intro line + `<MusclePriorityPicker value={priorities} onChange={setPriorities} />`; always passable (`canNext` gains `|| step === 3`, program-gate moves to `step === 4`).
  - Footer branches: `step < 4` advances, `step === 4` saves (rename the literals; grep the file for `step === 3`/`step < 3`).
  - `saveTemplate`: `musclePriorities: Object.keys(priorities).length ? priorities : null,` after `goalPreset`.
  - Program step: `<MesoEditor ... priorities={priorities} />`.
- [ ] **Step 4: Run — PASS:** `cd frontend && pnpm vitest run src/features/train/pages/MesocyclePlannerPage.test.tsx`
- [ ] **Step 5: Commit** — `feat(train): wizard Fókusz step — muscle priority tiers travel with the template (mezo-3m5m)`

---

### Task 11: Tier editing in the template editor + run editor

**Files:**
- Modify: `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx` (`toUpsert` :34-50, `onPersist` type :131-134 + handler :113-116, `TemplateDayEditor` meta block :172-187, `MesoEditor` mount :189)
- Modify: `frontend/src/features/train/components/MesoExercises.tsx` (mount picker + pass props to `MesoEditor` :92)
- Test: `frontend/src/features/train/pages/MesoTemplateEditorPage.test.tsx`, `frontend/src/features/train/components/MesoExercises.test.tsx`

**Interfaces:**
- Consumes: `MusclePriorityPicker` (Task 6), `updateMusclePriorities` mutation (Task 5), Task 9's `MesoEditor` props.
- Produces: template editor persists tier changes through the SAME full-upsert path as the Cél select (live `days`, stale-cache rule); run editor persists through `PUT /muscle-priorities`; both pass `priorities` + `volumePerMuscle` to `MesoEditor`.

- [ ] **Step 1: Failing tests.**
  - Template editor (both modes, the file's `vi.stubEnv` idiom): render with `musclePriorities: { back: 'emphasize' }` → the picker shows back as Emphasize; switch `glute` to Maintain → `updateTemplate` called with `musclePriorities: { back: 'emphasize', glute: 'maintain' }` AND every other field intact (clone the Cél-select test at :97, including its unsaved-day-edit survival assertion — the stale-cache regression).
  - Run editor: render `MesoExercises` with a meso carrying `musclePriorities`; change a tier → assert the PUT was fired (real mode, `server.use` capture) with the new sparse map; assert `MesoEditor` received the map (budget pill shows the tier).
- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.**
  - `MesoTemplateEditorPage`: `toUpsert(template, days, goalPreset = template.goalPreset, musclePriorities = template.musclePriorities)` — add the 4th defaulted param + field; `onPersist(days, goalPreset?, musclePriorities?)`; inside `TemplateDayEditor`, under the meta row, a collapsed `<details>` block titled "Fókusz" containing the picker, `onChange={(next) => onPersist(days, undefined, next)}` — built from the live `days` state per the :121-130 rule. `MesoEditor` mount gains `priorities={template.musclePriorities} volumePerMuscle={template.volumePerMuscle ?? undefined}` — wait: `volumePerMuscle` on templates is `Record<string, VolumeBaseline>` (has `mev/mav/mrv`) so it satisfies the structural type; pass it through.
  - `MesoExercises`: same collapsed "Fókusz" `<details>` above the `MesoEditor`, `value={meso.musclePriorities ?? {}}`, `onChange` → the Task-5 mutation (optimistic UI not required; the hook's cache write refreshes the view). GD7 helper line under the picker: "A módosítás a következő heti görgetésnél lép életbe." `MesoEditor` gains `priorities={meso.musclePriorities} volumePerMuscle={meso.volumePerMuscle ?? undefined}` (run-side `VolumeProfile` also carries `mev/mav/mrv` — structurally fine).
- [ ] **Step 4: Run — PASS (both modes):** `cd frontend && pnpm vitest run src/features/train/pages/MesoTemplateEditorPage.test.tsx src/features/train/components/MesoExercises.test.tsx && VITE_USE_MOCK=true pnpm vitest run src/features/train/pages/MesoTemplateEditorPage.test.tsx src/features/train/components/MesoExercises.test.tsx`
- [ ] **Step 5: Commit** — `feat(train): tier editing in template editor + run editor (mezo-3m5m)`

---

### Task 12: Docs + full gates

**Files:**
- Modify: `docs/features/train.md` (volume engine + meso builder sections: tier model GD4 table, sparse map semantics, the Grow→MAV behaviour change note, budget-card reframe, fit signal, the new endpoint)
- Modify: `docs/CODEMAP.md` (regenerate)

- [ ] **Step 1:** Update `train.md`: extend the goalPreset paragraph's neighbourhood (§4 Tables — `muscle_priorities` columns; the volume-progression section — tier ceilings + the explicit note that Grow's MAV ceiling is an intended change from the old MRV ceiling; the builder section — pills/lint/fit). Search the doc for `MRV` claims that are now tier-dependent and fix each sentence.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs` — all clean.
- [ ] **Step 3:** Backend focused gate (NOT the full suite — CI runs that):
`cd backend && ./mvnw -q -Dmezo.test.use-testcontainers=true -Dtest='MusclePriorities*IT,GoalPreset*IT,MesoTemplate*IT,Volume*,PriorityTierTest,Workout*IT' clean test` — report REAL class/test counts from Surefire.
- [ ] **Step 4:** Frontend gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (ActiveWorkoutPage flake → verify standalone before blaming).
- [ ] **Step 5: Commit** — `docs(train): muscle priority tiers — engine, builder and contract surfaces (mezo-3m5m)`

---

## Notes for the implementer

- **`VolumeDecider.Input` is positional** — both new components go LAST. Same for `StampSource`. One construction site each; grep to be sure.
- **The generated `api.gen.ts` map type is `{[key: string]: string}`**, not the `MuscleTier` union — narrow once at the hydrate boundary (`toMesoTemplate`/`toMesocycle`), everywhere else use the domain type.
- **Do not add tiers to `programSignature`** (wizard) — AD6.
- **`programFit.ts` stays untouched** — its hard frequency/variety legality checks and the `_goalId` param are `mezo-yqpf` territory.
- **Visual regression baselines** (`pnpm test:visual`) WILL diff on the budget pills — baseline regen happens at ship time (darwin locally, linux via the PR bot), not inside a task.
- **Mock-cache clobber** (bd memory): when adding the mock branch of `updateMusclePriorities`, copy an existing mutation's `setQueryData` idiom from the same hook file exactly — do not invent a new cache-write pattern.
- **`MesoVolume.tsx` / `VolumeArcChart.tsx` need no change** — the chart still scales by raw MRV (caption stays factual); only the planned bars' shape changes, server-side.
