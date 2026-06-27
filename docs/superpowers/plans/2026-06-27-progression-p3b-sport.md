# Progression P3b — SPORT path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the SPORT family to the gamified progression engine — generalize the volleyball-shaped `sport_session` into a 3-kind modality (`volleyball|cross|trx`), score each kind into athletic skills (`applySport`), and surface the level-up on the sport-log response — backend-first, both FE modes green.

**Architecture:** Mirror the shipped RUN path exactly. The existing `sport` text column becomes the typed discriminator (a CHECK, no new redundant column) plus a `rounds` effort column for cross/TRX. A `SportSignalCalculator` resolves a saved `sport_session` row into a raw `SportSignal`; `ProgressionService.applySport` builds per-kind athletic XP deltas and reuses the shared, idempotent `award()` tail; `SportService.logSportSession` calls it behind `ProgressionGate` and attaches an optional `levelUp` to `SportSessionResponse`. Two baton refactors ride along: lift the family-agnostic robustness rate out of `properties.gym()` into a shared `mezo.progression.robustness` node, and harden the unused `createdBy` param in `RunSignalCalculator`.

**Tech Stack:** Java 21, Spring Boot 4, Maven, MapStruct, Lombok, Liquibase, PostgreSQL 16 (UUID PKs); OpenAPI contract-first (openapi-merge-cli + openapi-generator + openapi-typescript); React 19 + Vite + Tailwind v4 dual-mode hooks; integration-first tests (Testcontainers/compose Postgres, AssertJ).

**Driving bd:** `mezo-lmox` (child of epic `mezo-8e4`). Spec: `docs/superpowers/specs/2026-06-25-progression-levelup-design.md` §1/§2/§5/§8.

## Global Constraints

Every task's requirements implicitly include this section.

- **Base package** `io.mrkuhne.mezo`; feature packages `feature/{name}/{controller,service,repository,entity,dto,mapper}`, cross-cutting in `techcore/`.
- **Contract-first** (`docs/references/api_contract_conventions.md`): edit `api/feature/train/train.yml` FIRST → `cd api/generate && npm run generate:api` (regen `api/openapi.yml`, commit) → `cd frontend && pnpm generate:api` (regen `src/lib/api.gen.ts`, commit) → backend Java types regenerate on `./mvnw clean test`. Never hand-edit generated artifacts. Schema name == generated class; operationId == controller method; tag == `<Tag>Api`.
- **Liquibase** (`docs/references/liquibase_conventions.md`): new changeset only, NEVER modify released ones; file `script/{12-digit UTC}_mezo-lmox_{desc}.sql` + a `changeSet` in `1.0.0/1.0.0_master.yml` with id `1.0.0:{same-filename-without-.sql}`, author `daniel.kuhne`; **named constraints** (`pk_/fk_/uq_/ck_/idx_`, ≤63 chars); entity annotations mirror DB constraints.
- **Spring** (`docs/references/spring_patterns.md`): constructor injection via `@RequiredArgsConstructor` (never field); `@Transactional` on write methods only, never class-level; controllers implement the generated `<Tag>Api`, no business logic.
- **Config** (`docs/references/configuration_conventions.md`): every tunable under `mezo:` in `application.yml` (kebab-case, commented, default); bound via `@Validated` `*Properties` records with JSR-303; **never `@Value`**; switches as `FeaturesConfiguration` constants consumed by `@ConditionalOnProperty` (no `matchIfMissing`).
- **Tests** (`docs/references/testing_standards.md` + `integration_test_framework.md`): integration-first; extend `AbstractIntegrationTest` (service, `@Transactional`) or `ApiIntegrationTest` (HTTP, no `@Transactional`); **AssertJ only**, no mocks/`@MockBean`/H2; naming `test{Method}_should{Result}_when{Condition}`; test data via `*Populator`; HTTP via verb helpers + `ownerAuthHeaders()`; errors asserted by SystemMessage code. `sport_session` + the three progression tables are ALREADY in `ResetDatabase` (no new table → no TRUNCATE-list change).
- **Discriminator decision (locked):** reuse the existing `sport` column as the typed discriminator (values lowercase `volleyball|cross|trx`, matching the existing data and the `sport_schedule_slot.kind` precedent). Do NOT add a separate `kind` column. Add a `rounds` effort column for cross/TRX.
- **FE scope (locked):** P3b is backend-focused. FE work is limited to regenerating types and keeping **both** modes green + build (`pnpm test`, `VITE_USE_MOCK=true pnpm test`, `pnpm build`). The cross/TRX log-sheet UI and the `LevelUpScreen` that consumes the captured `levelUp` are deferred to P5 (file as `mezo-8e4` children). Do NOT widen `MutateOpts` or wire FE level-up capture here.
- **XP economy (locked, config `mezo.progression.sport`):** `xpPerSet=12`, `xpPerRound=14`, `xpPerMin=4`, `rpeXpPerPoint=6`. Per-kind athletic mapping (spec §1; all ATHLETIC, no MUSCLE):
  - **volleyball** (`setsPlayed`,`rpe`,`durationMin`): `vertical_jump = sets·12`, `agility = sets·12`, `coordination = sets·12`, `explosiveness = rpe·6`, `aerobic_capacity = min·4`.
  - **cross** (`rounds`,`rpe`): `anaerobic_capacity = rounds·14`, `strength_endurance = rounds·14`, `explosiveness = rpe·6`, `core_stability = rpe·6`.
  - **trx** (`rounds`,`rpe`,`durationMin`): `core_stability = rounds·14`, `strength_endurance = rounds·14`, `anaerobic_capacity = rpe·6`, `mobility = min·4`.
  - Volleyball deviates from the spec's "jumpCount" wording: the log path captures `setsPlayed` (not `jumpCount`), so sets is the volleyball volume proxy. `jumpCount` stays in the model for a richer future signal. Document this in the train feature doc.

