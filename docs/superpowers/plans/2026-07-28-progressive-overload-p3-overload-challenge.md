# Progressive Overload — Plan 3: lightweight daily overload-challenge tie-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add ONE deterministic `overload` workout-challenge per day, derived from the day's biggest recommended weight/rep jump, fed into the existing proactive-challenge accept/decide + outcome-evaluation flow.

**Architecture:** A new `OverloadChallengeGenerator` (feature.proactive) reads the already-computed per-exercise `ProgressionSignal` from `WorkoutService.getToday`, picks the exercise with the largest recommended `+kg` (else largest meaningful `+rep`), and persists ONE `type='overload'` `ChallengeEntity` — appended (guaranteed +1) alongside the LLM `ChallengeGenerator` in `ProactiveChallengeService.getChallenges`. The `overload` type is a new value on the existing `challenge` table's `ck_challenge_type` CHECK; its outcome evaluation and display reuse the existing PR branch verbatim. The whole thing is deterministic (no LLM), so it is honest/grounded. FE renders it through the unchanged `ChallengesCarousel`/`ChallengeCard` (only the `ChallengeType` union gains `'overload'`).

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · Postgres/Liquibase · OpenAPI contract-first · React 19 + Vite + Tailwind v4 · Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-25-progressive-overload-design.md`](../specs/2026-07-25-progressive-overload-design.md) §5.2/§7#3/§8/§9, decision **D11** (lightweight tie-in) + **D13** (mock parity). Builds on Plan 1 (`ProgressionSignal`, shipped v0.124.0) + Plan 2 (volume engine + arc, shipped v0.130.0) + the workout-challenges feature (`mezo-hbwi`, `docs/superpowers/specs/2026-07-07-workout-challenges-design.md`).

## Global Constraints

- **bd:** `mezo-gj42`. **Base package** `io.mrkuhne.mezo`. **PKs** UUID. **Build** Maven, always `./mvnw clean …`.
- **Feature gate:** the whole challenge feature (and thus this) is gated by the existing pair `@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue="true")`. The new `OverloadChallengeGenerator` carries the SAME annotation (mirror `ChallengeGenerator`/`ChallengeOutcomeEvaluator`). No new switch.
- **Contract-first BUT no schema change here:** `ChallengeResponse.type` is a **free-form `string`** in `api/feature/proactive/proactive.yml` (a prose `description`, NOT an OpenAPI `enum:`), and the target fields (`targetWeightKg`/`targetReps`) already exist. So the wire shape is unchanged — the only contract edit is updating the `type` **description prose** for accuracy (no `generate:api` needed). The FE `ChallengeType` TS union is a separate hand-written literal union that DOES gain `'overload'`.
- **Backend tests:** integration-first (`@SpringBootTest`, real Postgres, AssertJ, no mocks/H2), pure logic as plain JUnit. Focused ITs locally (`docker compose up -d` for the fixed `mezo_test` DB, or `-Dmezo.test.use-testcontainers=true`); **this 16 GB machine OOMs on the full backend IT suite — CI is the authoritative full-suite gate**, and if a focused IT OOMs, compile-verify (`./mvnw -q clean test-compile`) + defer to CI, reporting DONE_WITH_CONCERNS (never fake a pass).
- **Liquibase:** new versioned changeset `{YYYYMMDDHHMM}_mezo-gj42_{desc}.sql`, 12-digit UTC prefix, **never modify a released changeset**, explicit constraint names, registered in the changelog the same way `202607072100_mezo-hbwi_create_challenge.sql` is. No new table (extend the existing CHECK). No `ResetDatabase`/populator TRUNCATE change (no new table).
- **Frontend:** hooks only from `@/data/hooks`; deep absolute `@/*` imports; tests colocated; **both modes green** — `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Commits:** conventional, carrying the bd id, e.g. `feat(train): … (mezo-gj42)`. **The beads pre-commit hook force-stages a gitignored root `issues.jsonl`** — every commit uses explicit `git add <paths>` + `git restore --staged issues.jsonl .beads/issues.jsonl` if present, and `git commit --no-verify`; NEVER `git add -A`.
- **HU copy:** all user-facing strings Hungarian.
- **Branch:** cut fresh off `origin/main` (currently v0.139.x) as `feat/progressive-overload-p3`. This is a single PR (one phase).

## Decisions

| # | Decision | Choice |
|---|---|---|
| **DC1** | Priority vs. cap | **Guaranteed +1 slot** (user-approved). The deterministic overload challenge is generated INDEPENDENTLY of the LLM `mezo.proactive.challenge.max-per-workout` cap and always appended when a jump exists. Total per day = up to `max-per-workout` LLM + 1 overload. |
| **DC2** | Biggest-jump selection | Among today's exercises: the largest `progression.deltaKg` with `lever==WEIGHT` and `deltaKg > 0`; if none, the largest `progression.deltaReps` with `lever==REP` and `deltaReps >= 1`; if neither → **no challenge** (honest). Deload weeks resolve to `DELOAD`/`HOLD` levers only → automatically none. |
| **DC3** | Progression source | The generator reads the already-computed per-exercise `ProgressionSignal` from `workoutService.getToday(userId, templateSessionId)` — **no duplication** of the deload/effective-set/intensity logic (which would drift). `getToday` is the shipped idempotent lazy-settle entry point (autoClose/rollover/closingBlock all no-op if already done), so a second call inside a challenge read is safe. Bail if `getToday`'s resolved `templateSessionId` ≠ the requested one (open-instance day-resolution mismatch). |
| **DC4** | Outcome evaluation | **PR mirror.** hit ⇔ ∃ logged working set with `weightKg ≥ targetWeightKg AND reps ≥ targetReps`; inconclusive when no logged sets; via the existing accepted-only + completion-gated `ChallengeOutcomeEvaluator`. Fold `TYPE_OVERLOAD` into the existing `TYPE_PR` `case` in both the hit-switch and `describe()`. |
| **DC5** | Discriminator | No `source` column. The `type='overload'` value IS the discriminator. New Liquibase changeset extends `ck_challenge_type` to include `'overload'`; new `ChallengeEntity.TYPE_OVERLOAD` constant. |
| **DC6** | Display | `ChallengeDisplay.typeLabel(overload)` → `"⚡ Túlterhelés"` (Plan-1 vocabulary); `target(overload)` reuses the PR `"{kg} kg × {reps}"` branch. |
| **DC7** | Contract & FE type | `type` is a free-string (no OpenAPI enum) → only the description prose updates, **no regen**. FE `ChallengeType` union gains `'overload'` (the sole FE type edit; `toChallenge`, `ChallengeCard`, `ChallengesCarousel`, hooks are all type-agnostic). |
| **DC8** | Confidence | `confidence = null` (deterministic → no *learned* confidence). Renders the existing "tanulom" chip — a known minor cosmetic (grounded ≠ learning); a later follow-up may relabel/suppress it for `overload`. **No FE type-branching added** (keeps `ChallengeCard` type-agnostic). |
| **DC9** | Mock parity (D13) | One `overload` challenge added to the `mockWorkout.challenges` fixture (`train.ts`); `generate`/`decide` already no-op in mock. Both FE modes byte-identical. |

## File Structure

- `backend/src/main/resources/db/changelog/1.0.0/script/{ts}_mezo-gj42_challenge_overload_type.sql` — **create**: drop+recreate `ck_challenge_type` with `'overload'`. Register in the changelog.
- `backend/…/feature/proactive/entity/ChallengeEntity.java` — **modify**: add `TYPE_OVERLOAD` constant.
- `backend/…/feature/proactive/service/ChallengeOutcomeEvaluator.java` — **modify**: fold `TYPE_OVERLOAD` into the `TYPE_PR` branch (hit-switch + `describe()`).
- `backend/…/feature/proactive/mapper/ChallengeDisplay.java` — **modify**: `overload` `typeLabel` + `target`.
- `backend/…/feature/proactive/service/OverloadChallengeGenerator.java` — **create**: the deterministic generator.
- `backend/…/feature/proactive/service/ProactiveChallengeService.java` — **modify**: inject + append the overload generator (guaranteed +1).
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/ChallengePopulator.java` — **modify**: add a `challengeOverload(...)` factory.
- Backend tests: `ChallengeOutcomeEvaluatorIT` (extend), `OverloadChallengeGeneratorIT` (create), `ProactiveApiChallengeIT`/service IT (extend).
- `api/feature/proactive/proactive.yml` — **modify**: `type` description prose only (no regen).
- `frontend/src/data/types.ts` — **modify**: `ChallengeType` += `'overload'`.
- `frontend/src/data/train/train.ts` — **modify**: mock `challenges` += one overload challenge.
- Frontend test: an existing `ChallengeCard`/`ChallengesCarousel` test extended (or a small render assertion) that the `overload` card renders.
- Docs: `docs/features/proactive.md`, `docs/features/train.md`, `docs/milestones/roadmap.md`.

---

### Task 1: `overload` type plumbing — DB CHECK + constant + evaluator + display + populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/{ts}_mezo-gj42_challenge_overload_type.sql`
- Modify: the changelog that includes `202607072100_mezo-hbwi_create_challenge.sql` (add the new changeset the same way)
- Modify: `backend/…/feature/proactive/entity/ChallengeEntity.java`
- Modify: `backend/…/feature/proactive/service/ChallengeOutcomeEvaluator.java`
- Modify: `backend/…/feature/proactive/mapper/ChallengeDisplay.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/ChallengePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeOutcomeEvaluatorIT.java` (extend)

**Interfaces — Produces:** `ChallengeEntity.TYPE_OVERLOAD = "overload"`; the evaluator resolves an accepted `overload` challenge hit/miss/inconclusive exactly like `PR`; `ChallengeDisplay.typeLabel("overload") == "⚡ Túlterhelés"` and `target(overloadEntity) == "{kg} kg × {reps}"`; `ChallengePopulator.challengeOverload(...)`.

- [ ] **Step 1: Write the failing evaluator IT cases.** Append to `ChallengeOutcomeEvaluatorIT` (mirror its existing PR cases; reuse its populator/seed idiom — check the top of the file for the owner-id + template-day + instance + logged-set helpers already used by the PR tests). Three cases:

```java
@Test
void testEvaluate_shouldHitOverload_whenLoggedSetMeetsTarget() {
    // seed like the PR-hit case, but type = overload, target 100kg × 5; log a completed instance
    // with a working set 100kg × 5 (or better) on the target exercise.
    UUID owner = ownerId();
    var day = /* template day */; var ex = /* template exercise on `day` */;
    var ch = challengePopulator.challengeOverload(owner, day.getId(), LocalDate.now(),
        ex.getId(), ChallengeEntity.STATUS_ACCEPTED, "100.00", 5);
    /* completed instance of `day` today with a logged working set 100kg × 5 on `ex` */;

    boolean changed = evaluator.evaluate(reload(ch), LocalDate.now());

    assertThat(changed).isTrue();
    var after = challengeRepository.findById(ch.getId()).orElseThrow();
    assertThat(after.getStatus()).isEqualTo(ChallengeEntity.STATUS_HIT);
    assertThat(after.getOutcomeGood()).isTrue();
}

