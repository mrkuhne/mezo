# Progressive Overload — Plan 2: volume engine + Mezociklus áttekintő (volume-arc)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **This plan ships in two independent PRs — Phase A then Phase B.**

**Goal:** Make the mesocycle's per-muscle **weekly working-set volume actually progress** week-over-week (MEV→MRV ramp, performance-driven, deload back-off), and give the athlete a read-only **`Mezociklus áttekintő`** surface (progress header + volume-arc timeline) reachable from Mai and Gym.

**Architecture:** Phase A (backend) — a new `VolumeProgressionService` runs a **week-rollover** at the top of `WorkoutService.getToday`: it advances the meso's `currentWeek` to the calendar week and, per muscle, recomputes the target working-set count (`MuscleGroupVolumeLog.currentSets`) from last week's logged performance, bounded `[MEV, MRV]`, deloading on the plan's Deload week or an at-MRV grind. The week's per-muscle target is distributed to an **effective per-exercise working-set count** in `getToday` (derived, template untouched). Phase B (backend + FE) — a new `GET /train/mesocycles/{id}/volume-arc` returns per-muscle `planned` (scaffold projection) + `actual` (aggregated logged working sets per meso-week); a read-only `MesoOverviewPage` renders a progress header + a per-muscle `VolumeArcChart`, reachable via entry chips on Mai and Gym. All behind a new `mezo.feature.volume-progression` switch; mock-parity throughout.

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · Postgres/Liquibase · OpenAPI contract-first · React 19 + Vite + Tailwind v4 · TanStack Query · Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-25-progressive-overload-design.md`](../specs/2026-07-25-progressive-overload-design.md) — implements **§5.2 (volume engine), §5.3 (arc data), §7 (endpoint), §8 (overview + chips), D4–D7/D10–D13**, and resolves the spec's **§11** open items (see Decisions). Builds on **Plan 1** (`mezo-5pfe`, shipped v0.124.0): the RIR-aware intensity engine + `ProgressionSignal`.

## Global Constraints

- **bd:** `mezo-hi9m`. **Base package** `io.mrkuhne.mezo`. **PKs** UUID. **Build** Maven, always `./mvnw clean …`.
- **Contract-first:** edit `api/feature/train/train.yml` before boundary code; merge `cd api/generate && npm run generate:api`; FE types `cd frontend && pnpm generate:api`; never hand-write boundary DTOs.
- **Config:** new tunables via a `@Validated @ConfigurationProperties(prefix="mezo.volume")` record (auto-registered by `@ConfigurationPropertiesScan` — no wiring). **Never `@Value`.** Feature gate mirrors `HypertrophyDriveGate`: `FeaturesConfiguration.VOLUME_PROGRESSION_SWITCH = "mezo.feature.volume-progression.enabled"` + a `@ConditionalOnProperty` `VolumeProgressionGate` marker bean consumed via `ObjectProvider`.
- **Backend tests:** integration-first (`@SpringBootTest`, real Postgres, AssertJ, no mocks/H2), pure logic as plain JUnit. ITs against fixed `mezo_test` DB (`docker compose up -d`) or `-Dmezo.test.use-testcontainers=true`. **This 16 GB machine OOMs on the full backend IT suite — CI is the authoritative full-suite gate; run only focused ITs locally**, and if a focused IT OOMs, compile-verify + defer to CI (never fake a pass).
- **Frontend:** hooks only from `@/data/hooks`; deep absolute `@/*` imports; tests colocated; **both modes green** — `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Commits:** conventional, carrying the bd id, e.g. `feat(train): … (mezo-hi9m)`. **The beads pre-commit hook force-stages a gitignored root `issues.jsonl`** — every commit uses explicit `git add <paths>` + `git restore --staged issues.jsonl` if present, and `--no-verify` when needed; NEVER `git add -A`. (See auto-memory `mezo-ship-flow-gotchas`.)
- **HU copy:** all user-facing strings Hungarian.
- **No DB migration expected:** the engine reuses `mesocycle.current_week`, `mesocycle.volume_recompute`, and `muscle_group_volume_log.current_sets`/`source` — all already exist. No new table (D6). If implementation reveals a genuine need, follow `liquibase_conventions.md` + add to `ResetDatabase` in the same change.

## Decisions (resolve spec §11 + implementation-level choices)

| # | Decision | Choice |
|---|---|---|
| **DA1** | Week index convention | **`currentWeek` is 1-based** (as `TrainService.clampWeek` produces + the UI "Week n/N"). **Plan 2 fixes the latent off-by-one in `WorkoutService.getToday`**: change `phaseCurve.get(currentWeek)` → `phaseCurve.get(currentWeek - 1)` (bounds-checked). `phaseFor(meso)` helper centralizes this. |
| **DA2** | Meso-week bucketing | **`startDate`-anchored 7-day blocks.** `weekOf(startDate, date) = floor(DAYS.between(startDate, date)/7) + 1`, clamped `[1, weeks]` (== `TrainService.clampWeek` for `date=now`). One helper reused by the rollover trigger AND the actual-arc aggregation. |
| **DA3** | Rollover trigger & idempotency | Lazy in `getToday`. `calWeek = clampWeek(startDate, weeks)`. The meso's `volumeRecompute.lastRun` stores the last-recomputed week as `"W{n}"` (`null`/absent ⇒ 0). If `calWeek > lastWeek` → recompute for the transition **into `calWeek`** (single step, using the most recent completed week's performance — skipped weeks jump straight to the current target), persist, set `currentWeek = calWeek`, write `volumeRecompute.lastRun = "W{calWeek}"`. Else **no-op** (idempotent within a week). |
| **DA4** | Per-muscle weekly decision | Pure function over `(prevSets, mev, mav, mrv, phase, loggedLastWeek, targetHit, grind)`. Week 1 → `mev`. Deload week **or** (`prevSets ≥ mrv` **and** `grind`) → `round(prevSets × deloadFraction)` (default 0.5, floored at `⌈mev/2⌉`). Else `targetHit && !grind && prevSets < mrv` → `min(prevSets + step, mrv)` (step default 2). Else → `prevSets` (hold). `targetHit` = last week's logged working sets for the muscle `≥ prevSets`; `grind` = the muscle had ≥1 exercise whose most-recent logged working set came in `≥2` RIR below its `targetRir` (recovery proxy; the only Phase-3 signal reachable today). |
| **DA5** | Muscle zone→group collapse | New pure `MuscleGroup.of(zone)` — `chest-*→chest`, `back-*`+`traps→back`, `shoulder-*→shoulder`, `biceps-*→biceps`, `triceps-*→triceps`, `quad/ham/glute/calf/core` unchanged, legacy coarse keys pass through. Volume landmarks + the arc are per-GROUP; `exercise.muscle` is per-ZONE (21-token taxonomy, `mezo-wu1s`). A group with no landmark row (e.g. `calf`/`core` unseeded) is skipped by the engine and omitted from the arc (never fabricated). |
| **DA6** | Effective per-exercise sets | In `getToday`, when the switch is on and the meso has landmarks, the week's per-muscle `currentSets` target is distributed across that muscle-group's working exercises in the day — proportional to each exercise's template `workingSets`, remainder to the largest — as an **effective count**, applied by threading it into `SetRecommendationService.prescribe(…, effectiveWorkingSets)` AND `t.setWorkingSets(effective)` on the DTO. Template rows are **not** mutated (derived, D6). Switch off → template counts unchanged. |
| **DA7** | Arc data | `planned[w]` = scaffold projection: `mev` at week 1, `+step` per non-deload week toward `mrv`, deload weeks = `round(mrv × deloadFraction)`. `actual[w]` (weeks `≤ currentWeek`) = aggregated logged WORKING sets for the muscle group in week `w`'s date range. `current` = `currentSets`. No per-week table (D6). |
| **DA8** | Feature switch & mock | Gate: `mezo.feature.volume-progression.enabled` (default **true** in `application.yml`, mirroring hypertrophy-drive). Off ⇒ no rollover, no effective-set override, arc endpoint still serves planned+actual from landmarks (read-only, harmless). Mock ⇒ rollover no-ops; the arc hook derives from the `train.ts` `volumePerMuscle` fixture; both FE modes byte-identical. |

## File Structure

**Phase A — backend engine:**
- `backend/…/feature/train/config/VolumeProperties.java` — **create**: `@ConfigurationProperties("mezo.volume")` (`step`, `deloadFraction`, `grindRirGap`).
- `backend/…/techcore/configuration/FeaturesConfiguration.java` — **modify**: add `VOLUME_PROGRESSION_SWITCH`.
- `backend/…/feature/train/VolumeProgressionGate.java` — **create**: `@ConditionalOnProperty` marker (mirror `HypertrophyDriveGate`).
- `backend/…/feature/train/service/MuscleGroup.java` — **create**: pure zone→group collapse (DA5).
- `backend/…/feature/train/service/VolumeDecider.java` — **create**: pure weekly decision (DA4).
- `backend/…/feature/train/service/VolumeProgressionService.java` — **create**: `rolloverIfDue` (`@Transactional`), performance read, persist, audit.
- `backend/…/feature/train/service/WorkoutService.java` — **modify**: call rollover; fix phase indexing (DA1); effective-set distribution (DA6).
- `backend/…/feature/train/service/SetRecommendationService.java` — **modify**: `prescribe(…, int effectiveWorkingSets)` overload/param.
- `backend/src/main/resources/application.yml` — **modify**: `mezo.feature.volume-progression.enabled` + `mezo.volume.*`.
- Tests: `MuscleGroupTest`, `VolumeDeciderTest` (pure); `VolumeProgressionServiceIT`, and extend `WorkoutTodayProgressionIT` / a new `VolumeRolloverIT`.

**Phase B — arc endpoint + overview + chips:**
- `api/feature/train/train.yml` — **modify**: `GET /train/mesocycles/{id}/volume-arc` + `MesocycleVolumeArcResponse`/`MuscleVolumeArc`/`VolumeArcWeek` schemas.
- `backend/…/feature/train/service/VolumeArcService.java` (or method on `TrainService`) — **create**: planned scaffold + actual aggregation (new `ExerciseSetRepository`/`WorkoutSessionRepository` query).
- `backend/…/feature/train/repository/ExerciseSetRepository.java` — **modify**: a per-muscle-per-date-range working-set aggregation query.
- `backend/…/feature/train/controller/TrainController.java` — **modify**: `@Override` the new arc endpoint.
- `frontend/src/data/train/trainApi.ts` + `data/train/mesoArcHooks.ts` (**create**) + `data/hooks.ts` (**modify**) + `data/types.ts` (**modify**) — the `useMesocycleVolumeArc(id)` dual-mode hook + domain types.
- `frontend/src/data/train/train.ts` — **modify**: mock arc derivation from `volumePerMuscle`.
- `frontend/src/features/train/components/VolumeArcChart.tsx` (+ test) — **create**.
- `frontend/src/features/train/pages/MesoOverviewPage.tsx` (+ test) — **create**.
- `frontend/src/app/router.tsx` — **modify**: `train/mesocycles/:id/overview` route.
- `frontend/src/features/train/pages/GymPage.tsx` + `TrainTodayPage.tsx` (+ tests) — **modify**: entry chips.
- `docs/features/train.md`, `docs/milestones/roadmap.md` — **modify**.

---

## PHASE A — volume engine + rollover (ships as its own PR)

### Task A1: `mezo.volume` config + `volume-progression` feature gate

**Files:** Create `VolumeProperties.java`, `VolumeProgressionGate.java`; modify `FeaturesConfiguration.java`, `application.yml`. Test: `VolumePropertiesIT` (create).

**Interfaces — Produces:** `VolumeProperties(int step, BigDecimal deloadFraction, int grindRirGap)` bound at `mezo.volume`; `FeaturesConfiguration.VOLUME_PROGRESSION_SWITCH`; `VolumeProgressionGate` marker bean.

- [ ] **Step 1: Write the failing binding IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class VolumePropertiesIT extends AbstractIntegrationTest {
    @Autowired VolumeProperties props;

    @Test
    void testVolumeProperties_shouldBindDefaults() {
        assertThat(props.step()).isEqualTo(2);
        assertThat(props.deloadFraction()).isEqualByComparingTo("0.5");
        assertThat(props.grindRirGap()).isEqualTo(2);
    }
}
```

- [ ] **Step 2: Run — FAIL** (`VolumeProperties` missing). `cd backend && ./mvnw -q clean test -Dtest=VolumePropertiesIT` → compile error.

- [ ] **Step 3: Implement**

`VolumeProperties.java`:
```java
package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Volume-progression tuning (mezo.volume): weekly set increment, deload fraction, grind RIR gap. */
@Validated
@ConfigurationProperties(prefix = "mezo.volume")
public record VolumeProperties(
    @NotNull @Positive Integer step,                 // sets added per productive week (2)
    @NotNull @Positive BigDecimal deloadFraction,    // deload target = round(prevSets * this) (0.5)
    @NotNull @PositiveOrZero Integer grindRirGap      // RIR-below-target gap that counts as a grind (2)
) {}
```

`FeaturesConfiguration.java` — add beside `HYPERTROPHY_DRIVE_SWITCH`:
```java
    public static final String VOLUME_PROGRESSION_SWITCH = "mezo.feature.volume-progression.enabled";