---

## File Structure

**Contract (1 file + 2 regenerated):**
- `api/feature/train/train.yml` — SOURCE: `SportSessionCreateRequest` (+`sport`,`rounds`; relax required), `SportSessionResponse` (+`rounds`,`levelUp`; relax required).
- `api/openapi.yml`, `frontend/src/lib/api.gen.ts` — regenerated, committed.

**Backend (create):**
- `backend/src/main/resources/db/changelog/1.0.0/script/202606271000_mezo-lmox_generalize_sport_session.sql`
- `backend/src/main/java/io/mrkuhne/mezo/feature/progression/sport/SportSignal.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/progression/sport/SportSignalCalculator.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/progression/sport/SportSignalCalculatorIT.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionSportIT.java`

**Backend (modify):**
- `…/db/changelog/1.0.0/1.0.0_master.yml` — register the new changeset.
- `…/feature/train/entity/SportSessionEntity.java` — `+ rounds`, Javadoc.
- `…/feature/train/repository/SportSessionRepository.java` — `+ findByIdAndCreatedBy`.
- `…/feature/progression/config/ProgressionProperties.java` — `+ Sport`, lift `Robustness` to top level.
- `backend/src/main/resources/application.yml` — `+ mezo.progression.sport`, relocate `robustness`.
- `…/feature/progression/service/ProgressionService.java` — `+ SOURCE_SPORT`, `+ applySport`, `award()` robustness line.
- `…/feature/progression/run/RunSignalCalculator.java` + `RunSessionLogRepository` — harden `createdBy`.
- `…/feature/train/service/SportService.java` — wire progression + sport/rounds from request.
- `…/feature/train/mapper/TrainMapper.java` — `levelUp` ignore on the sport response map (if the build warns/errors).
- `…/feature/train/TrainSeedData.java` — optional cross/TRX demofixtures rows.
- `backend/src/test/.../progression/ProgressionPropertiesIT.java` — sport + lifted robustness binding.
- `backend/src/test/.../feature/train/SportServiceIT.java`, `SportContractIT.java` — generalized persistence + levelUp + relaxed required.
- `backend/src/test/.../support/populator/TrainPopulator.java` — cross/TRX-capable `createSportSession` overload.

**Frontend (modify, green-only):**
- `frontend/src/data/types.ts` — `setsPlayed`,`shoulderStrain` → nullable.
- `frontend/src/data/trainHooks.ts` — `toSportSession` / `deriveSportWeek` null-coalesce.
- `frontend/src/features/train/components/SportSessionCard.tsx`, `…/views/TrainTodayView.tsx` — null-guard display.

**Docs:** `docs/features/train.md` (+ progression sport family), `docs/milestones/roadmap.md`.

---

## Task 1: Contract generalization + regenerate + FE stays green

**Files:**
- Modify: `api/feature/train/train.yml` (`SportSessionCreateRequest`, `SportSessionResponse`)
- Regenerate/commit: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/trainHooks.ts`, `frontend/src/features/train/components/SportSessionCard.tsx`, `frontend/src/features/train/views/TrainTodayView.tsx`

**Interfaces:**
- Produces: `SportSessionCreateRequest` gains optional `sport: string` (pattern `^(volleyball|cross|trx)$`) + `rounds?: integer`; required becomes `[duration, rpe]`. `SportSessionResponse` gains optional `rounds?: integer` + `levelUp?: LevelUpResult`; required drops `setsPlayed`/`shoulderStrain` → `[id, sport, date, time, duration, rpe]`. FE domain `SportSession.setsPlayed`/`shoulderStrain` become `number | null`.

- [ ] **Step 1: Edit the request schema in `api/feature/train/train.yml`.** In `SportSessionCreateRequest`, change `required: [duration, setsPlayed, rpe, shoulderStrain]` to `required: [duration, rpe]`, and add these properties (keep existing `date`/`time`/`duration`/`setsPlayed`/`rpe`/`shoulderStrain`/`notes`):

```yaml
        sport:
          type: string
          pattern: '^(volleyball|cross|trx)$'
          description: Modality discriminator; defaults to volleyball server-side when omitted.
        rounds:
          type: integer
          minimum: 1
          maximum: 50
          description: Completed rounds (cross/TRX effort; null for volleyball).
```

- [ ] **Step 2: Edit the response schema in `api/feature/train/train.yml`.** In `SportSessionResponse`, change `required: [id, sport, date, time, duration, setsPlayed, rpe, shoulderStrain]` to `required: [id, sport, date, time, duration, rpe]`, and add these properties:

```yaml
        rounds:
          type: integer
          description: Completed rounds (cross/TRX; null for volleyball).
        levelUp:
          $ref: '#/components/schemas/LevelUpResult'
```

- [ ] **Step 3: Regenerate the merged contract.**

Run: `cd api/generate && npm run generate:api`
Expected: rewrites `api/openapi.yml`; `git diff --stat api/openapi.yml` shows the sport schema changes.

- [ ] **Step 4: Regenerate the FE types.**

Run: `cd frontend && pnpm generate:api`
Expected: `src/lib/api.gen.ts` — `SportSessionCreateRequest` gains `sport?`/`rounds?`, `setsPlayed?`/`shoulderStrain?` now optional; `SportSessionResponse` gains `rounds?`/`levelUp?`, `setsPlayed?`/`shoulderStrain?` now optional.

- [ ] **Step 5: Verify FE typecheck fails (red) before adapting.**

Run: `cd frontend && pnpm build`
Expected: FAIL in `trainHooks.ts` (`r.setsPlayed`/`r.shoulderStrain` is `number | undefined` not assignable to `number`).

- [ ] **Step 6: Make domain fields nullable in `frontend/src/data/types.ts`.** Change line 591 from:

```ts
  setsPlayed: number; intensity: number | null; rpe: number; shoulderStrain: number