@Test
void testEvaluate_shouldMissOverload_whenLoggedSetBelowTarget() {
    // same seed but the logged set is 95kg × 5 → miss.
    // assert STATUS_MISS + outcomeGood == false.
}

@Test
void testEvaluate_shouldBeInconclusiveOverload_whenNoLoggedSets() {
    // accepted overload challenge, a COMPLETED instance today with NO logged sets on the exercise.
    // assert STATUS_INCONCLUSIVE + outcomeGood == null.
}
```

> The exact seed helpers (owner id, template day, completed instance dated today, logged working set) already exist in `ChallengeOutcomeEvaluatorIT`'s PR tests + `TrainPopulator`/`ChallengePopulator` — copy that idiom; only the challenge `type` + target values differ. `challengeOverload(...)` is added in Step 3.

- [ ] **Step 2: Run — FAIL.** `cd backend && ./mvnw -q clean test -Dtest=ChallengeOutcomeEvaluatorIT` → the new cases fail (no `TYPE_OVERLOAD`, `challengeOverload` missing → compile error; and once compiling, `overload` hits the evaluator's `default -> false` → the hit case fails).

- [ ] **Step 3: Implement.**

`ChallengeEntity.java` — add beside the other type constants (after `TYPE_VOLUME`):
```java
    public static final String TYPE_OVERLOAD = "overload";