```

`VolumeProgressionGate.java` (mirror `HypertrophyDriveGate`):
```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Marker bean present only when mezo.feature.volume-progression.enabled=true; gates the weekly
 * volume rollover + effective-set override in WorkoutService.getToday via ObjectProvider. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.VOLUME_PROGRESSION_SWITCH, havingValue = "true")
public class VolumeProgressionGate {}
```

`application.yml` — under `mezo.feature:` (beside `hypertrophy-drive`): `volume-progression:\n      enabled: true`. Under `mezo:` (beside `hypertrophy:`):
```yaml
  volume:
    step: 2
    deload-fraction: 0.5
    grind-rir-gap: 2
```

- [ ] **Step 4: Run — PASS.** `cd backend && ./mvnw -q clean test -Dtest=VolumePropertiesIT`
- [ ] **Step 5: Commit** — `git add` the 4 files; `feat(train): volume-progression config + feature gate (mezo-hi9m)`.

---

### Task A2: `MuscleGroup` — pure zone→group collapse

**Files:** Create `MuscleGroup.java`; test `MuscleGroupTest.java`.

**Interfaces — Produces:** `MuscleGroup.of(String zone) → String group`. Idempotent on coarse keys.

- [ ] **Step 1: Failing test**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class MuscleGroupTest {
    @Test void of_collapsesChestZones() { assertThat(MuscleGroup.of("chest-upper")).isEqualTo("chest"); }
    @Test void of_collapsesBackZonesAndTraps() {
        assertThat(MuscleGroup.of("back-wide")).isEqualTo("back");
        assertThat(MuscleGroup.of("traps")).isEqualTo("back");
    }
    @Test void of_collapsesArms() {
        assertThat(MuscleGroup.of("biceps-long")).isEqualTo("biceps");
        assertThat(MuscleGroup.of("triceps-lateral")).isEqualTo("triceps");
    }
    @Test void of_passesThroughCoarseAndLegs() {
        assertThat(MuscleGroup.of("quad")).isEqualTo("quad");
        assertThat(MuscleGroup.of("chest")).isEqualTo("chest");   // legacy coarse
        assertThat(MuscleGroup.of("core")).isEqualTo("core");
    }
}
```