```
to:
```ts
  setsPlayed: number | null; intensity: number | null; rpe: number; shoulderStrain: number | null
```

- [ ] **Step 7: Null-coalesce the mapper + weekly aggregate in `frontend/src/data/trainHooks.ts`.** In `toSportSession` (lines 102–103) change `setsPlayed: r.setsPlayed` → `setsPlayed: r.setsPlayed ?? null` and `shoulderStrain: r.shoulderStrain` → `shoulderStrain: r.shoulderStrain ?? null`. In `deriveSportWeek` (line 175) change the reduce to tolerate null:

```ts
    avgShoulderStrain: round1(inWeek.reduce((a, r) => a + (r.shoulderStrain ?? 0), 0) / inWeek.length),
```

- [ ] **Step 8: Null-guard the card display in `frontend/src/features/train/components/SportSessionCard.tsx`.** Line 39 render `{session.setsPlayed ?? '–'}`. Lines 69–71: guard the value + color so a null shoulderStrain renders safely:

```tsx
          val={session.shoulderStrain ?? '–'}
```
and change the color expression `session.shoulderStrain >= 7 ? …` to `(session.shoulderStrain ?? 0) >= 7 ? …`.

- [ ] **Step 9: Null-guard the today line in `frontend/src/features/train/views/TrainTodayView.tsx:259`.** Change `váll {loggedVb.shoulderStrain}` to `váll {loggedVb.shoulderStrain ?? '–'}`.

- [ ] **Step 10: Verify FE green both modes + build.**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build PASS; both test runs PASS (existing fixtures supply non-null values, so no test assertions change).

- [ ] **Step 11: Verify backend still compiles + tests green (new optional DTO fields unused, request relaxation harmless).**

Run: `cd backend && ./mvnw clean test`
Expected: PASS. Existing `SportServiceIT`/`SportContractIT` still send all fields. (`TrainMapper` leaves `rounds`/`levelUp` unmapped → null; default MapStruct policy warns, does not fail — `RunningMapper.toResponse` is bare and green, proving no global ERROR policy.)

- [ ] **Step 12: Commit.**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/lib/api.gen.ts \
        frontend/src/data/types.ts frontend/src/data/trainHooks.ts \
        frontend/src/features/train/components/SportSessionCard.tsx \
        frontend/src/features/train/views/TrainTodayView.tsx
git commit -m "feat(api): generalize sport-session contract (kind/rounds/levelUp), FE green (mezo-lmox)"
```

---

## Task 2: Liquibase migration — `rounds` column + `sport` CHECK

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606271000_mezo-lmox_generalize_sport_session.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

**Interfaces:**
- Produces: `sport_session.rounds INT` (nullable) and `ck_sport_session_sport CHECK (sport IN ('volleyball','cross','trx'))`.

- [ ] **Step 1: Write the migration SQL** (existing rows are all `'volleyball'`, so the CHECK passes with no backfill):

```sql
-- 202606271000_mezo-lmox_generalize_sport_session.sql
-- Generalize sport_session into a 3-kind modality (volleyball|cross|trx) for the progression
-- SPORT family. Reuse the existing `sport` column as the typed discriminator (add a CHECK); add a
-- `rounds` effort column for cross/TRX. Existing rows are all 'volleyball' → no backfill needed.

ALTER TABLE sport_session
    ADD COLUMN rounds INT;

ALTER TABLE sport_session
    ADD CONSTRAINT ck_sport_session_sport CHECK (sport IN ('volleyball', 'cross', 'trx'));
```

- [ ] **Step 2: Register the changeset in `1.0.0_master.yml`** (append AFTER the `202606261200_mezo-d94_create_medication` entry):

```yaml
  - changeSet:
      id: "1.0.0:202606271000_mezo-lmox_generalize_sport_session"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606271000_mezo-lmox_generalize_sport_session.sql
```

- [ ] **Step 3: Verify the migration applies (context boots, schema updated).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: PASS (Liquibase runs the new changeset on the `mezo_test` DB during context startup; no failure means the DDL applied).

- [ ] **Step 4: Commit.**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202606271000_mezo-lmox_generalize_sport_session.sql \
        backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml
git commit -m "feat(db): sport_session kind CHECK + rounds column (mezo-lmox)"
```

---

## Task 3: Entity `rounds` field + ownership-scoped finder

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/SportSessionEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/SportSessionRepository.java`

**Interfaces:**
- Produces: `SportSessionEntity.getRounds()/setRounds(Integer)`; `SportSessionRepository.findByIdAndCreatedBy(UUID id, UUID createdBy): Optional<SportSessionEntity>`.

- [ ] **Step 1: Add the `rounds` field to `SportSessionEntity`** (after `jumpCount`, before `notes`), and update the class Javadoc to describe the 3-kind discriminator. Keep `sport` as a `String` — the DB CHECK + contract pattern enforce the legal values (consistent with how `intensity`/`shoulderStrain` ranges are DB-enforced, not entity-mirrored):

```java
    @Column
    private Integer rounds; // cross/TRX effort; null for volleyball
```
Javadoc first line → `A logged sport session — volleyball, cross, or TRX (the `sport` column is the modality discriminator, DB CHECK volleyball|cross|trx).`

- [ ] **Step 2: Add the ownership-scoped finder to `SportSessionRepository`:**

```java
    Optional<SportSessionEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
```
(add imports `java.util.Optional`.)