```

`ChallengeOutcomeEvaluator.java` — fold `overload` into the PR branch of BOTH switches:
```java
        // hit-switch:
            case ChallengeEntity.TYPE_PR, ChallengeEntity.TYPE_OVERLOAD -> logged.stream().anyMatch(s ->
                s.getWeightKg() != null && c.getTargetWeightKg() != null
                    && s.getWeightKg().compareTo(c.getTargetWeightKg()) >= 0
                    && s.getReps() != null && c.getTargetReps() != null && s.getReps() >= c.getTargetReps());
```
```java
        // describe():
            case ChallengeEntity.TYPE_PR, ChallengeEntity.TYPE_OVERLOAD -> {
                BigDecimal best = logged.stream().map(ExerciseSetEntity::getWeightKg)
                    .filter(w -> w != null).reduce(BigDecimal.ZERO, (a, b) -> a.compareTo(b) >= 0 ? a : b);
                yield "legjobb szett " + best.stripTrailingZeros().toPlainString() + " kg";
            }
```

`ChallengeDisplay.java`:
```java
    static String typeLabel(String type) {
        return switch (type) {
            case ChallengeEntity.TYPE_PR -> "PR-attempt";
            case ChallengeEntity.TYPE_DEPTH -> "Mélység";
            case ChallengeEntity.TYPE_VOLUME -> "Volumen";
            case ChallengeEntity.TYPE_OVERLOAD -> "⚡ Túlterhelés";
            default -> type;
        };
    }

    static String target(ChallengeEntity e) {
        return switch (e.getType()) {
            case ChallengeEntity.TYPE_PR, ChallengeEntity.TYPE_OVERLOAD ->
                    e.getTargetWeightKg().stripTrailingZeros().toPlainString() + " kg × " + e.getTargetReps();
            case ChallengeEntity.TYPE_DEPTH -> "Utolsó szet RIR " + e.getTargetRir() + "-ig";
            case ChallengeEntity.TYPE_VOLUME -> e.getTargetSets() + " szett";
            default -> "";
        };
    }