- [ ] **Step 2: Run — FAIL.** `./mvnw -q clean test -Dtest=MuscleGroupTest`
- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.train.service;

/** Collapse the 21-token zone taxonomy (exercise.muscle, mezo-wu1s) to the coarse volume-group
 * taxonomy (muscle_group_volume_log.muscle): chest/back/shoulder/biceps/triceps + quad/ham/glute/calf/core.
 * Legacy coarse keys and already-coarse leg/core tokens pass through unchanged. Pure. */
public final class MuscleGroup {
    private MuscleGroup() {}

    public static String of(String zone) {
        if (zone == null || zone.isBlank()) return zone;
        if ("traps".equals(zone)) return "back";
        int dash = zone.indexOf('-');
        String head = dash >= 0 ? zone.substring(0, dash) : zone;
        return switch (head) {
            case "chest", "back", "shoulder", "biceps", "triceps" -> head;
            default -> zone; // quad/ham/glute/calf/core + legacy coarse (lats/rear-delt/…) pass through
        };
    }
}
```

- [ ] **Step 4: Run — PASS.** `./mvnw -q clean test -Dtest=MuscleGroupTest`
- [ ] **Step 5: Commit** — `feat(train): pure muscle zone→group collapse (mezo-hi9m)`.

---

### Task A3: `VolumeDecider` — pure weekly-target decision

**Files:** Create `VolumeDecider.java`; test `VolumeDeciderTest.java`.

**Interfaces — Produces:** `VolumeDecider.decide(Input) → Result`. `Input(int week, int prevSets, int mev, int mav, int mrv, boolean deloadPhase, int loggedLastWeek, boolean grind, int step, BigDecimal deloadFraction)`. `Result(int targetSets, Lever lever, String change)` where `Lever {RAMP, HOLD, DELOAD, START}` and `change` is the audit label (e.g. `"MAV +2 (14 → 16)"`).

- [ ] **Step 1: Failing test** — one per branch (DA4):

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Input;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Result;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VolumeDeciderTest {
    private static final BigDecimal HALF = new BigDecimal("0.5");
    private Input in(int week, int prev, boolean deload, int logged, boolean grind) {
        return new Input(week, prev, 8, 14, 20, deload, logged, grind, 2, HALF);
    }
    @Test void week1_startsAtMev() {
        Result r = VolumeDecider.decide(in(1, 0, false, 0, false));
        assertThat(r.lever()).isEqualTo(Lever.START); assertThat(r.targetSets()).isEqualTo(8);
    }
    @Test void productiveWeek_rampsByStep() {
        Result r = VolumeDecider.decide(in(3, 14, false, 14, false));  // hit target, no grind, below mrv
        assertThat(r.lever()).isEqualTo(Lever.RAMP); assertThat(r.targetSets()).isEqualTo(16);
    }
    @Test void atMrv_holds() {
        Result r = VolumeDecider.decide(in(5, 20, false, 20, false));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(20);
    }
    @Test void missedTarget_holds() {
        Result r = VolumeDecider.decide(in(3, 14, false, 10, false)); // logged < prev → not productive
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(14);
    }
    @Test void deloadPhase_cutsToFraction() {
        Result r = VolumeDecider.decide(in(6, 18, true, 18, false));
        assertThat(r.lever()).isEqualTo(Lever.DELOAD); assertThat(r.targetSets()).isEqualTo(9); // round(18*0.5)
    }
    @Test void atMrvAndGrind_earlyDeloads() {
        Result r = VolumeDecider.decide(in(5, 20, false, 20, true));
        assertThat(r.lever()).isEqualTo(Lever.DELOAD); assertThat(r.targetSets()).isEqualTo(10);
    }
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure per-muscle weekly volume-target decision (spec §5.2, DA4). No Spring/DB. */
public final class VolumeDecider {
    private VolumeDecider() {}

    public enum Lever { START, RAMP, HOLD, DELOAD }

    public record Input(int week, int prevSets, int mev, int mav, int mrv, boolean deloadPhase,
                        int loggedLastWeek, boolean grind, int step, BigDecimal deloadFraction) {}
    public record Result(int targetSets, Lever lever, String change) {}

    public static Result decide(Input in) {
        if (in.week() <= 1) {
            return new Result(in.mev(), Lever.START, "MEV start (" + in.mev() + ")");
        }
        boolean earlyDeload = in.prevSets() >= in.mrv() && in.grind();
        if (in.deloadPhase() || earlyDeload) {
            int floor = (int) Math.ceil(in.mev() / 2.0);
            int target = Math.max(floor, round(in.prevSets(), in.deloadFraction()));
            return new Result(target, Lever.DELOAD,
                (in.deloadPhase() ? "Deload " : "Korai deload ") + in.prevSets() + " → " + target);
        }
        boolean targetHit = in.loggedLastWeek() >= in.prevSets();
        if (targetHit && !in.grind() && in.prevSets() < in.mrv()) {
            int target = Math.min(in.prevSets() + in.step(), in.mrv());
            return new Result(target, Lever.RAMP, "+" + (target - in.prevSets())
                + " (" + in.prevSets() + " → " + target + ")");
        }
        return new Result(in.prevSets(), Lever.HOLD, "tart (" + in.prevSets() + ")");
    }

    private static int round(int prev, BigDecimal frac) {
        return BigDecimal.valueOf(prev).multiply(frac).setScale(0, RoundingMode.HALF_UP).intValue();
    }
}
```