- [ ] **Step 3: Verify backend green** (the new `rounds` now auto-maps in `TrainMapper.toResponse`).

Run: `cd backend && ./mvnw clean test -Dtest=SportServiceIT`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/SportSessionEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/SportSessionRepository.java
git commit -m "feat(train): sport_session rounds field + ownership-scoped finder (mezo-lmox)"
```

---

## Task 4: Config — lift robustness + add `sport` node

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java` (one line)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java`

**Interfaces:**
- Produces: `ProgressionProperties.sport(): Sport` with `xpPerSet/xpPerRound/xpPerMin/rpeXpPerPoint`; `ProgressionProperties.robustness(): Robustness` (top-level); `Gym` no longer carries `robustness`.

- [ ] **Step 1: Update `ProgressionPropertiesIT` first (TDD anchor).** Remove the robustness assertion from `testGymConfig_…` (delete the `gym.robustness()` line), and add two tests:

```java
    @Test
    void testRobustnessConfig_shouldBindFromTopLevel_whenContextStarts() {
        assertThat(properties.robustness().perWeekXp()).isEqualTo(25);
    }

    @Test
    void testSportConfig_shouldBindFromYaml_whenContextStarts() {
        ProgressionProperties.Sport sport = properties.sport();
        assertThat(sport.xpPerSet()).isEqualTo(12);
        assertThat(sport.xpPerRound()).isEqualTo(14);
        assertThat(sport.xpPerMin()).isEqualTo(4);
        assertThat(sport.rpeXpPerPoint()).isEqualTo(6);
    }
```

- [ ] **Step 2: Run it to confirm it fails to compile (red).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: FAIL — `properties.sport()`/`properties.robustness()` do not resolve.

- [ ] **Step 3: Refactor `ProgressionProperties`.** Change the top record to add `sport` + a top-level `robustness`, and remove `robustness` from `Gym`:

```java
public record ProgressionProperties(
    @NotNull @Valid Curve curve,
    @NotNull @Valid Gym gym,
    @NotNull @Valid Run run,
    @NotNull @Valid Sport sport,
    @NotNull @Valid Robustness robustness
) {
```
Remove `@NotNull @Valid Robustness robustness` (and its trailing comma) from the `Gym` record. Add the `Sport` record (next to `Run`):

```java
    /** Sport-path XP weights (athletic only; per-kind mapping in ProgressionService.applySport). */
    public record Sport(
        @NotNull @PositiveOrZero Integer xpPerSet,       // 12 (volleyball volume)
        @NotNull @PositiveOrZero Integer xpPerRound,     // 14 (cross/TRX volume)
        @NotNull @PositiveOrZero Integer xpPerMin,       // 4 (duration → aerobic/mobility)
        @NotNull @PositiveOrZero Integer rpeXpPerPoint   // 6 (RPE → explosiveness/effort)
    ) {}
```
(`Robustness` record stays as-is, now referenced from the top level.)

- [ ] **Step 4: Relocate robustness + add the sport block in `application.yml`.** Move the `robustness:` key out from under `gym:` to directly under `progression:` (above `gym:`), and add a `sport:` block under `run:`:

```yaml
  progression:
    curve:
      base: 100
      exp: 1.6
    # Streak robustness — family-agnostic (gym/run/sport all feed the training-week streak).
    robustness:
      per-week-xp: 25
    gym:
      volume-unit: 100
      volume-xp-per-unit: 10
      e1rm-xp-per-kg: 2
      pr-bonus-xp: 40
      strength-endurance-xp-per-set: 8
      bodyweight-xp-per-rep: 1
    run:
      sprint-xp-per-round: 25
      anaerobic-xp-per-round: 15
      steady-xp-per-min: 4
      aerobic-xp-per-min: 5
      rpe-xp-per-point: 6
      hr-recovery-bonus-xp: 30
    sport:
      # Sport-path XP weights (athletic only; per-kind skill mapping in applySport).
      xp-per-set: 12          # volleyball volume → vertical_jump/agility/coordination
      xp-per-round: 14        # cross/TRX volume → anaerobic_capacity/strength_endurance/core_stability
      xp-per-min: 4           # duration → aerobic_capacity (volleyball) / mobility (TRX)
      rpe-xp-per-point: 6     # RPE → explosiveness / effort skills
```
(Delete the old `robustness:` lines nested under `gym:`.)

- [ ] **Step 5: Update the robustness read in `ProgressionService.award` (line ~157):**

```java
        long robustnessTarget = (long) streak * properties.robustness().perWeekXp();
```

- [ ] **Step 6: Run the properties IT + the full progression suite (robustness value unchanged at 25, just relocated).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT,ProgressionServiceIT,ProgressionRunIT`
Expected: PASS (existing gym/run ITs fold robustness via `result.robustness().xpGained()`, so the relocation is value-neutral).

- [ ] **Step 7: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java \
        backend/src/main/resources/application.yml \
        backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java
git commit -m "refactor(progression): lift robustness to shared node + add sport config (mezo-lmox)"
```

---

## Task 5: `SportSignal` + `SportSignalCalculator`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/sport/SportSignal.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/sport/SportSignalCalculator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java` (cross/TRX overload)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/sport/SportSignalCalculatorIT.java`

**Interfaces:**
- Produces: `record SportSignal(UUID sessionId, String kind, Integer durationMin, Integer setsPlayed, Integer rounds, Integer rpe)`; `SportSignalCalculator.compute(UUID createdBy, UUID sessionId): SportSignal` (ownership-scoped; rounds BigDecimal rpe → HALF_UP Integer).
- Consumes: `SportSessionRepository.findByIdAndCreatedBy` (Task 3).

- [ ] **Step 1: Add a cross/TRX-capable overload to `TrainPopulator`** (keep the existing `createSportSession(createdBy, date)` volleyball factory):

```java
    public SportSessionEntity createSportSession(UUID createdBy, LocalDate date, String sport,
        Integer setsPlayed, Integer rounds, String rpe) {
        SportSessionEntity s = new SportSessionEntity();
        s.setCreatedBy(createdBy);
        s.setSport(sport);
        s.setDate(date);
        s.setTime("18:00");
        s.setDurationMin(60);
        s.setSetsPlayed(setsPlayed);
        s.setRounds(rounds);
        s.setRpe(new java.math.BigDecimal(rpe));
        return sportSessionRepository.saveAndFlush(s);
    }
```

- [ ] **Step 2: Write the failing calculator IT** (`SportSignalCalculatorIT`, service-level, `@Transactional`, extends `AbstractIntegrationTest`):

```java
package io.mrkuhne.mezo.feature.progression.sport;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class SportSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private SportSignalCalculator calculator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCompute_shouldResolveCrossMetricsAndRoundRpe_whenCrossSession() {
        UUID user = databasePopulator.populateUser("sigcross@test.local");
        SportSessionEntity s = trainPopulator.createSportSession(user, LocalDate.parse("2026-06-20"),
            "cross", null, 8, "7.6");

        SportSignal signal = calculator.compute(user, s.getId());

        assertThat(signal.kind()).isEqualTo("cross");
        assertThat(signal.rounds()).isEqualTo(8);
        assertThat(signal.setsPlayed()).isNull();
        assertThat(signal.rpe()).isEqualTo(8); // 7.6 rounds HALF_UP to 8
        assertThat(signal.durationMin()).isEqualTo(60);
        assertThat(signal.sessionId()).isEqualTo(s.getId());
    }

    @Test
    void testCompute_shouldScopeByOwner_whenSessionBelongsToAnotherUser() {
        UUID owner = databasePopulator.populateUser("sigown@test.local");
        UUID other = databasePopulator.populateUser("sigother@test.local");
        SportSessionEntity s = trainPopulator.createSportSession(owner, LocalDate.parse("2026-06-20"),
            "volleyball", 5, null, "7");

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> calculator.compute(other, s.getId()))
            .isInstanceOf(RuntimeException.class);
    }
}
```

- [ ] **Step 3: Run to confirm it fails (no calculator).**

Run: `cd backend && ./mvnw clean test -Dtest=SportSignalCalculatorIT`
Expected: FAIL — `SportSignal`/`SportSignalCalculator` do not exist.

- [ ] **Step 4: Create `SportSignal`:**

```java
package io.mrkuhne.mezo.feature.progression.sport;