```

`ChallengePopulator.java` — add after `challengePr`:
```java
    /** An overload challenge with weight/rep targets (deterministic tie-in tests). */
    public ChallengeEntity challengeOverload(UUID createdBy, UUID templateSessionId, LocalDate workoutDate,
                                             UUID exerciseId, String status, String targetWeightKg, int targetReps) {
        ChallengeEntity entity = challenge(createdBy, templateSessionId, workoutDate, exerciseId,
            ChallengeEntity.TYPE_OVERLOAD, status);
        entity.setTargetWeightKg(new BigDecimal(targetWeightKg));
        entity.setTargetReps(targetReps);
        return challengeRepository.saveAndFlush(entity);
    }
```

New Liquibase changeset `{ts}_mezo-gj42_challenge_overload_type.sql` (use the current 12-digit UTC timestamp; a released CHECK can't be edited in place, so drop+recreate):
```sql
-- Progressive overload Plan 3 (bd mezo-gj42): the deterministic daily "overload" challenge type.
-- Extends the released ck_challenge_type CHECK (202607072100) — dropped + recreated (immutable rule).
alter table challenge drop constraint ck_challenge_type;
alter table challenge add constraint ck_challenge_type check (type in ('PR', 'Depth', 'Volume', 'overload'));
```
Register it in the changelog exactly as `202607072100_mezo-hbwi_create_challenge.sql` is registered (find that include and add the new file after it, following `liquibase_conventions.md`).

- [ ] **Step 4: Run — PASS.** `cd backend && ./mvnw -q clean test -Dtest=ChallengeOutcomeEvaluatorIT` (all cases incl. the 3 new). If it OOMs locally: `./mvnw -q clean test-compile` + defer to CI, DONE_WITH_CONCERNS.
- [ ] **Step 5: Commit** — `git add` the 6 files (migration, changelog, entity, evaluator, display, populator, IT); `feat(train): overload challenge type — CHECK + evaluator + display (mezo-gj42)`.

---

### Task 2: `OverloadChallengeGenerator` — the deterministic biggest-jump generator

**Files:**
- Create: `backend/…/feature/proactive/service/OverloadChallengeGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/OverloadChallengeGeneratorIT.java`

**Interfaces:**
- **Consumes:** `ChallengeRepository`, `WorkoutService` (`getToday(UUID, UUID)`), the generated `WorkoutTodayResponse`/`TodayExercise`/`ProgressionSignal` (`api.dto`), `ChallengeEntity.TYPE_OVERLOAD` (Task 1).
- **Produces:** `List<ChallengeEntity> generate(UUID userId, UUID templateSessionId, LocalDate date)` — 0 or 1 persisted `overload` challenge (idempotent; honest-empty on deload/no-jump/mismatched-day/past-or-future date).

- [ ] **Step 1: Write the failing IT.** `OverloadChallengeGeneratorIT extends AbstractIntegrationTest` (companion+proactive switches on — check how `ChallengeGeneratorIT` enables them; likely `@TestPropertySource` or the default test profile already sets them). Seed an active meso + a template day + exercises WITH completed logged-set history so `getToday` computes real `ProgressionSignal`s (reuse `TrainPopulator`'s meso/day/exercise/completed-instance+logged-set helpers — the same ones `WorkoutTodayProgressionIT` uses to get a WEIGHT-lever progression). Cases:

```java
@Test
void testGenerate_shouldEmitOneOverload_targetingTheBiggestWeightJump() {
    UUID owner = ownerId();
    // Active meso + a template day with >=2 exercises; seed history so getToday yields WEIGHT-lever
    // progressions with DIFFERENT deltaKg (e.g. exA +5kg, exB +2.5kg). Set templateSessionId = the day.
    var result = generator.generate(owner, dayId, LocalDate.now());

    assertThat(result).hasSize(1);
    ChallengeEntity ch = result.get(0);
    assertThat(ch.getType()).isEqualTo(ChallengeEntity.TYPE_OVERLOAD);
    assertThat(ch.getExerciseId()).isEqualTo(exA_id);        // the biggest +kg
    assertThat(ch.getStatus()).isEqualTo(ChallengeEntity.STATUS_PROPOSED);
    assertThat(ch.getTargetWeightKg()).isNotNull();
    assertThat(ch.getTargetReps()).isNotNull();
    assertThat(ch.getConfidence()).isNull();

    // idempotent: a second call returns the same single row, no duplicate.
    assertThat(generator.generate(owner, dayId, LocalDate.now())).hasSize(1);
    assertThat(challengeRepository.findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(
        owner, dayId, LocalDate.now()).stream()
        .filter(c -> ChallengeEntity.TYPE_OVERLOAD.equals(c.getType())).count()).isEqualTo(1);
}