- [ ] **Step 4: Run — PASS** (6 tests).
- [ ] **Step 5: Commit** — `feat(train): pure weekly volume-target decider (mezo-hi9m)`.

---

### Task A4: `VolumeProgressionService.rolloverIfDue`

**Files:** Create `VolumeProgressionService.java`; test `VolumeProgressionServiceIT.java`.

**Interfaces:**
- **Consumes:** `MesocycleRepository`, `MuscleGroupVolumeLogRepository`, `WorkoutSessionRepository`, `ExerciseSetRepository`, `ExerciseRepository`, `VolumeProperties`, `MuscleGroup`, `VolumeDecider`.
- **Produces:** `void rolloverIfDue(UUID createdBy, MesocycleEntity meso)` — `@Transactional`, idempotent (DA3). On a due week it updates each muscle's `MuscleGroupVolumeLog.currentSets` + `source` provenance, sets `meso.currentWeek = calWeek`, writes `meso.volumeRecompute`. Package-visible helpers `int weekOf(LocalDate start, LocalDate date, int weeks)` and `int clampWeek(LocalDate start, int weeks)` (or reuse `TrainService`'s — extract to a shared util if cleaner).

- [ ] **Step 1: Failing IT** — seed an active meso whose calendar week (from `startDate`) is ahead of `volumeRecompute.lastRun`, with a completed prior-week instance logging ≥ the prior `currentSets` for a muscle; assert `currentSets` ramped by `step` and `currentWeek`/`lastRun` advanced; and a second call is a no-op (idempotent).

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
// … imports: AbstractIntegrationTest, TrainPopulator, VolumeProgressionService,
//   MuscleGroupVolumeLogRepository, entities, LocalDate, UUID …