import java.util.UUID;

/** Raw sport metrics resolved from a saved sport_session row; XP math lives in ProgressionService. */
public record SportSignal(
    UUID sessionId, String kind, Integer durationMin, Integer setsPlayed, Integer rounds, Integer rpe) {}
```

- [ ] **Step 5: Create `SportSignalCalculator`** (ownership-scoped load genuinely uses `createdBy`; BigDecimal RPE → HALF_UP Integer):

```java
package io.mrkuhne.mezo.feature.progression.sport;

import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Resolves a just-saved sport_session into a SportSignal (raw metrics only). */
@Component
@RequiredArgsConstructor
public class SportSignalCalculator {

    private final SportSessionRepository sportSessionRepository;

    public SportSignal compute(UUID createdBy, UUID sessionId) {
        SportSessionEntity s = sportSessionRepository.findByIdAndCreatedBy(sessionId, createdBy)
            .orElseThrow(() -> new IllegalStateException(
                "sport_session not found for owner: " + sessionId));
        Integer rpe = s.getRpe() == null ? null
            : s.getRpe().setScale(0, RoundingMode.HALF_UP).intValue();
        return new SportSignal(s.getId(), s.getSport(), s.getDurationMin(),
            s.getSetsPlayed(), s.getRounds(), rpe);
    }
}
```

- [ ] **Step 6: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=SportSignalCalculatorIT`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/sport/ \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/sport/SportSignalCalculatorIT.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java
git commit -m "feat(progression): SportSignal + ownership-scoped SportSignalCalculator (mezo-lmox)"
```

---

## Task 6: `ProgressionService.applySport` (SPORT XP family)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionSportIT.java`

**Interfaces:**
- Produces: `ProgressionService.applySport(UUID createdBy, SportSignal signal): LevelUpResult` (idempotent on `signal.sessionId()` via `award(…, SOURCE_SPORT, …)`).
- Consumes: `SportSignal` (Task 5), `properties.sport()` (Task 4), the shared `award()`/`addAthletic()` tail.

- [ ] **Step 1: Write the failing `ProgressionSportIT`** (mirror `ProgressionRunIT`: construct the signal directly, fold robustness into totalXp). Uses the locked economy:

```java
package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.sport.SportSignal;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionSportIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplySport_shouldGrantVolleyballSkills_whenVolleyballSession() {
        UUID user = databasePopulator.populateUser("vb@test.local");
        // volleyball sets=5,rpe=7,min=90 → jump/agility/coord 5*12=60; explosiveness 7*6=42; aerobic 90*4=360
        SportSignal signal = new SportSignal(UUID.randomUUID(), "volleyball", 90, 5, null, 7);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.source()).isEqualTo("SPORT");
        assertThat(result.workoutLabel()).isEqualTo("Röplabda");
        assertSkill(user, "vertical_jump", 60L);
        assertSkill(user, "agility", 60L);
        assertSkill(user, "coordination", 60L);
        assertSkill(user, "explosiveness", 42L);
        assertSkill(user, "aerobic_capacity", 360L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed")).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength")).isEmpty();
    }

    @Test
    void testApplySport_shouldGrantCrossSkills_whenCrossSession() {
        UUID user = databasePopulator.populateUser("cross@test.local");
        // cross rounds=8,rpe=8 → anaerobic/strength_end 8*14=112; explosiveness/core 8*6=48
        SportSignal signal = new SportSignal(UUID.randomUUID(), "cross", 45, null, 8, 8);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.workoutLabel()).isEqualTo("Cross training");
        assertSkill(user, "anaerobic_capacity", 112L);
        assertSkill(user, "strength_endurance", 112L);
        assertSkill(user, "explosiveness", 48L);
        assertSkill(user, "core_stability", 48L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "vertical_jump")).isEmpty();
    }

    @Test
    void testApplySport_shouldGrantTrxSkills_whenTrxSession() {
        UUID user = databasePopulator.populateUser("trx@test.local");
        // trx rounds=6,rpe=7,min=40 → core/strength_end 6*14=84; anaerobic 7*6=42; mobility 40*4=160
        SportSignal signal = new SportSignal(UUID.randomUUID(), "trx", 40, null, 6, 7);

        LevelUpResult result = progressionService.applySport(user, signal);

        assertThat(result.workoutLabel()).isEqualTo("TRX köredzés");
        assertSkill(user, "core_stability", 84L);
        assertSkill(user, "strength_endurance", 84L);
        assertSkill(user, "anaerobic_capacity", 42L);
        assertSkill(user, "mobility", 160L);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "vertical_jump")).isEmpty();
    }

    @Test
    void testApplySport_shouldBeIdempotent_whenSameSessionAppliedTwice() {
        UUID user = databasePopulator.populateUser("sportidem@test.local");
        UUID sessionId = UUID.randomUUID();
        SportSignal signal = new SportSignal(sessionId, "volleyball", 90, 5, null, 7);

        LevelUpResult first = progressionService.applySport(user, signal);
        LevelUpResult second = progressionService.applySport(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp());
        assertSkill(user, "vertical_jump", 60L); // counted once
    }

    private void assertSkill(UUID user, String key, long expected) {
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, key))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(expected));
    }
}
```

- [ ] **Step 2: Run to confirm it fails (no applySport).**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionSportIT`
Expected: FAIL — `applySport` does not resolve.

- [ ] **Step 3: Implement `applySport` in `ProgressionService`.** Add the constant next to `SOURCE_RUN`:

```java
    private static final String SOURCE_SPORT = "SPORT";
```
Add the import `io.mrkuhne.mezo.feature.progression.sport.SportSignal;` and the method (after `applyRun`, before `addAthletic`):

```java
    @Transactional
    public LevelUpResult applySport(UUID createdBy, SportSignal signal) {
        ProgressionProperties.Sport sp = properties.sport();
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        int min = signal.durationMin() != null ? signal.durationMin() : 0;
        int rpe = signal.rpe() != null ? signal.rpe() : 0;
        int sets = signal.setsPlayed() != null ? signal.setsPlayed() : 0;
        int rounds = signal.rounds() != null ? signal.rounds() : 0;

        String label;
        switch (signal.kind() != null ? signal.kind() : "volleyball") {
            case "cross" -> {
                label = "Cross training";
                addAthletic(deltas, kinds, "anaerobic_capacity", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "strength_endurance", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "explosiveness", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "core_stability", (long) rpe * sp.rpeXpPerPoint());
            }
            case "trx" -> {
                label = "TRX köredzés";
                addAthletic(deltas, kinds, "core_stability", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "strength_endurance", (long) rounds * sp.xpPerRound());
                addAthletic(deltas, kinds, "anaerobic_capacity", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "mobility", (long) min * sp.xpPerMin());
            }
            default -> { // volleyball
                label = "Röplabda";
                addAthletic(deltas, kinds, "vertical_jump", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "agility", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "coordination", (long) sets * sp.xpPerSet());
                addAthletic(deltas, kinds, "explosiveness", (long) rpe * sp.rpeXpPerPoint());
                addAthletic(deltas, kinds, "aerobic_capacity", (long) min * sp.xpPerMin());
            }
        }

        return award(createdBy, SOURCE_SPORT, signal.sessionId(), deltas, kinds,
            label, signal.durationMin(), signal.rpe());
    }
```

- [ ] **Step 4: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionSportIT`
Expected: PASS (all four tests).

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionSportIT.java
git commit -m "feat(progression): applySport XP family for volleyball/cross/trx (mezo-lmox)"
```

---

## Task 7: Wire `SportService.logSportSession` → `applySport` + levelUp

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (only if the build flags the unmapped `levelUp`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/SportServiceIT.java`

**Interfaces:**
- Consumes: `SportSignalCalculator` (T5), `ProgressionService.applySport` (T6), `LevelUpResultMapper`, `ObjectProvider<ProgressionGate>` — exactly as `RunningService.logSession` does.
- Produces: `logSportSession` persists `sport` (default volleyball) + `rounds` from the request, and sets `response.levelUp` when the gate is present.

- [ ] **Step 1: Extend `SportServiceIT` with the new behaviors** (the progression switch is `true` in `application.yml`, so the gate bean is present in tests):