@Test
void testGenerate_shouldEmitNone_whenDeloadOrNoJump() {
    // Either: an active meso whose current week is a Deload phase (all levers HOLD/DELOAD), OR a day
    // whose exercises have no history (progression null). assert generator.generate(...).isEmpty().
}
```

> Reuse the exact meso+history seeding that `WorkoutTodayProgressionIT` (feature.train) uses to force a WEIGHT-lever `ProgressionSignal` — read that IT for the helper calls (active meso, template day, completed instance + logged working sets at a weight that triggers `+kg`). The deload case reuses the Deload-phase seed from `VolumeProgressionServiceIT`/`WorkoutTodayProgressionIT`. If a single IT is too heavy to run locally, compile-verify + defer to CI.

- [ ] **Step 2: Run — FAIL** (`OverloadChallengeGenerator` missing → compile error).

- [ ] **Step 3: Implement `OverloadChallengeGenerator.java`:**
```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic (non-LLM) daily "overload" challenge (Plan 3, bd mezo-gj42): ONE challenge per
 * (user, template day, today) targeting the day's biggest recommended jump — the largest +kg
 * (weight lever), else the largest meaningful +rep (rep lever). Reads the already-computed
 * per-exercise {@link ProgressionSignal} from {@link WorkoutService#getToday} (no duplication of the
 * deload/effective-set/intensity logic; getToday is the idempotent lazy-settle entry point). Deload
 * and no-jump days emit none (honest). Guaranteed +1: generated alongside the LLM ChallengeGenerator
 * in {@link ProactiveChallengeService}, INDEPENDENT of its max-per-workout cap.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class OverloadChallengeGenerator {

    private final ChallengeRepository challengeRepository;
    private final WorkoutService workoutService;

    @Transactional
    public List<ChallengeEntity> generate(UUID userId, UUID templateSessionId, LocalDate date) {
        if (!date.equals(LocalDate.now())) {
            return List.of();   // past/future never generate (mirror ChallengeGenerator)
        }
        List<ChallengeEntity> existing = challengeRepository
                .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(userId, templateSessionId, date)
                .stream().filter(c -> ChallengeEntity.TYPE_OVERLOAD.equals(c.getType())).toList();
        if (!existing.isEmpty()) {
            return existing;    // idempotent, no recompute
        }
        WorkoutTodayResponse today = workoutService.getToday(userId, templateSessionId);
        if (today.getTemplateSessionId() == null
                || !today.getTemplateSessionId().equals(templateSessionId)
                || today.getExercises() == null) {
            return List.of();   // getToday resolved a different day (open instance) or no exercises
        }
        Optional<TodayExercise> pick = pickBiggestJump(today.getExercises());
        if (pick.isEmpty()) {
            return List.of();   // deload / no meaningful jump → honest empty
        }
        TodayExercise ex = pick.get();
        ChallengeEntity e = build(userId, templateSessionId, date, ex, ex.getProgression());
        log.debug("Overload challenge for {} / {} on exercise {}", userId, templateSessionId, ex.getId());
        return List.of(challengeRepository.saveAndFlush(e));
    }

    /** Largest +kg (weight lever, >0), else the largest meaningful +rep (rep lever, >=1). */
    private Optional<TodayExercise> pickBiggestJump(List<TodayExercise> exercises) {
        Optional<TodayExercise> weight = exercises.stream()
                .filter(t -> t.getProgression() != null
                        && t.getProgression().getLever() == ProgressionSignal.LeverEnum.WEIGHT
                        && t.getProgression().getDeltaKg() != null
                        && t.getProgression().getDeltaKg().compareTo(BigDecimal.ZERO) > 0)
                .max(Comparator.comparing(t -> t.getProgression().getDeltaKg()));
        if (weight.isPresent()) {
            return weight;
        }
        return exercises.stream()
                .filter(t -> t.getProgression() != null
                        && t.getProgression().getLever() == ProgressionSignal.LeverEnum.REP
                        && t.getProgression().getDeltaReps() != null
                        && t.getProgression().getDeltaReps() >= 1)
                .max(Comparator.comparing(t -> t.getProgression().getDeltaReps()));
    }

    private ChallengeEntity build(UUID userId, UUID templateSessionId, LocalDate date,
                                  TodayExercise ex, ProgressionSignal sig) {
        ChallengeEntity e = new ChallengeEntity();
        e.setCreatedBy(userId);
        e.setTemplateSessionId(templateSessionId);
        e.setWorkoutDate(date);
        e.setExerciseId(ex.getId());              // TodayExercise.id == the TEMPLATE exercise id
        e.setExerciseName(ex.getName());
        e.setType(ChallengeEntity.TYPE_OVERLOAD);
        e.setStatus(ChallengeEntity.STATUS_PROPOSED);
        e.setRisk(ChallengeEntity.RISK_LOW);
        e.setTitle("⚡ Túlterhelés · " + ex.getName());
        e.setWhy(sig.getRationale());             // the engine's HU rationale (grounded)
        e.setGlory("Teljesítsd a mai ajánlott terhelést.");
        e.setTargetWeightKg(sig.getTargetWeightKg());   // both BigDecimal — direct (null-safe: null on rep lever)
        e.setTargetReps(sig.getTargetReps());
        e.setConfidence(null);                    // DC8: deterministic, no learned confidence
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }
}
```

> Note: on the REP lever, `sig.getTargetWeightKg()` is null, so `target_weight_kg` is null and the display `target()` reuses the PR branch which dereferences `getTargetWeightKg()` — for a rep-lever overload that would NPE. **Guard in `ChallengeDisplay.target()`** (Task 1): if you support rep-lever overload targets, the PR branch must tolerate a null weight. SIMPLER + honest for v1: only emit a rep-lever overload when a weight target is ALSO present is not possible (rep lever has no weight). So EITHER (a) the display `overload` branch renders `"{reps} ismétlés"` when weight is null, OR (b) evaluation/target for rep-lever overload uses reps only. **Decision for this plan:** in `ChallengeDisplay.target()`, split so `overload` renders `"{kg} kg × {reps}"` when `targetWeightKg != null` else `"{reps} ismétlés"`; and in the evaluator's hit-switch, the `overload` predicate already requires `targetWeightKg != null` (so a rep-lever overload with null weight would evaluate false → always miss). To keep rep-lever overload honestly evaluable, evaluate reps-only when weight is null. **Fold this into Task 1's evaluator/display code** — see Task 1 addendum below. (If the reviewer prefers scoping v1 to WEIGHT-lever overload only, that is also acceptable and simpler; call it out.)

**Task 1 addendum (apply together with Task 2 — rep-lever null-weight safety):**
- `ChallengeDisplay.target()` overload branch:
```java
            case ChallengeEntity.TYPE_OVERLOAD -> e.getTargetWeightKg() != null
                    ? e.getTargetWeightKg().stripTrailingZeros().toPlainString() + " kg × " + e.getTargetReps()
                    : e.getTargetReps() + " ismétlés";
            case ChallengeEntity.TYPE_PR ->
                    e.getTargetWeightKg().stripTrailingZeros().toPlainString() + " kg × " + e.getTargetReps();