class VolumeProgressionServiceIT extends AbstractIntegrationTest {
    @Autowired VolumeProgressionService svc;
    @Autowired TrainPopulator train;
    @Autowired io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository volumeRepo;
    // + mesocycleRepository via a getter/autowire

    @Test
    void testRollover_shouldRampMuscleAndAdvanceWeek_whenCalendarWeekIsAhead() {
        UUID owner = ownerId();
        // Active meso: startDate = 14 days ago, weeks=6 → calWeek=3; lastRun null; chest currentSets=14 (mev8/mav14/mrv20)
        var meso = train.activeMesoStartedWeeksAgo(owner, 2, 6, java.util.List.of("MEV","MEV","MAV","MAV","MRV","Deload"));
        train.createVolumeLog(owner, meso.getId(), "chest", 14);
        // A completed instance in week 2's window logging 14 chest working sets (targetHit, no grind):
        train.completedChestSetsInWeek(owner, meso, 2, 14, /*rir*/1, /*targetRir*/1);

        svc.rolloverIfDue(owner, reload(meso));

        var chest = volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, java.util.List.of(meso.getId()))
            .stream().filter(v -> v.getMuscle().equals("chest")).findFirst().orElseThrow();
        assertThat(chest.getCurrentSets()).isEqualTo(16);            // 14 + step(2)
        var after = reload(meso);
        assertThat(after.getCurrentWeek()).isEqualTo(3);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W3");