```java
    @Test
    void testLogSportSession_shouldReturnVolleyballLevelUp_whenProgressionEnabled() {
        UUID owner = databasePopulator.populateUser("sportlvl@test.local");
        SportSessionCreateRequest req = SportSessionCreateRequest.builder()
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6).build();

        SportSessionResponse res = sportService.logSportSession(owner, req);

        assertThat(res.getLevelUp()).isNotNull();
        assertThat(res.getLevelUp().getSource()).isEqualTo(LevelUpResult.SourceEnum.SPORT);
        assertThat(res.getSport()).isEqualTo("volleyball");
    }

    @Test
    void testLogSportSession_shouldPersistCrossKindAndRounds_whenCrossSession() {
        UUID owner = databasePopulator.populateUser("sportcross@test.local");
        SportSessionCreateRequest req = SportSessionCreateRequest.builder()
            .sport("cross").duration(45).rounds(8).rpe(new BigDecimal("8")).build();

        SportSessionResponse res = sportService.logSportSession(owner, req);

        assertThat(res.getSport()).isEqualTo("cross");
        assertThat(res.getRounds()).isEqualTo(8);
        assertThat(res.getSetsPlayed()).isNull();
        assertThat(res.getLevelUp()).isNotNull();
    }
```
Add the autowire `@Autowired private SportService sportService;` if not present and the imports for `LevelUpResult` (the generated `io.mrkuhne.mezo.api.dto.LevelUpResult`).

- [ ] **Step 2: Run to confirm failure (no levelUp / no sport/rounds wiring).**

Run: `cd backend && ./mvnw clean test -Dtest=SportServiceIT`
Expected: FAIL — `getLevelUp()` null / `getSport()` is `volleyball` not `cross` / `getRounds()` null.

- [ ] **Step 3: Wire `SportService`.** Add the four progression collaborators to the constructor deps and update `logSportSession` to set `sport`/`rounds` and attach the level-up (mirror `RunningService.logSession`):

```java
    private final SportSignalCalculator sportSignalCalculator;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
```
In `logSportSession`, set the discriminator + rounds before save and capture the level-up after:

```java
        s.setSport(req.getSport() != null ? req.getSport() : "volleyball");
        s.setRounds(req.getRounds());
        // … existing field copies (date/time/duration/setsPlayed/rpe/shoulderStrain/notes) …
        SportSessionResponse base = mapper.toResponse(sportSessionRepository.save(s));
        if (progressionGate.getIfAvailable() != null) {
            SportSignal signal = sportSignalCalculator.compute(createdBy, s.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applySport(createdBy, signal)));
        }
        return base;
```
Add imports: `io.mrkuhne.mezo.feature.progression.ProgressionGate`, `io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper`, `io.mrkuhne.mezo.feature.progression.service.ProgressionService`, `io.mrkuhne.mezo.feature.progression.sport.SportSignal`, `io.mrkuhne.mezo.feature.progression.sport.SportSignalCalculator`, `org.springframework.beans.factory.ObjectProvider`. Remove the obsolete "single-sport scope in Phase 2" comment.

- [ ] **Step 4: If `./mvnw clean test` reports a MapStruct unmapped-target ERROR for `levelUp`,** add to `TrainMapper.toResponse(SportSessionEntity)`:

```java
    @Mapping(target = "levelUp", ignore = true)
```
(Expected NOT needed — `RunningMapper.toResponse` is bare and green — but include if the build flags it.)

- [ ] **Step 5: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=SportServiceIT`
Expected: PASS (new + existing volleyball-default tests).

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/train/SportServiceIT.java
git commit -m "feat(train): wire sport-log → applySport + levelUp on response (mezo-lmox)"
```

---