```
- `ChallengeOutcomeEvaluator` hit-switch — keep PR as-is; give `overload` its own case tolerating null weight:
```java
            case ChallengeEntity.TYPE_OVERLOAD -> logged.stream().anyMatch(s ->
                s.getReps() != null && c.getTargetReps() != null && s.getReps() >= c.getTargetReps()
                    && (c.getTargetWeightKg() == null
                        || (s.getWeightKg() != null && s.getWeightKg().compareTo(c.getTargetWeightKg()) >= 0)));
```
- `describe()` — fold `overload` into the PR case (weight text) but guard: if `targetWeightKg == null`, yield `logged.get(logged.size()-1).getReps() + " ismétlés"`. (Keep it small; the PR case's "legjobb szett … kg" is fine when weight is present.)

- [ ] **Step 4: Run — PASS** (biggest-jump pick + idempotency + deload/no-jump empty). Also re-run `-Dtest=ChallengeOutcomeEvaluatorIT` (the rep-lever tolerance change). Compile-verify + CI if OOM.
- [ ] **Step 5: Commit** — `feat(train): deterministic overload challenge generator (mezo-gj42)`.

---

### Task 3: wire the overload generator into `ProactiveChallengeService` (guaranteed +1)

**Files:**
- Modify: `backend/…/feature/proactive/service/ProactiveChallengeService.java`
- Test: extend the existing challenge API/service IT (find it: `ProactiveApiChallengeIT` or `ProactiveChallengeServiceIT` — the one that drives `getChallenges` with the `FakeCompanionLlm` `EDZES-KIHIVAS-FELADAT` marker).

**Interfaces:**
- **Consumes:** `OverloadChallengeGenerator` (Task 2).
- **Produces:** `getChallenges` returns the LLM challenges PLUS the deterministic overload challenge (when a jump exists), the overload one being +1 over the `max-per-workout` cap; idempotent across reads.

- [ ] **Step 1: Failing IT.** Extend the challenge API/service IT: seed a today workout with real progression history (so the overload generator emits one) AND the `FakeCompanionLlm` scripted to return N PR/Depth/Volume challenges (mirror the existing IT's fake-answer setup). Assert the `getChallenges` result contains BOTH the LLM challenges AND exactly one `type=overload` challenge, and that the overload one is present even when the LLM returned `max-per-workout` challenges (the +1). Assert a second read returns the same set (no duplicate overload).

```java
// key assertions (adapt to the existing IT's seed helpers + fake-LLM idiom):
List<ChallengeResponse> out = service.getChallenges(owner, dayId, LocalDate.now());
assertThat(out).anyMatch(c -> "⚡ Túlterhelés".equals(c.getTypeLabel()));   // the overload one
assertThat(out.stream().filter(c -> "⚡ Túlterhelés".equals(c.getTypeLabel())).count()).isEqualTo(1);
// +1 over the cap: LLM count == max-per-workout, total == max-per-workout + 1
// idempotent: second call, same count.
```

- [ ] **Step 2: Run — FAIL** (only the LLM challenges present; no overload).
- [ ] **Step 3: Implement.** In `ProactiveChallengeService`: inject `private final OverloadChallengeGenerator overloadChallengeGenerator;` (add to the constructor field list — `@RequiredArgsConstructor`). In `getChallenges`, replace the generation block:
```java
        if (rows.isEmpty() && date.equals(LocalDate.now())
                && !instanceCompleted(userId, templateSessionId, date)) {
            List<ChallengeEntity> generated = new java.util.ArrayList<>(
                    generator.generate(userId, templateSessionId, date));            // LLM (capped)
            generated.addAll(overloadChallengeGenerator.generate(userId, templateSessionId, date)); // +1 deterministic
            rows = generated;
        }