        // idempotent: a second rollover in the same week does nothing
        svc.rolloverIfDue(owner, reload(meso));
        var chest2 = /* re-read */ ; assertThat(chest2.getCurrentSets()).isEqualTo(16);
    }
    // ownerId(), reload(meso) helpers per the WorkoutTodayPrescriptionIT idiom
}
```

> The populator helpers `activeMesoStartedWeeksAgo(owner, weeksAgo, weeks, phaseCurve)`, `createVolumeLog(owner, mesoId, muscle, currentSets)` (**exists**, `TrainPopulator:120`), and `completedChestSetsInWeek(owner, meso, week, nSets, rir, targetRir)` are added to `TrainPopulator` (the last one builds a `"completed"` instance dated inside week `w`'s `startDate`-anchored window — use `createWorkoutInstance(owner, template, date, "completed")` + `createLoggedSet(...)`, since `completedInstanceWithSets` hardcodes `now()`). No new table → `ResetDatabase` unchanged.

- [ ] **Step 2: Run — FAIL** (`VolumeProgressionService` missing).
- [ ] **Step 3: Implement `VolumeProgressionService`** — `@Service @RequiredArgsConstructor`, method `@Transactional`:
  1. `calWeek = clampWeek(meso.startDate, meso.weeks)`; `lastWeek = parseW(meso.volumeRecompute?.lastRun())` (0 if null). If `calWeek <= lastWeek` → return.
  2. Load the meso's volume logs (`volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc`). Load last **completed** week's instances in `weekWindow(startDate, calWeek-1)` (`workoutSessionRepository.findDoneInstancesBetween`) → their working sets (`exerciseSetRepository` + `exerciseRepository` for muscle) → collapse `MuscleGroup.of(muscle)` → per-group `loggedLastWeek` count + `grind` flag (any exercise's latest working `rir ≤ targetRir - grindRirGap`).
  3. `deloadPhase = "Deload".equalsIgnoreCase(phaseFor(meso, calWeek))` (DA1: `phaseCurve.get(calWeek-1)`, bounds-checked).
  4. Per volume-log row: `VolumeDecider.decide(...)` → set `currentSets`, append a `VolumeRecomputeJson.Change(muscle, result.change(), reason, warning)` and update the row's `source` provenance note (keep `mev/mav/mrv`, set an `Adjustment` describing the weekly move). Save rows.
  5. `meso.setCurrentWeek(calWeek)`; `meso.setVolumeRecompute(new VolumeRecomputeJson("W"+calWeek, "W"+(calWeek+1), triggerLabel, changes))`; save meso.

  (Extract `clampWeek`/`weekOf`/`phaseFor` to a small shared helper or duplicate `TrainService.clampWeek` — reviewer will flag duplication; prefer a `MesoWeeks` util both call.)

- [ ] **Step 4: Run — PASS** (ramp + advance + idempotency). If the IT OOMs locally, compile-verify (`./mvnw -q clean test-compile`) + defer to CI, reporting DONE_WITH_CONCERNS.
- [ ] **Step 5: Commit** — `feat(train): weekly volume rollover engine (mezo-hi9m)`.

---

### Task A5: wire rollover + phase-index fix + effective sets into `getToday`

**Files:** Modify `WorkoutService.java`, `SetRecommendationService.java`. Test: extend `WorkoutTodayProgressionIT` (new cases) + a focused `VolumeEffectiveSetsIT`.

**Interfaces:**
- **Consumes:** `VolumeProgressionService` + `ObjectProvider<VolumeProgressionGate>` (new injected fields, mirror `hypertrophyGate`).
- **Produces:** `getToday` calls `volumeProgressionService.rolloverIfDue(createdBy, activeMeso)` right after `activeMeso` is resolved (before `deloadWeek`); the `deloadWeek`/phase read uses `phaseCurve.get(currentWeek - 1)` (DA1); each exercise's `workingSets` reflects the distributed effective count when the volume gate is on. `SetRecommendationService.prescribe(UUID, ExerciseEntity, boolean, int effectiveWorkingSets)` (new 4th param; the working loop uses `effectiveWorkingSets` instead of `ex.getWorkingSets()`).

- [ ] **Step 1: Failing IT** — with the volume switch on + a rolled-over meso where chest's `currentSets` exceeds the chest exercises' template sum, assert `getToday`'s chest exercises' `workingSets` distribute to the higher effective count; and assert the deload-phase week is detected at the correct (1-based−1) index. Also a switch-off case: template counts unchanged.

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — inject `volumeProgressionService` + `ObjectProvider<VolumeProgressionGate> volumeGate`. In `getToday`: after `activeMeso` (line ~105) add `if (activeMeso != null && volumeGate.getIfAvailable() != null) volumeProgressionService.rolloverIfDue(createdBy, activeMeso);` (own `@Transactional` bean — mirror the `WorkoutAutoCloseService`/`ClosingBlockService` self-invocation note). Re-read `activeMeso` after (its `currentWeek` may have changed) or have `rolloverIfDue` mutate the passed managed entity. Change `deloadWeek` (line ~152-159) to index `currentWeek - 1` (bounds-checked, DA1). In the exercise loop, when `volumeGate` on, compute `effective = distribute(currentSetsForGroup, groupExercises, thisExercise)` (proportional, remainder to largest) and pass it to `prescribe(...)` + `t.setWorkingSets(effective)`; when off, pass `e.getWorkingSets()`. Update `SetRecommendationService.prescribe` to accept the effective count (default overload keeps the old 3-arg for other callers, or update the sole caller).
- [ ] **Step 4: Run — PASS** + run `-Dtest='WorkoutTodayProgressionIT,WorkoutTodayPrescriptionIT,VolumeEffectiveSetsIT,SetRecommendationServiceIT'` (no regression to Plan-1 behavior; switch-off path identical).
- [ ] **Step 5: Commit** — `feat(train): getToday runs volume rollover + effective sets (mezo-hi9m)`.

> **Phase A ships here as its own PR** (self-PR → CI green → `--no-ff` merge). After merge, Phase B starts on a fresh branch off main.

---

## PHASE B — volume-arc endpoint + Mezociklus áttekintő + entry chips (its own PR)

### Task B1: API contract — volume-arc endpoint + schemas

**Files:** Modify `api/feature/train/train.yml`; regen.

**Interfaces — Produces (after regen):** `GET /api/train/mesocycles/{id}/volume-arc` (operationId `getMesocycleVolumeArc`) → `MesocycleVolumeArcResponse { mesocycleId, title, currentWeek, weeks, startDate, endDate, status, phaseCurve[], muscles: MuscleVolumeArc[] }`; `MuscleVolumeArc { muscle, region, mrv, weeks: VolumeArcWeek[] }`; `VolumeArcWeek { week, phase, planned, actual (nullable), isCurrent }`.

- [ ] **Step 1** Add the path (mirror `getWorkout`'s id-param GET, `ownerAuthHeaders`) + the 3 schemas (after `VolumeProfile`) in `train.yml`.
- [ ] **Step 2** Regen: `cd api/generate && npm run generate:api && cd ../../backend && ./mvnw -q clean generate-sources && cd ../frontend && pnpm generate:api`. Expected: generated `MesocycleVolumeArcResponse` etc. + FE types in `api.gen.ts`.
- [ ] **Step 3: Commit** — `git add api/ frontend/src/data/_client/api.gen.ts backend/pom.xml`; `feat(api): mesocycle volume-arc contract (mezo-hi9m)`.

### Task B2: backend arc service + endpoint

**Files:** Create `VolumeArcService.java`; modify `ExerciseSetRepository.java` (aggregation query), `TrainController.java`. Test: `VolumeArcContractIT` (extends `ApiIntegrationTest`).

**Interfaces — Produces:** `MesocycleVolumeArcResponse VolumeArcService.arc(UUID createdBy, UUID mesoId)` — `planned[w]` scaffold (DA7) + `actual[w]` from a new `ExerciseSetRepository` aggregation (working sets per `MuscleGroup.of(exercise.muscle)` per `startDate`-anchored week window, over completed instances of the meso). `TrainController` `@Override getMesocycleVolumeArc` delegates.

- [ ] **Step 1: Failing contract IT** — seed a meso with landmarks + a couple weeks of completed logged working sets; `getAuth("/api/train/mesocycles/{id}/volume-arc")` asserts a muscle's `weeks[currentWeek-1].actual` equals the logged count and future weeks carry `planned` with null `actual`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** the service (scaffold projection + actual aggregation reusing `MuscleGroup` + `MesoWeeks`), the repository aggregation query (`@Query` JOIN `ExerciseSetEntity`,`ExerciseEntity`,`WorkoutSessionEntity` filtered to the meso + completed + working, grouped by muscle + returning date so the service buckets by week), the controller `@Override`. Read-only; **not** gated by the switch (harmless read).
- [ ] **Step 4: Run — PASS** (or compile-verify + CI if OOM).
- [ ] **Step 5: Commit** — `feat(train): volume-arc service + endpoint (mezo-hi9m)`.

### Task B3: FE data — `useMesocycleVolumeArc` hook + types + mock

**Files:** Modify `data/types.ts`, `data/train/trainApi.ts`, `data/hooks.ts`, `data/train/train.ts`; create `data/train/mesoArcHooks.ts`.

**Interfaces — Produces:** domain `MesoVolumeArc`/`MuscleVolumeArc`/`VolumeArcWeek` types; `trainApi.mesocycleVolumeArc(id)`; `useMesocycleVolumeArc(id: string | null): { arc, pending, error }` (dual-mode, copy `useWorkoutDetail` shape — `enabled: mock || !!id`, `retry:false`), re-exported from `@/data/hooks`; mock derives the arc from the `train.ts` `volumePerMuscle` fixture (planned scaffold + a couple of `actual` weeks).

- [ ] Steps: types → api method → hook (mock branch derives from `mesocycles`/`activeMeso`) → re-export → mock fixture. Gate: `pnpm build`. Commit `feat(train): volume-arc FE hook + types + mock (mezo-hi9m)`.

### Task B4: `VolumeArcChart` component

**Files:** Create `features/train/components/VolumeArcChart.tsx` + `.test.tsx`.

**Interfaces — Consumes:** `MuscleVolumeArc` + `muscleColor`/`muscleRegion` (`logic/muscleColors.ts`). **Produces:** `<VolumeArcChart arc={MuscleVolumeArc} />` — per-week bars (actual solid in the muscle color, planned dashed, deload shorter/amber, current-week highlighted), `mrv` ceiling caption. Presentational; TDD render tests (actual vs planned vs deload vs current).

- [ ] Steps: failing render test (asserts an actual bar, a planned dashed bar, the current-week marker) → implement (mirror the approved mockup: bars + phase x-axis labels + legend) → PASS → commit `feat(train): VolumeArcChart component (mezo-hi9m)`.

### Task B5: `MesoOverviewPage` + route

**Files:** Create `features/train/pages/MesoOverviewPage.tsx` + `.test.tsx`; modify `app/router.tsx`.

**Interfaces — Consumes:** `useTrain().mesocycles.find` (meso lookup, mirror `MesocycleBuilderPage:28-33`), `useMesocycleVolumeArc(id)`, `PhaseCurveBars` (`size="lg"`), `VolumeArcChart`, a per-muscle switch (`muscleRegion` grouping). **Produces:** read-only page at `/train/mesocycles/:id/overview` — sticky breadcrumb (`← Gym`/back), progress header (title · `W{currentWeek}/{weeks}` · phase · `PhaseCurveBars` · start/weeks-remaining/end meta), then the per-muscle `VolumeArcChart` behind a muscle selector. Guards planned/archived (no landmarks) like `MesoVolume:44-50`.

- [ ] Steps: failing page test (`MemoryRouter` at `/train/mesocycles/meso-hyp-04/overview`, mock mode, asserts the header `W3/6` + an arc renders) → implement (reuse `statusEyebrow` copy + `PhaseCurveBars`) → add route in `router.tsx` after the `:id` builder route → PASS (both modes) → commit `feat(train): Mezociklus áttekintő overview page + route (mezo-hi9m)`.

### Task B6: Mai + Gym entry chips

**Files:** Modify `GymPage.tsx` (+ test), `TrainTodayPage.tsx` (+ test).

**Interfaces — Produces:** GymPage header cluster gains a `📈 Mezociklus W{n}/{N} →` chip (only when `activeMeso`) → `navigate('/train/mesocycles/{id}/overview')`; TrainTodayPage gains a `🗓 {title} · {phase} · W{n}/{N} →` card-chip below the header (active-meso only; the no-meso ghost branch keeps its existing `+ Tervezz mesociklust`). Nav-assertion tests via the `mockNavigate` idiom (`GymPage.test.tsx:13-17`).

- [ ] Steps: failing nav tests → implement both chips → PASS (both modes: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`) → commit `feat(train): Mai + Gym volume-arc entry chips (mezo-hi9m)`.