## Task 8: HTTP contract IT — kind/rounds/relaxed-required/levelUp/400

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/SportContractIT.java`

**Interfaces:**
- Consumes: the generalized contract (T1) + wired service (T7), via `ApiIntegrationTest` verb helpers + `ownerAuthHeaders()`.

- [ ] **Step 1: Add HTTP-level tests** (cross session without setsPlayed/shoulderStrain now succeeds; levelUp present; invalid `sport` → 400 via the pattern):

```java
    @Test
    void testLogSportSession_shouldAcceptCrossWithoutVolleyballFields_whenKindCross() {
        String body = """
            { "sport": "cross", "duration": 45, "rounds": 8, "rpe": 8 }""";
        SportSessionResponse res = postForBody("/api/train/sport-sessions", body,
            ownerAuthHeaders(), HttpStatus.CREATED, SportSessionResponse.class);
        assertThat(res.getSport()).isEqualTo("cross");
        assertThat(res.getRounds()).isEqualTo(8);
        assertThat(res.getLevelUp()).isNotNull();
    }

    @Test
    void testLogSportSession_shouldReturn400_whenSportNotAllowed() {
        String body = """
            { "sport": "tennis", "duration": 45, "rpe": 7 }""";
        String err = postForBody("/api/train/sport-sessions", body, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(err, "sport", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testLogSportSession_shouldReturn401_whenNoToken() {
        String body = """
            { "duration": 90, "rpe": 7 }""";
        postForBody("/api/train/sport-sessions", body, null, HttpStatus.UNAUTHORIZED, Void.class);
    }
```
(Confirm the exact pattern-violation code via the existing `assertHas*Error` precedent; if the project maps `pattern` failures to a different SystemMessage code, use that code — keep the assertion code-based, never string-matched.)

- [ ] **Step 2: Run to confirm green.**

Run: `cd backend && ./mvnw clean test -Dtest=SportContractIT`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/train/SportContractIT.java
git commit -m "test(train): sport-log HTTP contract — cross/relaxed-required/levelUp/400 (mezo-lmox)"
```

---

## Task 9: Harden `RunSignalCalculator` unused `createdBy` (baton cleanup)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/run/RunSignalCalculator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java` (ownership finder if absent)

**Interfaces:**
- `RunSignalCalculator.compute(UUID createdBy, UUID runLogId)` signature is UNCHANGED (callers untouched); internally `createdBy` now scopes the log load, and the dead `createdBy` param is removed from the private `resolveKind`.

- [ ] **Step 1: Add an ownership-scoped finder to `RunSessionLogRepository`** (if it lacks one):

```java
    Optional<RunSessionLogEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
```

- [ ] **Step 2: Use `createdBy` in `compute` and drop it from `resolveKind`.** Change the log load to `runSessionLogRepository.findByIdAndCreatedBy(runLogId, createdBy).orElseThrow(...)`, and change `resolveKind(createdBy, blockId, sessionKey)` to `resolveKind(blockId, sessionKey)` (remove the unused first param from both the call and the private method signature).

- [ ] **Step 3: Run the run suite to confirm no behavior change.**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionRunIT,RunningServiceIT`
Expected: PASS (the calculator resolves the same kind; ownership scoping is additive for the single-user model).

- [ ] **Step 4: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/run/RunSignalCalculator.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java
git commit -m "refactor(progression): harden unused createdBy in RunSignalCalculator (mezo-lmox)"
```

---

## Task 10: Demofixtures + docs + roadmap + full gates + bd close

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java` (optional cross/TRX rows)
- Modify: `docs/features/train.md` (sport SPORT family + generalization), `docs/milestones/roadmap.md`

- [ ] **Step 1 (optional demo): add a cross + a TRX demofixtures row.** Extend the private `sport(...)` helper with a `kind`/`rounds` overload (or add params with `volleyball`/`null` defaults at existing call sites) and append in `seedSportSessions`:

```java
        sportKind(by, "2026-05-22", "07:00", 45, "cross", 8, "7.6", "Cross · 8 kör");
        sportKind(by, "2026-05-19", "07:00", 40, "trx", 6, "7.0", "TRX · core nap");
```
where `sportKind(by, date, time, durationMin, sport, rounds, rpe, notes)` sets `s.setSport(sport)` + `s.setRounds(rounds)` (volleyball-specific fields null). Keep the existing volleyball rows unchanged.

- [ ] **Step 2: Update `docs/features/train.md`.** In §1/§4/§10 (or the existing structure) document: sport-session is now a 3-kind modality (`sport` = `volleyball|cross|trx` discriminator + `rounds`); `logSportSession` feeds `ProgressionService.applySport` behind `ProgressionGate` and returns an optional `levelUp`; the per-kind athletic XP mapping table (from Global Constraints) and the deliberate setsPlayed-vs-jumpCount volleyball proxy note; the robustness rate now lives at `mezo.progression.robustness` (family-agnostic).

- [ ] **Step 3: Update `docs/milestones/roadmap.md`.** Add a milestone-log row dated 2026-06-27: "Progression **P3b — SPORT path** (`mezo-lmox`) shipped: `sport_session` generalized to 3 kinds + `rounds`, `applySport` athletic XP, levelUp on the sport-log response, robustness lifted to a shared node, RunSignalCalculator createdBy hardened. Backend + dual-mode FE green." Update the Slice C / progression line if it references P3 status.

- [ ] **Step 4: Clear the feature-doc staleness flag.**

Run: `node scripts/lint-docs.mjs`
Expected: no errors; `train.md` no longer flagged stale.

- [ ] **Step 5: Full backend gate.**

Run: `cd backend && ./mvnw clean test`
Expected: PASS (full suite).

- [ ] **Step 6: Full frontend gate (both modes + build).**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: all PASS.

- [ ] **Step 7: Commit + update bd.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java docs/
git commit -m "docs(progression): P3b SPORT path — train feature doc + roadmap + demofixtures (mezo-lmox)"
bd close mezo-lmox "P3b SPORT path shipped: sport_session generalized + applySport + levelUp wiring + robustness lift + RunSignalCalculator hardening; backend + dual-mode FE green"
```

- [ ] **Step 8: File the deferred P5 FE follow-up as a `mezo-8e4` child** (so the captured `levelUp` isn't orphaned):

```bash
bd create "Progression P5 — FE: capture sport/run levelUp + LevelUpScreen overlay" -t feature -p 2 \
  --description="Mirror saveRunningBlock response-capture: widen sport/run log mutations to forward the response, present LevelUpScreen (full-bleed portal, reduced-motion). Defer from P3b (mezo-lmox)."
```

---

## Self-Review (against the spec + map)

**Spec coverage:** §1 skill taxonomy/mapping → Task 6 economy (locked). §2 XP/signals → Tasks 5–6 (signal + applySport; idempotent via shared `award()`). §3 backend (no new table; SPORT source CHECK + idempotency uq already exist from P1) → Tasks 2–7. §5 `LevelUpResult` payload (source already `SPORT`) → reused unchanged. §8 P3 sport generalization + new completion flow → Tasks 1–8; run signals were P3a (shipped). Baton refactors → Tasks 4 (lift robustness) + 9 (harden createdBy). FE green → Task 1 + Task 10. P5/P6 FE screens → explicitly deferred (Task 10 Step 8).

**Type consistency:** `SportSignal(sessionId, kind, durationMin, setsPlayed, rounds, rpe)` is produced in Task 5 and consumed verbatim in Task 6. `applySport(UUID, SportSignal): LevelUpResult` produced in Task 6, consumed in Task 7. `findByIdAndCreatedBy` produced in Task 3, consumed in Task 5. `properties.sport()`/`properties.robustness()` produced in Task 4, consumed in Tasks 5–6 + `award()`. Generated `SportSessionResponse.getLevelUp()/getRounds()` produced in Task 1, asserted in Tasks 7–8.

**Placeholder scan:** every code step shows full code; every run step shows the command + expected result. The only conditional is Task 7 Step 4 (MapStruct ignore) — gated on a build signal, with the expected outcome (not needed) stated.

**Known deviations (documented):** volleyball scores from `setsPlayed` not `jumpCount` (log-path reality); FE level-up *capture* deferred to P5 (P3b only surfaces it on the response). Both recorded in the train feature doc (Task 10).