```
(The `rows.isEmpty()` outer guard keeps the whole thing idempotent: once ANY row exists — LLM or overload — the block is skipped on later reads. The overload generator's own existing-row check (Task 2) is belt-and-suspenders.)

- [ ] **Step 4: Run — PASS** (`-Dtest=<the challenge API/service IT>` + `-Dtest=OverloadChallengeGeneratorIT,ChallengeOutcomeEvaluatorIT` no regression). Compile-verify + CI if OOM.
- [ ] **Step 5: Commit** — `feat(train): serve the overload challenge alongside LLM ones, +1 (mezo-gj42)`.

---

### Task 4: FE `ChallengeType` union + mock parity + contract prose

**Files:**
- Modify: `frontend/src/data/types.ts` (`ChallengeType`)
- Modify: `frontend/src/data/train/train.ts` (mock `challenges`)
- Modify: `api/feature/proactive/proactive.yml` (`type` description prose — no regen)
- Test: extend an existing `ChallengeCard`/`ChallengesCarousel` test (or add a small render assertion)

**Interfaces — Produces:** the FE renders an `overload` challenge (⚡ Túlterhelés) through the unchanged card/carousel; mock mode shows it.

- [ ] **Step 1: Failing/anchor test.** In the `ChallengeCard` (or `ChallengesCarousel`) colocated test, add a case rendering a `type: 'overload'` challenge (typeLabel `'⚡ Túlterhelés'`, target `'107.5 kg × 8'`) and assert the label + target render. (The component is type-agnostic, so this mostly guards the union + mock.)
- [ ] **Step 2: Run — FAIL** (TS: `'overload'` not assignable to `ChallengeType`).
- [ ] **Step 3: Implement.**

`types.ts`:
```ts
export type ChallengeType = 'PR' | 'Depth' | 'Volume' | 'Tempo' | 'overload'
```

`train.ts` — add to the `challenges: [...]` array (after `ch1`), a deterministic-looking overload challenge:
```ts
    {
      id: 'ch-overload',
      type: 'overload',
      typeLabel: '⚡ Túlterhelés',
      exerciseId: 'ex1',
      exercise: 'Chest Supported Row',
      target: '107.5 kg × 8',
      confidence: null, // deterministic — renders "tanulom" (DC8)
      risk: 'low',
      why: 'A mai ajánlott terhelés: +2.5 kg a múlt heti 105-höz képest (RIR 2 stabil).',
      refs: [],
      glory: 'Teljesítsd a mai ajánlott terhelést.',
      targetWeightKg: 107.5,
      targetReps: 8,
    },