### Task B7: docs

**Files:** Modify `docs/features/train.md` (§2 the new overview surface + Mai/Gym chips; §4 the rollover engine + effective sets + volume-arc endpoint; remove the "seed-only volume / volume-recompute provenance seed-only" caveats now that the rollover writes them live), `docs/milestones/roadmap.md`.

- [ ] Steps: edit the living doc (overwrite-in-place, no changelog); `node scripts/lint-docs.mjs` clears train.md staleness; commit `docs(train): document volume engine + Mezociklus áttekintő (mezo-hi9m)`.

> **Phase B ships as its own PR** after Phase A merges.

---

## Self-Review

**Spec coverage:** §5.2 volume ramp → A3/A4; deload (planned + early) → DA4/A4; bounded [MEV,MRV] → DA4; rollover/currentWeek (§11 #1) → DA3/A4/A5; meso-week bucketing (§11 #2) → DA2; effective-set distribution (§11 #3, D6) → DA6/A5; deload resume (§11 #4) → DA4 (`max(⌈mev/2⌉, round·fraction)`); §5.3 arc (planned+actual) → DA7/B2; §7 endpoint → B1/B2; §8 overview + chips → B4/B5/B6; D10 switch/config → A1/DA8; D13 mock parity → B3 + A4 no-op. Zone→group taxonomy gap (not in spec, discovered in mapping) → DA5/A2.

**Placeholder scan:** the IT bodies in A4/A5/B2/B5 give the seed intent + assertions but abbreviate imports/populator helpers with a named `>` note (the helper to add + why) rather than full code — acceptable because the exact populator additions depend on `TrainPopulator`'s current signatures (mapped: `createVolumeLog`, `createWorkoutInstance(date)`, `createLoggedSet` exist; the dated-week wrappers are the only net-new). The pure units (A2/A3) + config (A1) carry complete code. No `TBD`/`TODO`.

**Type consistency:** `VolumeDecider.Input/Result/Lever` used only in A3/A4. `prescribe(…, effectiveWorkingSets)` 4-arg used only in A5 (sole caller `getToday`). Arc DTO names (`MesocycleVolumeArcResponse`/`MuscleVolumeArc`/`VolumeArcWeek`) consistent across B1→B2→B3. `MuscleGroup.of` used by A4 + B2.

**Known latent-bug fix folded in (DA1):** `getToday`'s `phaseCurve.get(currentWeek)` is 0-based against a 1-based `currentWeek` — a pre-existing off-by-one (Plan 1). A5 corrects it to `currentWeek - 1`. Flag to the reviewer as an intentional behavior fix.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-progressive-overload-p2-volume-overview.md`. It ships in **two PRs (Phase A, then Phase B)**. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, Phase A → PR → CI green → merge, then Phase B.
2. **Inline Execution** — batch with checkpoints.

Which approach? (Or review the plan first.)