```

`proactive.yml` — update the `ChallengeResponse.type` description prose only (no `enum:`, no regen):
```yaml
        type:
          type: string
          description: 'PR | Depth | Volume | overload'
```

- [ ] **Step 4: Run — PASS.** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- [ ] **Step 5: Commit** — `git add frontend/src/data/types.ts frontend/src/data/train/train.ts api/feature/proactive/proactive.yml <test>`; `feat(train): overload challenge FE type + mock parity (mezo-gj42)`.

---

### Task 5: docs

**Files:** Modify `docs/features/proactive.md` (the challenge section + §9 decisions: the new deterministic `overload` type — generator, PR-mirror evaluation, guaranteed +1, `⚡ Túlterhelés` display), `docs/features/train.md` (§2/§4 the overload-challenge tie-in — the last progressive-overload surface), `docs/milestones/roadmap.md` (one dated row).

- [ ] **Step 1:** Edit the living docs (overwrite-in-place, no changelog inside the doc). In `proactive.md`: document `OverloadChallengeGenerator` (deterministic, reads getToday's ProgressionSignal, biggest +kg else +rep, DC1-DC9), the folded PR-mirror evaluation, the `ck_challenge_type` extension, and that the type catalog is now PR/Depth/Volume/**overload** (Tempo still deferred). In `train.md`: the challenge tie-in under the progressive-overload surfaces (§2/§4). In `roadmap.md`: one dated row (`2026-07-28`) — Plan 3 completes the progressive-overload checklist (Plan 1 v0.124.0 → Plan 2 v0.130.0 → Plan 3).
- [ ] **Step 2:** `node scripts/lint-docs.mjs` — confirm proactive.md + train.md staleness clears.
- [ ] **Step 3: Commit** — `docs(train): document the deterministic overload challenge (mezo-gj42)`.

---

## Self-Review

**Spec coverage (D11 / §5.2 / §7#3 / §8 / §9):** one deterministic overload challenge → Task 2 (DC1/DC2); biggest recommended jump (largest +kg else +rep) → DC2/Task 2; targets that exercise → Task 2 `build`; fed into existing accept/decide + `ChallengeOutcomeEvaluator` → DC4/Task 1 + Task 3 (decide is already type-agnostic); deterministic/not-LLM → the whole generator; new `source`/`type` discriminator value `overload` → DC5/Task 1 (type value, no `source` column); renders through unchanged `ChallengesCarousel`/`ChallengeCard` → DC7/Task 4; generator emits exactly one from the biggest jump + evaluator hit/miss → Task 2 + Task 1 ITs (§9); mock parity (D13) → DC9/Task 4.

**Placeholder scan:** Task 1 (evaluator/display/entity/migration/populator) + Task 2 (the generator) carry complete code. The IT bodies in Tasks 1–3 give seed intent + concrete assertions but abbreviate the meso/history/instance seeding with a named `>` note (reuse `WorkoutTodayProgressionIT` / `ChallengeOutcomeEvaluatorIT` / the challenge API IT's existing helpers) — acceptable because the exact populator calls depend on those files' current helpers, and the deterministic units + wiring carry full code. No `TBD`/`TODO`.

**Type consistency:** `TYPE_OVERLOAD` used in Task 1 (entity/evaluator/display/populator) + Task 2 (generator) + Task 3 (IT). `OverloadChallengeGenerator.generate(UUID,UUID,LocalDate)` produced in Task 2, consumed in Task 3. `ProgressionSignal.LeverEnum.WEIGHT/REP`, `getDeltaKg()`→BigDecimal, `getDeltaReps()`→Integer, `getTargetWeightKg()`→BigDecimal, `TodayExercise.getId()/getName()/getProgression()`, `WorkoutTodayResponse.getTemplateSessionId()/getExercises()` — all verified against the generated sources. `ChallengeType` union += `'overload'` (Task 4) matches the backend `type` value.

**Rep-lever null-weight edge (surfaced during planning):** a REP-lever overload has a null `targetWeightKg`; the PR-mirror display/evaluation dereference weight → the Task 1 addendum (applied with Task 2) gives `overload` its own null-tolerant display + evaluation (reps-only when weight is null). Reviewer option: scope v1 to WEIGHT-lever overload only (simpler) — flagged in Task 2.

**Known minor (DC8):** `confidence=null` → the existing "tanulom" chip on a grounded challenge is a mild copy nuance; deliberately NOT fixed here to keep `ChallengeCard` type-agnostic — a follow-up may relabel/suppress it.

---

## Execution Handoff

Plan complete. Ships as ONE PR (single phase) on `feat/progressive-overload-p3` cut from `origin/main`. Execution: **Subagent-Driven** (fresh subagent per task, task review between, broad final review), per the user's request.
