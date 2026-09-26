# Unified Activity-Energy Model + „Célod” row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four divergent, gross-MET activity-kcal calculators with one net-of-rest Compendium-2024 model. The same model feeds the sport/run log, Train, the weekly plan (goal TDEE) and ONE served daily target: the weekly base plus the day-type shift plus same-day credit for unplanned movement. The Fuel equation box shows a „Célod” row so the arithmetic closes.

**Architecture:**
- **Backend `train`** owns a config-driven `ActivityEnergyModel`: `(MET−1) × BMR/24 × h`, with the band picked from RPE.
- `WorkoutWindowQueryService.movementOn` decides whether the day's planned training happened and how many kcal of unplanned movement it holds.
- **Backend `nutrition`'s `DayTargetProjector`** stays the single target rule. It now also returns an energy breakdown, which the Fuel day contract carries.
- **Frontend:** a mirror module (`data/train/activityEnergy.ts`) serves planned previews only. A shared golden-vector JSON binds FE and BE. Fuel Mai stops computing its own target.

**Tech Stack:** Spring Boot 3 / Java 21 / JPA / Liquibase / OpenAPI codegen (backend); React + TS + TanStack Query + vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-09-26-activity-energy-model-design.md` (owner-approved). **Bead:** `mezo-32m82`. **Branch:** `feat/activity-energy-model` (already created, spec committed).

## Global Constraints

- Formula: `netKcal = (MET − 1) × restKcalPerHour × hours`.
  - `restKcalPerHour = BMR/24`, else `1.0 × weightKg`, else empty.
  - Result rounded HALF_UP to an int. Duration ≤ 0 gives empty. A missing value is never stored or shown as 0.
- Bands: RPE 1–4 = `light`, 5–7 = `moderate`, 8–10 = `hard`. A null RPE and every planned slot count as `moderate`. Unknown sport kind → `other`.
- MET table (light / moderate / hard):

  | Kind | light | moderate | hard |
  |---|---|---|---|
  | gym | 3.5 | 3.5 | 5.0 |
  | volleyball | 3.0 | 4.0 | 6.0 |
  | football | 5.0 | 7.0 | 9.5 |
  | basketball | 4.5 | 6.5 | 8.0 |
  | tennis | 5.0 | 7.0 | 8.0 |
  | trx | 3.0 | 4.5 | 6.5 |
  | cross | 4.0 | 5.8 | 8.0 |
  | swim | 5.8 | 8.3 | 9.8 |
  | bike | 5.8 | 6.8 | 8.0 |
  | hike | 5.3 | 6.0 | 7.8 |
  | run | 7.5 | 9.3 | 10.5 |
  | other | 3.0 | 4.0 | 6.0 |

- Default durations: gym 60′ (when there is no timing profile), run 45′. The 40′ constants are removed everywhere.
- A user-typed session kcal is **active (net) kcal**: stored verbatim with `kcal_is_estimate=false`. The FE never re-estimates a logged session.
- Served target:
  ```
  target = max(BMR, dayKcal + extraKcal)
  carbs  = segCarbs + round((target − seg.kcal)/4)
  ```
  - `dayKcal` is `trainingDayKcal` if a planned session was logged, else `restDayKcal`. When the segment has no split, it is `seg.kcal`.
- Owner-facing copy is Hungarian. Numbers use the house `huInt` (thin-space thousands, Unicode minus U+2212).
- Üveg canon for UI: Titanium sprite icons only (no emoji), one accent token per `fmx-node`, dark only.
- Tests:
  - FE tests run in BOTH modes: `CI=true VITE_USE_MOCK=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test`. File filters after `--` do not scope.
  - BE focused ITs: `./mvnw -q -Dtest=<Class> test -Dmezo.test.use-testcontainers=true`.
- `node scripts/gen-codemap.mjs` after adding or renaming a service or logic file. Commit subjects carry `(mezo-32m82)`.

---

## File map

**Backend (create)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyModel.java`: the model (component, config-driven).
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyModelTest.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyVectorsTest.java`: the golden-vector guard.
- `api/fixtures/activity-energy-vectors.json`: shared golden vectors.
- `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/EnergyBase.java`: the `bmr` + `neatBaseline` carrier.
- `backend/src/main/java/io/mrkuhne/mezo/feature/goal/ActivityModelMigrationRunner.java`
- `backend/src/main/resources/db/changelog/1.0.0/script/202609261400_mezo-32m82_reset_estimated_kcal.sql`

**Backend (modify)**
- `train/config/TrainProperties.java`: `Met met` → `Energy energy`.
- `application.yml` (~2643–2651): the `mezo.train.energy` table.
- `train/service/AthleteBodyPort.java`: `AthleteBody` gains `bmrKcal`.
- `biometrics/profile/service/TrainAthleteBodyAdapter.java`: fills `bmrKcal`.
- `goal/engine/service/TdeeBootstrapService.java`: public `bmr(profile, weight)`; writes `activityModel`.
- `goal/entity/TdeeBootstrapJson.java`: `+ Integer activityModel`.
- `train/service/SportService.java:98-115`, `train/service/RunningService.java:158-170`: use the model.
- `train/service/WeeklyScheduledActivityService.java`: uses the model plus `restKcalPerHour`.
- Callers of the weekly service:
  - `goal/engine/service/GoalPrescriptionCalculator.java:72`
  - `goal/engine/service/GoalProjectionService.java:286-289` (plus the plumbing of the `restKcalPerHour` arg)
  - `biometrics/profile/service/BiometricProfileService.java:110`
- `train/service/WorkoutWindowQueryService.java`: `DayMovement movementOn(userId, date)`.
- `nutrition/service/DayTargetProjector.java`, `nutrition/service/DailyTargets.java`: energy breakdown.
- Callers of the projector:
  - `meal/service/FuelDayService.java`
  - `nutrition/service/DietSettingsService.java:95`
  - `character/service/CharacterSignalReads.java:724`
- `api/feature/meal/meal.yml`: the `FuelDayEnergy` schema on `FuelDayResponse` + `FuelDayRollup`.
- `goal/repository/GoalRepository.java`: `findByStatusNotAndDeletedFalse`.
- `train/repository/SportSessionRepository.java`, `RunSessionLogRepository.java`: finders for rows needing an estimate.
- `db/changelog/1.0.0/1.0.0_master.yml`: the changeset entry.

**Backend (delete)**
- `train/service/SportEnergyCalculator.java` and its test.

**Frontend (create)**
- `frontend/src/data/train/activityEnergy.ts` + `activityEnergy.test.ts`

**Frontend (modify)**
- `data/fuel/fuelConfig.ts`: remove `MET_BY_KIND` and `DEFAULT_RUN_MIN`; the run default moves to `activityEnergy`.
- `data/fuel/metDriftGuard.test.ts`: delete.
- `features/fuel/logic/buildDayPlan.ts`:
  - `blockKcal`/`activityKcal` go.
  - The `deriveDailyBudget` dynamic path → `servedBudget`.
  - `PlannerBlock` gains `sport?`.
- `features/fuel/logic/buildProtocol.ts`: sport blocks carry `sport`.
- `features/fuel/logic/dayZones.ts`, `features/fuel/logic/buildEnergyBreakdown.ts`
- `data/fuel/timelineHooks.ts`, `data/fuel/fuelHooks.ts` + the `FuelDay` type in `data/types.ts`
- `features/fuel/logic/keretHero.ts`, `features/fuel/components/FuelEnergyHero.tsx`
- `features/train/logic/trainDayEnergy.ts`, `features/train/logic/loadWeek.ts`
- Train pages: `features/train/pages/TrainTodayPage.tsx`, `ActiveWorkoutPage.tsx`, `TrainWeekMozgasPage.tsx`
- `features/train/pages/SportLogPage.tsx`: the override label.
- Mock and fixtures:
  - `data/fuel/*` seed day (`seedDayData`)
  - `test/msw/handlers.ts` (fuel day energy + `tdeeBootstrap`)
  - `data/me/goals.ts:170`
  - `data/train/trainHooks.ts:514` (`mockSportKcal`)
  - `data/train/running.ts:95` (`mockRunKcal`)

**Docs**
- `docs/features/fuel.md`, `train.md`, `goal-engine.md`, `me.md`
- `docs/CODEMAP.md` (regenerated)

---

### Task 1: `ActivityEnergyModel` + config + golden vectors (backend)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyModel.java`
- Create: `api/fixtures/activity-energy-vectors.json`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyModelTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyVectorsTest.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TrainProperties.java`
- Modify: `backend/src/main/resources/application.yml:2643-2651`

**Interfaces:**
- Produces:
  - `ActivityEnergyModel` (Spring `@Component` in `..train.service`) with:
    - `public static final int VERSION = 2;`
    - `public static Optional<BigDecimal> restKcalPerHour(BigDecimal bmrKcal, BigDecimal weightKg)`
    - `public static String band(Integer rpe)`, returning `"light" | "moderate" | "hard"`
    - `public double met(String kind, Integer rpe)`
    - `public Optional<Integer> netKcal(String kind, Integer rpe, int durationMin, BigDecimal restKcalPerHour)`
  - `TrainProperties.energy().met()`, of type `Map<String, TrainProperties.MetBand>`.
  - `TrainProperties.MetBand(Double light, Double moderate, Double hard)`.

- [ ] **Step 1: Verify the MET table against the source.** Open https://pacompendium.com/conditioning-exercise/, https://pacompendium.com/sports/, https://pacompendium.com/running/, https://pacompendium.com/bicycling/, https://pacompendium.com/water-activities/ and https://pacompendium.com/walking/. For every cell of the Global Constraints table, record the matching Compendium code in the yml comment written in Step 5.
  - If a value differs by more than 0.5 MET from the site, **stop and report back to the controller**. Do not silently change owner-approved numbers.
  - The golden vectors below assume the table exactly.

- [ ] **Step 2: Write the golden vectors.** Create `api/fixtures/activity-energy-vectors.json`. `restKcalPerHour` 80 is `bmr` 1920 / 24.

```json
{
  "comment": "Shared FE↔BE golden vectors for the activity-energy model (mezo-32m82). netKcal = round((MET-1) × restKcalPerHour × min/60). Both ActivityEnergyVectorsTest (BE) and activityEnergy.test.ts (FE) assert every row. Change the model → change this file → both sides must follow.",
  "restKcalPerHour": [
    { "bmr": 1920, "weightKg": 80, "expected": 80.0 },
    { "bmr": null, "weightKg": 80, "expected": 80.0 },
    { "bmr": null, "weightKg": null, "expected": null }
  ],
  "netKcal": [
    { "kind": "gym",        "rpe": null, "min": 60,  "rest": 80, "expected": 200 },
    { "kind": "gym",        "rpe": 9,    "min": 60,  "rest": 80, "expected": 320 },
    { "kind": "volleyball", "rpe": 7,    "min": 120, "rest": 80, "expected": 480 },
    { "kind": "volleyball", "rpe": 3,    "min": 90,  "rest": 80, "expected": 240 },
    { "kind": "volleyball", "rpe": 9,    "min": 90,  "rest": 80, "expected": 600 },
    { "kind": "volleyball", "rpe": null, "min": 60,  "rest": 80, "expected": 240 },
    { "kind": "football",   "rpe": null, "min": 60,  "rest": 80, "expected": 480 },
    { "kind": "basketball", "rpe": null, "min": 60,  "rest": 80, "expected": 440 },
    { "kind": "tennis",     "rpe": null, "min": 60,  "rest": 80, "expected": 480 },
    { "kind": "trx",        "rpe": null, "min": 60,  "rest": 80, "expected": 280 },
    { "kind": "cross",      "rpe": null, "min": 60,  "rest": 80, "expected": 384 },
    { "kind": "swim",       "rpe": 8,    "min": 30,  "rest": 80, "expected": 352 },
    { "kind": "bike",       "rpe": null, "min": 60,  "rest": 80, "expected": 464 },
    { "kind": "hike",       "rpe": null, "min": 60,  "rest": 80, "expected": 400 },
    { "kind": "run",        "rpe": null, "min": 45,  "rest": 80, "expected": 498 },
    { "kind": "other",      "rpe": null, "min": 60,  "rest": 80, "expected": 240 },
    { "kind": "kajak",      "rpe": null, "min": 60,  "rest": 80, "expected": 240 },
    { "kind": "volleyball", "rpe": 7,    "min": 140, "rest": 81.8, "expected": 573 },
    { "kind": "volleyball", "rpe": 7,    "min": 0,   "rest": 80, "expected": null },
    { "kind": "volleyball", "rpe": 7,    "min": 60,  "rest": null, "expected": null }
  ]
}
```

- [ ] **Step 3: Write the failing unit test** in `ActivityEnergyModelTest.java`. It builds the model from a hand-made `TrainProperties`, so it needs no Spring context:

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ActivityEnergyModelTest {

    static TrainProperties props() {
        Map<String, TrainProperties.MetBand> met = Map.ofEntries(
            Map.entry("gym", new TrainProperties.MetBand(3.5, 3.5, 5.0)),
            Map.entry("volleyball", new TrainProperties.MetBand(3.0, 4.0, 6.0)),
            Map.entry("football", new TrainProperties.MetBand(5.0, 7.0, 9.5)),
            Map.entry("basketball", new TrainProperties.MetBand(4.5, 6.5, 8.0)),
            Map.entry("tennis", new TrainProperties.MetBand(5.0, 7.0, 8.0)),
            Map.entry("trx", new TrainProperties.MetBand(3.0, 4.5, 6.5)),
            Map.entry("cross", new TrainProperties.MetBand(4.0, 5.8, 8.0)),
            Map.entry("swim", new TrainProperties.MetBand(5.8, 8.3, 9.8)),
            Map.entry("bike", new TrainProperties.MetBand(5.8, 6.8, 8.0)),
            Map.entry("hike", new TrainProperties.MetBand(5.3, 6.0, 7.8)),
            Map.entry("run", new TrainProperties.MetBand(7.5, 9.3, 10.5)),
            Map.entry("other", new TrainProperties.MetBand(3.0, 4.0, 6.0)));
        return new TrainProperties(new TrainProperties.Energy(met), 60, 45, 400);
    }

    private final ActivityEnergyModel model = new ActivityEnergyModel(props());

    @Test
    void bandFollowsRpe() {
        assertThat(ActivityEnergyModel.band(null)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(1)).isEqualTo("light");
        assertThat(ActivityEnergyModel.band(4)).isEqualTo("light");
        assertThat(ActivityEnergyModel.band(5)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(7)).isEqualTo("moderate");
        assertThat(ActivityEnergyModel.band(8)).isEqualTo("hard");
        assertThat(ActivityEnergyModel.band(10)).isEqualTo("hard");
    }

    @Test
    void restPerHourPrefersBmrThenWeight() {
        assertThat(ActivityEnergyModel.restKcalPerHour(new BigDecimal("1920"), new BigDecimal("80")))
            .hasValueSatisfying(v -> assertThat(v.doubleValue()).isEqualTo(80.0, within(1e-9)));
        assertThat(ActivityEnergyModel.restKcalPerHour(null, new BigDecimal("72.5")))
            .hasValueSatisfying(v -> assertThat(v.doubleValue()).isEqualTo(72.5, within(1e-9)));
        assertThat(ActivityEnergyModel.restKcalPerHour(null, null)).isEmpty();
    }

    @Test
    void netKcalIsAboveRestOnly() {
        // (4.0 − 1) × 80 × 2 h = 480 — gross would have been 640
        assertThat(model.netKcal("volleyball", 7, 120, new BigDecimal("80"))).contains(480);
    }

    @Test
    void unknownKindFallsBackToOther() {
        assertThat(model.met("kajak", null)).isEqualTo(4.0);
        assertThat(model.met(null, null)).isEqualTo(4.0);
    }

    @Test
    void honestEmptyNeverZero() {
        assertThat(model.netKcal("gym", null, 0, new BigDecimal("80"))).isEmpty();
        assertThat(model.netKcal("gym", null, -5, new BigDecimal("80"))).isEmpty();
        assertThat(model.netKcal("gym", null, 60, null)).isEmpty();
    }
}
```

- [ ] **Step 4: Write the failing vector test** in `ActivityEnergyVectorsTest.java`. The backend tests run from `backend/`, so the file lives at `../api/fixtures/...`:

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** FE↔BE drift guard (mezo-32m82): the same vectors are asserted by frontend activityEnergy.test.ts. */
class ActivityEnergyVectorsTest {

    private static final File VECTORS = new File("../api/fixtures/activity-energy-vectors.json");
    private final ActivityEnergyModel model = new ActivityEnergyModel(ActivityEnergyModelTest.props());

    private static BigDecimal dec(JsonNode n) {
        return n == null || n.isNull() ? null : n.decimalValue();
    }

    @Test
    void everyVectorHolds() throws Exception {
        JsonNode root = new ObjectMapper().readTree(VECTORS);
        for (JsonNode v : root.get("restKcalPerHour")) {
            Optional<BigDecimal> got = ActivityEnergyModel.restKcalPerHour(dec(v.get("bmr")), dec(v.get("weightKg")));
            if (v.get("expected").isNull()) {
                assertThat(got).as(v.toString()).isEmpty();
            } else {
                assertThat(got.orElseThrow().doubleValue()).as(v.toString()).isEqualTo(v.get("expected").asDouble());
            }
        }
        for (JsonNode v : root.get("netKcal")) {
            Integer rpe = v.get("rpe").isNull() ? null : v.get("rpe").asInt();
            Optional<Integer> got = model.netKcal(v.get("kind").asText(), rpe, v.get("min").asInt(), dec(v.get("rest")));
            if (v.get("expected").isNull()) {
                assertThat(got).as(v.toString()).isEmpty();
            } else {
                assertThat(got).as(v.toString()).contains(v.get("expected").asInt());
            }
        }
    }
}
```

- [ ] **Step 5: Change the config.** In `TrainProperties.java`, replace the `Met met` component and the nested `Met` record:

```java
@Validated
@ConfigurationProperties(prefix = "mezo.train")
public record TrainProperties(
    @NotNull @Valid Energy energy,
    @NotNull @Positive Integer gymDefaultMinutes,   // gym slots carry no duration → default 60
    @NotNull @Positive Integer runDefaultMinutes,    // run with no duration → 45 (FE activityEnergy DEFAULT_RUN_MIN)
    @NotNull @Positive Integer sportSessionMaxSpanDays
) {
    /** The net activity-energy model's MET table (mezo-32m82): kind → band → MET, Compendium 2024. */
    public record Energy(@NotNull Map<String, @Valid MetBand> met) {}

    /** One kind's MET at the three felt-effort bands (RPE 1–4 / 5–7 / 8–10). */
    public record MetBand(@NotNull @Positive Double light, @NotNull @Positive Double moderate,
                          @NotNull @Positive Double hard) {}
}
```

Then replace the `met:` block in `application.yml` (lines ~2647–2651). Keep the comments: each one names the Compendium code that Step 1 recorded.

```yaml
    energy:                        # net activity-energy model (mezo-32m82): kcal = (MET−1) × BMR/24 × h
      met:                         # 2024 Adult Compendium (pacompendium.com); light / moderate / hard = RPE 1–4 / 5–7 / 8–10
        gym:        { light: 3.5, moderate: 3.5, hard: 5.0 }   # 02054 multiple exercises 8–15 reps; 02052 squats/deadlifts
        volleyball: { light: 3.0, moderate: 4.0, hard: 6.0 }   # 15720 non-competitive; 15710 general; 15711 competitive
        football:   { light: 5.0, moderate: 7.0, hard: 9.5 }
        basketball: { light: 4.5, moderate: 6.5, hard: 8.0 }
        tennis:     { light: 5.0, moderate: 7.0, hard: 8.0 }
        trx:        { light: 3.0, moderate: 4.5, hard: 6.5 }
        cross:      { light: 4.0, moderate: 5.8, hard: 8.0 }
        swim:       { light: 5.8, moderate: 8.3, hard: 9.8 }
        bike:       { light: 5.8, moderate: 6.8, hard: 8.0 }
        hike:       { light: 5.3, moderate: 6.0, hard: 7.8 }
        run:        { light: 7.5, moderate: 9.3, hard: 10.5 }
        other:      { light: 3.0, moderate: 4.0, hard: 6.0 }
```

Also grep the test resources for `mezo.train.met` or `met:` overrides (`grep -rn "train:" -A6 backend/src/test/resources`) and convert them the same way.

- [ ] **Step 6: Implement the model** in `ActivityEnergyModel.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The ONE activity-energy model (mezo-32m82): net-of-rest kcal from the 2024 Adult Compendium.
 * {@code kcal = (MET − 1) × restKcalPerHour × hours}. The "−1" removes the resting energy that
 * BMR × NEAT already bills for all 24 hours (gross MET double-counted it). {@code restKcalPerHour}
 * is the person's own BMR / 24 — the Compendium's "corrected MET" (Byrne 2005), which replaces the
 * old sex/age/lean personal factor. Whole-session codes already include rests between sets or
 * rallies, so the duration is the whole session, never discounted.
 *
 * <p>Honest-null: unknown rest energy or a non-positive duration → {@link Optional#empty()}, never 0.
 * The frontend mirror ({@code data/train/activityEnergy.ts}) is bound to this class by the shared
 * golden vectors in {@code api/fixtures/activity-energy-vectors.json}.
 */
@Component
public class ActivityEnergyModel {

    /** Written into {@code tdee_bootstrap.activityModel}; the migration runner recomputes goals below it. */
    public static final int VERSION = 2;

    private static final String OTHER = "other";
    private static final BigDecimal HOURS_PER_DAY = BigDecimal.valueOf(24);

    private final TrainProperties props;

    public ActivityEnergyModel(TrainProperties props) {
        this.props = props;
    }

    /** BMR / 24 when the BMR is known, else 1 kcal per kg per hour, else empty. */
    public static Optional<BigDecimal> restKcalPerHour(BigDecimal bmrKcal, BigDecimal weightKg) {
        if (bmrKcal != null && bmrKcal.signum() > 0) {
            return Optional.of(bmrKcal.divide(HOURS_PER_DAY, MathContext.DECIMAL64));
        }
        if (weightKg != null && weightKg.signum() > 0) {
            return Optional.of(weightKg);
        }
        return Optional.empty();
    }

    /** RPE 1–4 light, 5–7 moderate, 8–10 hard; null (and every planned slot) = moderate. */
    public static String band(Integer rpe) {
        if (rpe == null) {
            return "moderate";
        }
        if (rpe <= 4) {
            return "light";
        }
        return rpe <= 7 ? "moderate" : "hard";
    }

    /** The MET of {@code kind} at the RPE's band; an unknown kind reads as {@code other}. */
    public double met(String kind, Integer rpe) {
        TrainProperties.MetBand row = props.energy().met().get(kind);
        if (row == null) {
            row = props.energy().met().get(OTHER);
        }
        return switch (band(rpe)) {
            case "light" -> row.light();
            case "hard" -> row.hard();
            default -> row.moderate();
        };
    }

    /** Net kcal of one session, or empty when the rest energy or a positive duration is unknown. */
    public Optional<Integer> netKcal(String kind, Integer rpe, int durationMin, BigDecimal restKcalPerHour) {
        if (restKcalPerHour == null || durationMin <= 0) {
            return Optional.empty();
        }
        BigDecimal kcal = BigDecimal.valueOf(met(kind, rpe) - 1)
            .multiply(restKcalPerHour)
            .multiply(BigDecimal.valueOf(durationMin))
            .divide(BigDecimal.valueOf(60), MathContext.DECIMAL64);
        return Optional.of(kcal.setScale(0, RoundingMode.HALF_UP).intValueExact());
    }
}
```

- [ ] **Step 7: Run both tests.** They must PASS:

```bash
cd backend && ./mvnw -q -Dtest='ActivityEnergyModelTest,ActivityEnergyVectorsTest' test
```

`WeeklyScheduledActivityService` still calls `props.met()`, so the compile will fail there. Temporarily bridge it in this task: change `blockKcal`'s switch to read `props.energy().met().get(kind).moderate()`, falling back to `other`. Task 3 rewrites it properly. Re-run until the build compiles and both tests pass.

- [ ] **Step 8: Commit.**

```bash
git add api/fixtures backend/src/main/java/io/mrkuhne/mezo/feature/train backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergy*
git commit -m "feat(train): net Compendium-2024 ActivityEnergyModel + shared golden vectors (mezo-32m82)"
```

---

### Task 2: Logged sessions use the model (sport + run), BMR on the body port

**Files:**
- Modify: `train/service/AthleteBodyPort.java`, `biometrics/profile/service/TrainAthleteBodyAdapter.java`
- Modify: `goal/engine/service/TdeeBootstrapService.java` (extract a public `bmr`)
- Modify: `train/service/SportService.java:92-115`, `train/service/RunningService.java:150-170`, the entity Javadocs `SportSessionEntity.java:77`, `RunSessionLogEntity.java:71`
- Delete: `train/service/SportEnergyCalculator.java`, `backend/src/test/java/.../train/service/SportEnergyCalculatorTest.java`
- Test: the existing `SportServiceIT` and `RunningService*IT` (find them with `ls backend/src/test/java/io/mrkuhne/mezo/feature/train/service | grep -i -E "sport|run"`)

**Interfaces:**
- Consumes: `ActivityEnergyModel.netKcal`, `ActivityEnergyModel.restKcalPerHour` (Task 1).
- Produces:
  - `AthleteBodyPort.AthleteBody(BigDecimal weightKg, String sex, int age, BigDecimal bodyFatPct, BigDecimal bmrKcal)`, where `bmrKcal` is the BMR at the latest weight (Katch when body fat is known, else Mifflin).
  - `TdeeBootstrapService.bmr(BiometricProfileEntity profile, BigDecimal weightKg): BigDecimal` (public, unscaled).
  - `SportService.reestimateMissing(): int` and `RunningService.reestimateMissing(): int`. Both re-estimate every non-deleted row with `kcal IS NULL AND duration_min > 0` and return the count. Task 6 uses them.

- [ ] **Step 1: Write the failing IT expectations.** In the sport-service IT, find the test asserting the persisted estimate (grep `kcalIsEstimate` / `getKcal()` in `SportServiceIT`). Replace its expected number with the net value computed from the IT's own fixture body.
  - Example: the fixture profile is M, 80 kg, height H, birthdate B, body fat F. Compute `bmr = 370 + 21.6 × 80 × (1 − F/100)` (Katch) or Mifflin when body fat is null.
  - The session is volleyball RPE 7, 90′, so the expectation is `round(3.0 × bmr/24 × 1.5)`.
  - Write that arithmetic as a Java expression in the assertion, not as a magic literal.
  - Add a case: `kcalOverride = 350` is stored verbatim with `kcalIsEstimate=false`. It is already covered; keep it.
  - Do the same for the run-log IT: `round(8.3 × bmr/24 × durationMin/60)` (moderate).

Run: `cd backend && ./mvnw -q -Dtest='SportServiceIT' test -Dmezo.test.use-testcontainers=true`. Expected: FAIL on the new number.

- [ ] **Step 2: Extract the BMR.** In `TdeeBootstrapService`, move the Katch/Mifflin branch into:

```java
    /** BMR (kcal/day): Katch-McArdle when body-fat % is known, else Mifflin-St Jeor. Unscaled. */
    public BigDecimal bmr(BiometricProfileEntity profile, BigDecimal weightKg) {
        if (profile.getBodyFatPct() != null) {
            return katchMcArdle(weightKg, profile.getBodyFatPct());
        }
        return mifflinStJeor(weightKg, profile.getHeightCm(), ageYears(profile.getBirthDate()), profile.getSex());
    }
```

Make `compute` call it: keep `formula` chosen by the same `bodyFatPct != null` test.

- [ ] **Step 3: Carry the BMR on the body port.** Add `BigDecimal bmrKcal` as the last component of `AthleteBody`, with Javadoc: "the BMR at the latest weigh-in (Katch/Mifflin, {@code TdeeBootstrapService#bmr}) — the activity model's rest-energy basis". In `TrainAthleteBodyAdapter`, inject `TdeeBootstrapService` and pass `tdeeBootstrapService.bmr(profile, weight.getWeightKg())`.
  - biometrics already imports goal's `TdeeBootstrapService` (`BiometricProfileService.java:12`), so no new slice edge appears.
  - Fix every other `new AthleteBody(` call site (`grep -rn "new AthleteBody\|AthleteBody(" backend/src`), including test stubs. Pass a BMR in tests, for example `new BigDecimal("1920")`.

- [ ] **Step 4: Switch `SportService.applyKcal`** to the model. Inject `ActivityEnergyModel activityEnergyModel`, then:

```java
    private void applyKcal(UUID createdBy, SportSessionEntity s, Integer kcalOverride) {
        if (kcalOverride != null) {
            // A user-typed number is ACTIVE (net) kcal — a watch's "active calories" — stored verbatim.
            s.setKcal(kcalOverride);
            s.setKcalIsEstimate(false);
            return;
        }
        estimate(createdBy, s);
    }

    /** The net model estimate (mezo-32m82); NULL (never 0) when the body or the duration is unknown. */
    private void estimate(UUID createdBy, SportSessionEntity s) {
        Integer rpe = s.getRpe() != null ? s.getRpe().intValue() : null;
        int minutes = s.getDurationMin() != null ? s.getDurationMin() : 0;
        athleteBodyPort.bodyAt(createdBy, s.getDate())
            .flatMap(body -> ActivityEnergyModel.restKcalPerHour(body.bmrKcal(), body.weightKg()))
            .flatMap(rest -> activityEnergyModel.netKcal(s.getSport(), rpe, minutes, rest))
            .ifPresent(kcal -> {
                s.setKcal(kcal);
                s.setKcalIsEstimate(true);
            });
    }

    /** One-shot catch-up (mezo-32m82 migration): estimate every live row still missing kcal. */
    @Transactional
    public int reestimateMissing() {
        List<SportSessionEntity> rows = sessionRepository.findByDeletedFalseAndKcalIsNullAndDurationMinGreaterThan(0);
        rows.forEach(s -> estimate(s.getCreatedBy(), s));
        return (int) rows.stream().filter(s -> s.getKcal() != null).count();
    }
```

Use the repository field name the class already has. Add the derived finder to `SportSessionRepository`:

```java
    List<SportSessionEntity> findByDeletedFalseAndKcalIsNullAndDurationMinGreaterThan(int minutes);
```

- [ ] **Step 5: Switch `RunningService.applyKcal` the same way.** Use kind `"run"`, and RPE from the log's RPE field if the entity has one (`grep -n "rpe" RunSessionLogEntity.java`), else `null`. Delete `ASSUMED_RUN_KMH` and its Javadoc paragraph. Add `reestimateMissing()` plus the finder `findByDeletedFalseAndKcalIsNullAndDurationMinGreaterThan(int)` on `RunSessionLogRepository`, mirroring Step 4.

- [ ] **Step 6: Delete the old calculator.** Delete `SportEnergyCalculator.java` and `SportEnergyCalculatorTest.java`. Update the two entity Javadocs to say "net activity-energy estimate (`ActivityEnergyModel`, mezo-32m82); a user-typed value is active (net) kcal". `grep -rn SportEnergyCalculator backend/src` must return nothing.

- [ ] **Step 7: Run the tests.** Expected: PASS.

```bash
cd backend && ./mvnw -q -Dtest='SportServiceIT,RunningService*IT,ActivityEnergy*Test' test -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 8: Commit.**

```bash
git add -A backend && git commit -m "feat(train): logged sport/run kcal from the net model; BMR on AthleteBodyPort (mezo-32m82)"
```

---

### Task 3: Weekly plan energy uses the model (goal TDEE)

**Files:**
- Modify: `train/service/WeeklyScheduledActivityService.java`
- Modify the callers:
  - `goal/engine/service/GoalPrescriptionCalculator.java:70-74`
  - `goal/engine/service/GoalProjectionService.java:280-290` (plus the signature chain that brings `bootstrap` in, which is already a parameter of `buildSegment`)
  - `biometrics/profile/service/BiometricProfileService.java:105-112`
- Modify: `goal/entity/TdeeBootstrapJson.java`, `TdeeBootstrapService.compute` (writes `activityModel`)
- Test: `backend/src/test/java/.../train/service/WeeklyScheduledActivityServiceIT.java`, `GoalProjectionServiceIT`, `GoalEngineRecomputeIT`, `BiometricProfileServiceIT` (fix the numeric expectations)

**Interfaces:**
- Consumes: `ActivityEnergyModel` (Task 1), `TdeeBootstrapService.bmr` (Task 2).
- Produces (the `weightKg` parameter becomes `restKcalPerHour`, so every caller must change):
  - `WeeklyScheduledActivityService.totalWeeklyEatKcalPerDay(UUID userId, BigDecimal restKcalPerHour): BigDecimal`
  - `scheduledWeeklyEatKcalPerDay(UUID, BigDecimal restKcalPerHour)`
  - `runWeeklyEatKcalPerDay(int sessionsPerWeek, BigDecimal restKcalPerHour)`
  - `blockKcal(String kind, int durationMin, BigDecimal restKcalPerHour)`, where `kind` is `gym | run | <sport id>`.
  - `TdeeBootstrapJson(..., OffsetDateTime computedAt, Integer activityModel)`.

- [ ] **Step 1: Rewrite the IT expectations.** In `WeeklyScheduledActivityServiceIT`, replace the MET×kg expectations with the net model at rest 80 (`REST = new BigDecimal("80")`):
  - 1 gym slot: `(3.5−1)×80×60/60 / 7`
  - 1 volleyball slot of 120′: `(4.0−1)×80×2 / 7`
  - 3 runs: `(9.3−1)×80×45/60×3/7`

  Write the expressions, for example `double expected = (4.0 - 1) * 80 * 2 / 7.0;`. Run it; expected FAIL.

- [ ] **Step 2: Rewrite `blockKcal`** and the three public methods:

```java
    /** Net kcal of one planned block at the moderate band (a plan carries no felt effort). 0 when rest energy is unknown. */
    public BigDecimal blockKcal(String kind, int durationMin, BigDecimal restKcalPerHour) {
        return BigDecimal.valueOf(activityEnergyModel.netKcal(kind, null, durationMin, restKcalPerHour).orElse(0));
    }
```

Sport slots pass `s.getSport()` as the kind. Gym passes `KIND_GYM` with `props.gymDefaultMinutes()`. Runs pass `KIND_RUN` with `props.runDefaultMinutes()`. Delete the `props.met()` switch.

Update the class Javadoc: "net activity-energy model (`ActivityEnergyModel`), moderate band; the weekly plan is a base the served target spreads evenly (spec D2)".

- [ ] **Step 3: Update the callers.**
  - **`GoalPrescriptionCalculator.calculate`:**
    ```java
    BigDecimal rest = ActivityEnergyModel.restKcalPerHour(bootstrapService.bmr(profile, currentWeightKg), currentWeightKg).orElse(null);
    BigDecimal weeklyEat = weeklyActivity.totalWeeklyEatKcalPerDay(userId, rest);
    ```
  - **`GoalProjectionService.buildSegment`:** it has `bootstrap` (`bootstrap.bmr()`) and `weightKg`. Use `ActivityEnergyModel.restKcalPerHour(bootstrap.bmr(), weightKg).orElse(null)` for both `scheduledWeeklyEatKcalPerDay` and `runWeeklyEatKcalPerDay`. Also update the class Javadoc lines 46 and 57, which describe the MET×weight formula.
  - **`BiometricProfileService.deriveTdeeBootstrap`:** `rest = restKcalPerHour(tdeeBootstrapService.bmr(profile, latestWeightKg), latestWeightKg)`.

  goal → train and biometrics → train already exist, so no new cycle.

- [ ] **Step 4: Add the model marker.** Add `Integer activityModel` as the last component of `TdeeBootstrapJson`, commented `// ActivityEnergyModel.VERSION the weekly EAT was computed with; null = pre-mezo-32m82 (gross MET)`. In `TdeeBootstrapService.compute`, pass `ActivityEnergyModel.VERSION`.
  - Fix every `new TdeeBootstrapJson(` call site (`grep -rn "new TdeeBootstrapJson" backend/src`).
  - `GoalMapper.toTdeeBootstrap` (MapStruct) ignores the extra source property. Confirm the build prints no `Unmapped target` error; it would not, because this is a source-only field.

- [ ] **Step 5: Fix the numeric expectations.** Run the goal, biometric and projection ITs, then update their numeric expectations to the net model. Each expectation must be an expression derived from the fixture's weight, profile and schedule, never a pasted literal.

```bash
cd backend && ./mvnw -q -Dtest='WeeklyScheduledActivity*IT,GoalProjectionServiceIT,GoalEngineRecomputeIT,BiometricProfileServiceIT,ScheduleGoalRecomputeIT,DietSettingsDayTypeShiftIT,GoalPrescriptionCalculator*' test -Dmezo.test.use-testcontainers=true
```

Expected: PASS once the expectations are updated.

- [ ] **Step 6: Commit.**

```bash
git add -A backend && git commit -m "feat(goal): weekly plan EAT from the net activity model; bootstrap carries activityModel=2 (mezo-32m82)"
```

---

### Task 4: `movementOn`: was the planned training done, and how much unplanned movement?

**Files:**
- Modify: `train/service/WorkoutWindowQueryService.java`
- Test: `backend/src/test/java/.../train/service/WorkoutWindowQueryServiceIT.java` (add a nested block; reuse its fixture helpers near lines 300–360)

**Interfaces:**
- Consumes: `ActivityEnergyModel` (Task 1), `AthleteBodyPort` (Task 2).
- Produces:
  - In `WorkoutWindowQueryService`: `public record DayMovement(boolean plannedDone, int extraKcal) { public static final DayMovement NONE = new DayMovement(false, 0); }`
  - `@Transactional(readOnly = true) public DayMovement movementOn(UUID userId, LocalDate date)`
  - `hasLoggedTrainingOn` is **deleted**; its callers move to `movementOn` in Task 5.

**Rules** (spec §5; implement exactly):
1. The weekday `dow = date.getDayOfWeek().getValue() - 1`.
2. **Gym.** Take the date's completed instances (`workoutSessionRepository.findDoneInstancesBetween(userId, date, date)`).
   - An instance is **planned** when `origin = "meso"` AND the weekday has ≥1 gym slot, AND the number of meso instances already counted as planned that day is below the weekday's gym-slot count.
   - Every other completed instance is **extra**: custom origin, no gym slot that weekday, or more instances than slots.
   - Extra gym kcal = `netKcal("gym", null, minutes, rest)`. Minutes = `activeSeconds/60` when set, else `finishedAt − startedAt` in minutes clamped to `[0,150]`, else `props.gymDefaultMinutes()`.
3. **Sport.** Build the planned pool exactly as `addSportWindowsForDay` does: the weekday slots not in `skips`, plus the date's `SportEventEntity` rows. Sessions sorted by time, nulls last; each consumes `nearestPlan`.
   - A consumed match is **planned**.
   - A session with no plan left is **extra**, with its persisted `kcal`. A null kcal contributes 0: honest, never invented.
4. **Run.** Count the active block's prescribed sessions on the date via `prescribedRunSessionsOn(block, date)`. The date's logged runs (`runSessionLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId, date, date)`) fill those planned slots first. Leftovers are **extra**, with their persisted `kcal` (null → 0).
5. `plannedDone` = at least one planned match of any kind. `extraKcal` = the sum over extras.
6. `rest` = `athleteBodyPort.bodyAt(userId, date).flatMap(b -> ActivityEnergyModel.restKcalPerHour(b.bmrKcal(), b.weightKg()))`. It is looked up **only** when an extra gym instance exists. If it is empty, that instance contributes 0.

- [ ] **Step 1: Write the failing ITs** in a new `@Nested class MovementOn` inside `WorkoutWindowQueryServiceIT`, using the class's existing fixture helpers to create slots, sessions and runs. Cases:
  - (a) A Wednesday with a volleyball slot and one logged volleyball session with kcal 480 → `plannedDone=true, extraKcal=0`.
  - (b) A Saturday with no slots and a logged volleyball session with kcal 573 → `plannedDone=false, extraKcal=573`.
  - (c) A Wednesday with one volleyball slot and two logged sessions (kcal 480, 300) → `plannedDone=true, extraKcal=300`. The later one is extra because the first consumes the plan.
  - (d) A Monday with a gym slot, a completed meso instance and a completed custom instance with `activeSeconds=3600` → `plannedDone=true`. `extraKcal = round(2.5 × bmr/24)`, computed from the fixture profile BMR through `TdeeBootstrapService.bmr` in the test.
  - (e) A skipped slot (sport-slot skip on that date) plus a logged session → extra.
  - (f) Nothing logged → `DayMovement.NONE`-equal.
  - (g) A logged session with null kcal on a slotless day → `plannedDone=false, extraKcal=0`.

Run: `cd backend && ./mvnw -q -Dtest='WorkoutWindowQueryServiceIT' test -Dmezo.test.use-testcontainers=true`. Expected: compile FAIL (no `movementOn`).

- [ ] **Step 2: Implement `movementOn`** following Rules 1–6. Reuse `PlannedSport`, `nearestPlan` and `prescribedRunSessionsOn`. Inject `ActivityEnergyModel activityEnergyModel` and `AthleteBodyPort athleteBodyPort` through the existing `@RequiredArgsConstructor`. Javadoc: the owner decisions D2–D4 in one paragraph ("planned sessions are already in the weekly base; only unplanned movement is credited on the day; a missed planned session is not deducted").

- [ ] **Step 3: Replace the old ITs.** The existing `hasLoggedTrainingOn` ITs (~lines 305–360) now assert `movementOn(...).plannedDone()`. Note: a logged session on a slotless day now yields `plannedDone=false`, because it is extra. Update those expectations with a comment citing spec D2/D3. Delete `hasLoggedTrainingOn`.

- [ ] **Step 4: Run.** The whole class must pass; the compile break in `FuelDayService`/`DietSettingsService` is fixed in Task 5. To keep the build green inside this task, temporarily inline `() -> workoutWindowQueryService.movementOn(userId, date).plannedDone()` at those two call sites.

- [ ] **Step 5: Commit.**

```bash
git add -A backend && git commit -m "feat(train): movementOn — planned-done + unplanned extra kcal per date (mezo-32m82)"
```

---

### Task 5: The served target with an energy breakdown (projector + contract + all callers)

**Files:**
- Create: `nutrition/service/EnergyBase.java`
- Modify: `nutrition/service/DayTargetProjector.java`, `nutrition/service/DailyTargets.java`
- Modify: `meal/service/FuelDayService.java` (lines 52, 93, 185–231: Javadoc, `targetSet`, `project`, `getDay`, `getWeek`)
- Modify: `nutrition/service/DietSettingsService.java:90-104`
- Modify: `character/service/CharacterSignalReads.java:720-728`
- Modify: `api/feature/meal/meal.yml` (`FuelDayResponse`, `FuelDayRollup`, the new `FuelDayEnergy`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DayTargetProjectorTest.java`, `FuelDayServiceIT`, `DietSettings*IT`, character `MacroAdherence*`/`CharacterSignalReads*` tests

**Interfaces:**
- Consumes: `WorkoutWindowQueryService.DayMovement`, `movementOn` (Task 4).
- Produces:
  - `record EnergyBase(BigDecimal bmr, BigDecimal neatBaselineKcal)` with `static EnergyBase of(TdeeBootstrapJson b)` (null-safe: a null bootstrap gives null).
  - `DailyTargets(int kcal, int p, int c, int f, String source, Energy energy)`, plus a nested `record Energy(int baseKcal, int plannedMovementKcal, int extraMovementKcal, int balanceKcal, int targetKcal)`. `energy` is null on the config path or when there is no `EnergyBase`.
  - `DayTargetProjector.project(Segment seg, EnergyBase base, Supplier<DayMovement> movement, NutritionTargetsProperties fallback)`.
  - The wire `FuelDayEnergy { baseKcal, plannedMovementKcal, extraMovementKcal, balanceKcal, targetKcal }` (all integers), as the nullable `energy` on `FuelDayResponse` and `FuelDayRollup`.

- [ ] **Step 1: Write the failing projector tests.** Rewrite `DayTargetProjectorTest` around the new signature. Keep every existing case (config fallback, the uniform segment, the split training/rest, carbs absorbing the delta, the lazy probe not called for a null segment) and add:

```java
    private static final EnergyBase BASE = new EnergyBase(new BigDecimal("1963"), new BigDecimal("2356"));

    @Test
    void extraMovementRaisesTargetAndCarbs() {
        // segment 2599 = base 2356 + planned 570 + balance −327; +573 unplanned volleyball
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), BASE,
            () -> new WorkoutWindowQueryService.DayMovement(false, 573), FALLBACK);
        assertThat(t.kcal()).isEqualTo(3172);
        assertThat(t.c()).isEqualTo(300 + Math.round(573 / 4f));
        assertThat(t.energy()).isEqualTo(new DailyTargets.Energy(2356, 570, 573, -327, 3172));
    }

    @Test
    void equationAlwaysCloses() {
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, 2800, 2400, -327), BASE,
            () -> new WorkoutWindowQueryService.DayMovement(true, 0), FALLBACK);
        DailyTargets.Energy e = t.energy();
        assertThat(e.baseKcal() + e.plannedMovementKcal() + e.extraMovementKcal() + e.balanceKcal())
            .isEqualTo(e.targetKcal()).isEqualTo(t.kcal()).isEqualTo(2800);
    }

    @Test
    void bmrFloorLandsInBalance() {
        DailyTargets t = DayTargetProjector.project(segment(1500, 170, 100, 60, null, null, -1200), BASE,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.kcal()).isEqualTo(1963);
        DailyTargets.Energy e = t.energy();
        assertThat(e.baseKcal() + e.plannedMovementKcal() + e.extraMovementKcal() + e.balanceKcal()).isEqualTo(1963);
    }

    @Test
    void negativePlannedShareFoldsIntoBalance() {
        // rest-day kcal below base+balance → Mozgás never shows a negative number
        DailyTargets t = DayTargetProjector.project(segment(2600, 170, 300, 86, 2900, 1950, -327), BASE,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.energy().plannedMovementKcal()).isZero();
        assertThat(t.energy().balanceKcal()).isEqualTo(1963 - 2356); // floor 1963 > 1950
    }

    @Test
    void noEnergyBaseNoBreakdown() {
        DailyTargets t = DayTargetProjector.project(segment(2599, 170, 300, 86, null, null, -327), null,
            () -> WorkoutWindowQueryService.DayMovement.NONE, FALLBACK);
        assertThat(t.energy()).isNull();
        assertThat(t.kcal()).isEqualTo(2599);
    }
```

Extend the local `segment(...)` helper with a `dailyEnergyBalanceKcal` argument. Run it; expected: compile FAIL.

- [ ] **Step 2: Implement.** `EnergyBase.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;

/** The goal snapshot's resting side of the equation: the BMR floor and BMR × NEAT ("Alap"). */
public record EnergyBase(BigDecimal bmr, BigDecimal neatBaselineKcal) {
    public static EnergyBase of(TdeeBootstrapJson b) {
        return b == null || b.bmr() == null || b.neatBaselineKcal() == null ? null : new EnergyBase(b.bmr(), b.neatBaselineKcal());
    }
}
```

`DailyTargets`: add the `Energy energy` component and the nested record. `fromConfig` passes `null`. Fix the other `new DailyTargets(` sites with `grep`.

`DayTargetProjector.project`:

```java
    public static DailyTargets project(GoalPrescriptionJson.Segment seg, EnergyBase base,
        Supplier<WorkoutWindowQueryService.DayMovement> movement, NutritionTargetsProperties fallback) {
        if (seg == null || seg.kcal() == null) {
            return seg == null ? DailyTargets.fromConfig(fallback) : legacy(seg, fallback);
        }
        WorkoutWindowQueryService.DayMovement m = movement.get();
        boolean split = seg.trainingDayKcal() != null || seg.restDayKcal() != null;
        Integer picked = split ? (m.plannedDone() ? seg.trainingDayKcal() : seg.restDayKcal()) : null;
        int dayKcal = picked != null ? picked : seg.kcal();
        int kcal = dayKcal + m.extraKcal();
        if (base != null) {
            kcal = Math.max(kcal, base.bmr().setScale(0, RoundingMode.HALF_UP).intValueExact());
        }
        int carbDeltaG = Math.round((kcal - seg.kcal()) / 4f);
        return new DailyTargets(kcal,
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            (seg.carbsG() != null ? seg.carbsG() : fallback.c()) + carbDeltaG,
            seg.fatG() != null ? seg.fatG() : fallback.f(),
            "goal", energy(base, seg, dayKcal, m.extraKcal(), kcal));
    }

    /** Alap + Mozgás (planned share + extra) + Célod = target; the floor and any negative planned share land in Célod. */
    private static DailyTargets.Energy energy(EnergyBase base, GoalPrescriptionJson.Segment seg, int dayKcal, int extra, int target) {
        if (base == null) {
            return null;
        }
        int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
        int segBalance = seg.dailyEnergyBalanceKcal() != null ? seg.dailyEnergyBalanceKcal() : 0;
        int planned = Math.max(0, dayKcal - baseKcal - segBalance);
        int balance = target - baseKcal - planned - extra;
        return new DailyTargets.Energy(baseKcal, planned, extra, balance, target);
    }

    /** A segment without kcal (malformed/legacy): per-field config fallback, no breakdown. */
    private static DailyTargets legacy(GoalPrescriptionJson.Segment seg, NutritionTargetsProperties fallback) {
        return new DailyTargets(fallback.kcal(),
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            seg.carbsG() != null ? seg.carbsG() : fallback.c(),
            seg.fatG() != null ? seg.fatG() : fallback.f(), "goal", null);
    }
```

Rewrite the class Javadoc: served target = day-type pick on **planned** training done, plus the unplanned extra, floored at BMR; carbs absorb every delta; the breakdown always closes. The segment's null-kcal path previously used `fallback.kcal()`; `legacy` preserves that.

- [ ] **Step 3: Run the projector test.** `./mvnw -q -Dtest=DayTargetProjectorTest test`. Expected: PASS.

- [ ] **Step 4: Change the contract.** In `api/feature/meal/meal.yml`, add the schema below and add `energy: { $ref: '#/components/schemas/FuelDayEnergy' }` (optional, not in `required`) to both `FuelDayResponse` and `FuelDayRollup`:

```yaml
    FuelDayEnergy:
      type: object
      nullable: true
      description: >-
        The served target's equation (mezo-32m82): baseKcal (BMR × NEAT) + plannedMovementKcal (the weekly
        plan's share for the day, incl. the day-type shift) + extraMovementKcal (unplanned logged movement,
        net) + balanceKcal (goal deficit/surplus; also absorbs the BMR floor) = targetKcal. Null on the
        static path (no goal or no biometric snapshot).
      required: [baseKcal, plannedMovementKcal, extraMovementKcal, balanceKcal, targetKcal]
      properties:
        baseKcal: { type: integer }
        plannedMovementKcal: { type: integer }
        extraMovementKcal: { type: integer }
        balanceKcal: { type: integer }
        targetKcal: { type: integer }
```

Regenerate with `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. See AGENTS.md for the exact commands and confirm them there.

- [ ] **Step 5: Update `FuelDayService`.**
  - `project(seg, userId, date, goal)` → `DayTargetProjector.project(seg, EnergyBase.of(goal == null ? null : goal.getTdeeBootstrap()), () -> workoutWindowQueryService.movementOn(userId, date), targets)`.
  - `targetSet` returns the `DailyTargets`, and the builders map `t.energy()` to the generated `FuelDayEnergy` (null → null) on both `getDay` and `getWeek`.
  - Rewrite the Javadocs at lines 49–54, 93–95 and 211–216 to describe `movementOn` (planned-done pick + unplanned extra).
  - `dailyTargets(userId, date)` keeps its signature. It now returns the higher target on an extra-movement day, which the meal scorer and MealCoach inherit. That is the point.

- [ ] **Step 6: Update the other callers.**
  - **`DietSettingsService.previewSettings`:** `DayTargetProjector.project(seg, EnergyBase.of(<active goal bootstrap>), () -> workoutWindowQueryService.movementOn(userId, today), nutritionTargets)`. If the service has no goal handle, pass `null` for the base: the preview only reads kcal and macros.
  - **`CharacterSignalReads.kcalTarget(goal, date)`:** return `BigDecimal.valueOf(DayTargetProjector.project(segmentFor(goal, date), EnergyBase.of(goal == null ? null : goal.getTdeeBootstrap()), () -> workoutWindowQueryService.movementOn(goal.getCreatedBy(), date), nutritionTargets).kcal())`. Guard a null goal to the config kcal as today. Fix its Javadoc to say it now truly mirrors `FuelDayService`.
    - Inject `WorkoutWindowQueryService`. **Before committing,** run `./mvnw -q -Dtest=ArchitectureTest test`. If character → train creates a slice cycle, stop and report instead of forcing it. Check first with `grep -rn "feature.character" backend/src/main/java/io/mrkuhne/mezo/feature/train`.

- [ ] **Step 7: Fix and run the ITs.** Update expectations where a slotless logged session used to flip the training-day kcal; per D3 it is now rest-day kcal plus extra. Add one `FuelDayServiceIT` case: a Saturday unplanned volleyball with a persisted kcal of 573 gives `targets.kcal == seg.kcal + 573` (uniform segment), and `energy.extraMovementKcal == 573`.

```bash
cd backend && ./mvnw -q -Dtest='DayTargetProjectorTest,FuelDayServiceIT,DietSettings*IT,*CharacterSignalReads*,MacroAdherence*,ArchitectureTest' test -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add -A api backend frontend/src/data/_client && git commit -m "feat(nutrition): one served target with energy breakdown — unplanned movement credited, planned in the weekly base (mezo-32m82)"
```

---

### Task 6: One-shot rollout (estimated kcal + goal recompute)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609261400_mezo-32m82_reset_estimated_kcal.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append the changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/ActivityModelMigrationRunner.java`
- Modify: `goal/repository/GoalRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/ActivityModelMigrationRunnerIT.java`

**Interfaces:**
- Consumes: `SportService.reestimateMissing`, `RunningService.reestimateMissing` (Task 2); `GoalEngineService.evaluate(UUID userId, UUID goalId)`; `ActivityEnergyModel.VERSION`.
- Produces: `ActivityModelMigrationRunner.run()` (no-arg, the IT entry point) and `GoalRepository.findByStatusNotAndDeletedFalse(String status)`.

- [ ] **Step 1: Write the SQL.**

```sql
-- mezo-32m82: the activity-energy model became net-of-rest (Compendium 2024). Old ESTIMATES were
-- gross MET and are dropped once here; ActivityModelMigrationRunner re-estimates every row with
-- kcal IS NULL at boot. User-typed values (kcal_is_estimate = false) are untouched.
UPDATE sport_session SET kcal = NULL, kcal_is_estimate = NULL WHERE kcal_is_estimate = true;
UPDATE run_session_log SET kcal = NULL, kcal_is_estimate = NULL WHERE kcal_is_estimate = true;
```

Append to the master changelog, copying the neighbouring entries' shape exactly:

```yaml
  - changeSet:
      id: "1.0.0:202609261400_mezo-32m82_reset_estimated_kcal"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609261400_mezo-32m82_reset_estimated_kcal.sql
```

Check that `run_session_log` has a `kcal_is_estimate` column: `grep -rn "kcal_is_estimate" backend/src/main/resources/db`. If it does not, drop that clause for the run table and null only its `kcal` where the row is an estimate, following whatever column marks it.

- [ ] **Step 2: Write the failing runner IT.** Seed a goal whose `tdeeBootstrap.activityModel` is `null`, a sport session with `kcal = null`, a duration and a profile plus weigh-in, and a user-typed session (`kcal = 350`, `kcalIsEstimate = false`). Call `runner.run()`. Assert:
  - the goal's `tdeeBootstrap().activityModel() == 2` and the prescription was rewritten (segment kcal changed);
  - the null-kcal session now has the net estimate and `kcalIsEstimate = true`;
  - the typed session is still 350 / false;
  - a second `run()` evaluates no goals, verified with a spy or by asserting `computedAt` did not change.

Use the IT base class other goal ITs use (`grep -l "extends" backend/src/test/java/io/mrkuhne/mezo/feature/goal/*IT.java | head -1`).

- [ ] **Step 3: Implement the runner.**

```java
package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel;
import io.mrkuhne.mezo.feature.train.service.RunningService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Rollout of the net activity-energy model (mezo-32m82), ALL profiles incl. prod. Idempotent:
 * (1) estimates every sport/run row whose kcal is NULL (the Liquibase changeset nulled the old
 * gross estimates once; rows without a known body simply stay NULL); (2) re-evaluates every
 * non-archived goal whose tdee_bootstrap predates {@link ActivityEnergyModel#VERSION} — a fresh
 * evaluate writes the marker, so the next boot skips it. {@code @Order(210)}: after the seed runners
 * and {@link GoalReevaluateRunner} (200) where that one is active.
 */
@Slf4j
@Component
@Order(210)
@RequiredArgsConstructor
public class ActivityModelMigrationRunner implements CommandLineRunner {

    private final SportService sportService;
    private final RunningService runningService;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    @Override
    public void run(String... args) {
        run();
    }

    public void run() {
        int sport = sportService.reestimateMissing();
        int runs = runningService.reestimateMissing();
        List<GoalEntity> stale = goalRepository.findByStatusNotAndDeletedFalse("archived").stream()
            .filter(g -> g.getTdeeBootstrap() == null
                || g.getTdeeBootstrap().activityModel() == null
                || g.getTdeeBootstrap().activityModel() < ActivityEnergyModel.VERSION)
            .toList();
        stale.forEach(g -> goalEngineService.evaluate(g.getCreatedBy(), g.getId()));
        if (sport + runs + stale.size() > 0) {
            log.info("Activity model v{}: estimated {} sport + {} run session(s), re-evaluated {} goal(s).",
                ActivityEnergyModel.VERSION, sport, runs, stale.size());
        }
    }
}
```

Add `List<GoalEntity> findByStatusNotAndDeletedFalse(String status);` to `GoalRepository`.
- **Exception safety:** a goal whose profile is missing takes the evaluate no-profile path (graceful), so no try/catch is needed. If the IT shows an exception on a no-profile goal, wrap the per-goal call in try/catch with `log.warn` so one bad goal cannot stop boot.

- [ ] **Step 4: Run.** `./mvnw -q -Dtest='ActivityModelMigrationRunnerIT,ArchitectureTest' test -Dmezo.test.use-testcontainers=true`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add -A backend && git commit -m "feat(goal): one-shot activity-model rollout — re-estimate sessions, recompute stale goals (mezo-32m82)"
```

---

### Task 7: Frontend mirror + drift guard; Train surfaces and planned previews

**Files:**
- Create: `frontend/src/data/train/activityEnergy.ts`, `frontend/src/data/train/activityEnergy.test.ts`
- Delete: `frontend/src/data/fuel/metDriftGuard.test.ts`
- Modify: `frontend/src/data/fuel/fuelConfig.ts:36-41` (drop `MET_BY_KIND`, `DEFAULT_RUN_MIN`)
- Modify: `frontend/src/features/train/logic/trainDayEnergy.ts` (+ its test), `features/train/logic/loadWeek.ts:170-205` (+ test)
- Modify: `features/train/pages/TrainTodayPage.tsx:300-335`, `ActiveWorkoutPage.tsx:795-812`, `TrainWeekMozgasPage.tsx` (header comment + call)
- Modify: `features/fuel/logic/buildDayPlan.ts` (`PlannerBlock.sport?`, drop `blockKcal`/`activityKcal`, peri-snack rule at :228), `features/fuel/logic/buildProtocol.ts` (sport blocks carry `sport`), `features/fuel/logic/dayZones.ts:74`, `features/fuel/logic/buildEnergyBreakdown.ts`

**Interfaces:**
- Produces, in `data/train/activityEnergy.ts`:
  - `export type Band = 'light' | 'moderate' | 'hard'`
  - `export const DEFAULT_RUN_MIN = 45`
  - `export const DEFAULT_GYM_MIN = 60`
  - `export function band(rpe?: number | null): Band`
  - `export function restKcalPerHour(bmr?: number | null, weightKg?: number | null): number | null`
  - `export function metFor(kind: string | null | undefined, rpe?: number | null): number`
  - `export function netKcal(kind: string | null | undefined, rpe: number | null | undefined, minutes: number, restPerHour: number | null): number | null`
  - `export function blockEnergyKind(block: { kind: 'gym' | 'sport' | 'run'; sport?: string | null }): string`, which maps gym→`gym`, run→`run`, and sport→`block.sport ?? 'other'`.
- Changed: `trainDayEnergy(blocks: Block[], restPerHour: number | null): DayEnergy`, where `Block` gains an optional `sport?: string`. `movementWeek(gymBlocks, sport, restPerHour)` follows the same pattern.
- Callers compute `restPerHour = restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg)`.

- [ ] **Step 1: Write the failing FE test** in `activityEnergy.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import vectors from '../../../../api/fixtures/activity-energy-vectors.json'
import { band, netKcal, restKcalPerHour, metFor } from '@/data/train/activityEnergy'

// FE↔BE drift guard (mezo-32m82): the SAME vectors are asserted by backend ActivityEnergyVectorsTest.
describe('activityEnergy golden vectors', () => {
  test.each(vectors.restKcalPerHour)('restKcalPerHour %j', (v) => {
    expect(restKcalPerHour(v.bmr, v.weightKg)).toBe(v.expected)
  })
  test.each(vectors.netKcal)('netKcal %j', (v) => {
    expect(netKcal(v.kind, v.rpe, v.min, v.rest)).toBe(v.expected)
  })
})

describe('activityEnergy rules', () => {
  test('band from RPE', () => {
    expect(band(null)).toBe('moderate')
    expect(band(4)).toBe('light')
    expect(band(7)).toBe('moderate')
    expect(band(8)).toBe('hard')
  })
  test('unknown kind reads as other', () => {
    expect(metFor('kajak')).toBe(4.0)
    expect(metFor(undefined)).toBe(4.0)
  })
})
```

If vite refuses the JSON import from outside `frontend/` (an `fs.allow` error), switch to `JSON.parse(readFileSync(resolve(__dirname, '../../../../api/fixtures/activity-energy-vectors.json'), 'utf8'))` using `node:fs` and `node:path`. Run it: `cd frontend && CI=true VITE_USE_MOCK=true pnpm vitest run src/data/train/activityEnergy.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 2: Implement** `activityEnergy.ts`:

```ts
// ============================================================
// Mezo · activityEnergy — the frontend MIRROR of backend ActivityEnergyModel (mezo-32m82).
// Net-of-rest kcal from the 2024 Adult Compendium: (MET − 1) × BMR/24 × hours. Used ONLY for
// planned previews (Train today, the gym ceremony, the weekly movement summary, Fuel day zones);
// a LOGGED session always shows the backend-persisted kcal. Bound to the backend by the shared
// golden vectors in api/fixtures/activity-energy-vectors.json — change both or neither.
// ============================================================

export type Band = 'light' | 'moderate' | 'hard'

export const DEFAULT_RUN_MIN = 45
export const DEFAULT_GYM_MIN = 60

const MET: Record<string, Record<Band, number>> = {
  gym: { light: 3.5, moderate: 3.5, hard: 5.0 },
  volleyball: { light: 3.0, moderate: 4.0, hard: 6.0 },
  football: { light: 5.0, moderate: 7.0, hard: 9.5 },
  basketball: { light: 4.5, moderate: 6.5, hard: 8.0 },
  tennis: { light: 5.0, moderate: 7.0, hard: 8.0 },
  trx: { light: 3.0, moderate: 4.5, hard: 6.5 },
  cross: { light: 4.0, moderate: 5.8, hard: 8.0 },
  swim: { light: 5.8, moderate: 8.3, hard: 9.8 },
  bike: { light: 5.8, moderate: 6.8, hard: 8.0 },
  hike: { light: 5.3, moderate: 6.0, hard: 7.8 },
  run: { light: 7.5, moderate: 9.3, hard: 10.5 },
  other: { light: 3.0, moderate: 4.0, hard: 6.0 },
}

/** RPE 1–4 light, 5–7 moderate, 8–10 hard; no RPE (every planned block) = moderate. */
export function band(rpe?: number | null): Band {
  if (rpe == null) return 'moderate'
  if (rpe <= 4) return 'light'
  return rpe <= 7 ? 'moderate' : 'hard'
}

/** BMR/24 when known, else 1 kcal per kg per hour, else null (honest unknown). */
export function restKcalPerHour(bmr?: number | null, weightKg?: number | null): number | null {
  if (bmr != null && bmr > 0) return bmr / 24
  if (weightKg != null && weightKg > 0) return weightKg
  return null
}

export function metFor(kind: string | null | undefined, rpe?: number | null): number {
  const row = (kind != null && MET[kind]) || MET.other
  return row[band(rpe)]
}

/** Net kcal of one session, rounded half-up; null when rest energy or a positive duration is unknown. */
export function netKcal(kind: string | null | undefined, rpe: number | null | undefined, minutes: number, restPerHour: number | null): number | null {
  if (restPerHour == null || !(minutes > 0)) return null
  const kcal = (metFor(kind, rpe) - 1) * restPerHour * (minutes / 60)
  return Math.floor(kcal + 0.5)
}

/** A planner/train block's model kind: gym → gym, run → run, sport → its sport id (else other). */
export function blockEnergyKind(block: { kind: 'gym' | 'sport' | 'run'; sport?: string | null }): string {
  return block.kind === 'sport' ? (block.sport ?? 'other') : block.kind
}
```

Run the test from Step 1; expected: PASS. `Math.floor(x + 0.5)` matches Java HALF_UP for positive values; the vectors prove it.

- [ ] **Step 3: Rebuild `trainDayEnergy` on the mirror:**

```ts
import { blockEnergyKind, netKcal } from '@/data/train/activityEnergy'

export type Block = { kind: 'gym' | 'sport' | 'run'; minutes: number; done: boolean; sport?: string }

export function trainDayEnergy(blocks: Block[], restPerHour: number | null): DayEnergy {
  if (restPerHour == null || blocks.length === 0) return { plannedKcal: 0, earnedKcal: 0, known: false }
  let plannedKcal = 0
  let earnedKcal = 0
  for (const block of blocks) {
    const kcal = netKcal(blockEnergyKind(block), null, block.minutes, restPerHour) ?? 0
    plannedKcal += kcal
    if (block.done) earnedKcal += kcal
  }
  return { plannedKcal, earnedKcal, known: true }
}
```

Update the header comment to name the net model. Update `trainDayEnergy.test.ts` expectations to rest-80 arithmetic: for example gym 60′ → 200, volleyball 120′ → 480.

- [ ] **Step 4: Update the Train callers.**
  - **`TrainTodayPage`:**
    - Replace `trainDayEnergy(energyBlocks, weightKg || null)` with `trainDayEnergy(energyBlocks, restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg || null))`.
    - Delete the local `DEFAULT_RUN_MIN = 40` and its comment, and import `DEFAULT_RUN_MIN` from `activityEnergy`.
    - Push `sport: sportOf(item.sport)` onto sport blocks.
    - **Logged-session rule:** a sport block that is done must show the persisted kcal. When `sportDoneOn(...)` is true and the logged session carries `kcal`, use it for that block rather than the estimate. Find the session the same way `sportDoneOn` does, and add a small helper next to it.
  - **`ActiveWorkoutPage`:** replace `weightKg || null` with `restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg || null)`.
  - **`loadWeek.movementWeek`:** rename the parameter to `restPerHour: number | null` and pass it through. Update `TrainWeekMozgasPage`'s call (compute `restPerHour` the same way) and its header comment, plus `loadWeek.test.ts`.

- [ ] **Step 5: Planner blocks carry the sport.**
  - Add `sport?: string` to `PlannerBlock` (`buildDayPlan.ts:49`).
  - In `buildProtocol.ts` (`deriveBlocks`, `resolveSportBlocks`, `deriveLoggedBlocks` sport branch), set `sport: sportOf(...)` or `s.sport` on sport blocks.
  - Delete `blockKcal` and `activityKcal` from `buildDayPlan.ts`.
  - The peri-snack rule at :228 becomes `(netKcal(blockEnergyKind(b), null, b.durationMin ?? (b.kind === 'run' ? DEFAULT_RUN_MIN : DEFAULT_GYM_MIN), restPerHour) ?? 0) >= PERI_SNACK_MIN_KCAL`. `buildDayPlan`'s input already has `weightKg`; add `restPerHour: number | null` to `DayPlanInput` and pass it from `timelineHooks` in Task 8. Until then, pass `restKcalPerHour(null, weightKg)`.
  - **Threshold recalibration:** `PERI_SNACK_MIN_KCAL` (300) was calibrated against gross numbers. Lower it to **200** in `fuelConfig.ts`, with a comment "net model (mezo-32m82): 300 gross ≈ 200 net". The duration arm (90′) is unchanged.
  - `dayZones.ts:74`: use `netKcal(blockEnergyKind(block), null, block.durationMin ?? DEFAULT_GYM_MIN, restPerHour) ?? 0`. Thread `restPerHour` into the function's input in place of `weightKg`, and fix its caller and test.
  - `buildEnergyBreakdown.ts`: delete the local `DEFAULT_RUN_MIN = 40` and `DEFAULT_BLOCK_MIN`, and import them from `activityEnergy`. Per-block kcal uses `netKcal` too. Task 8 re-feeds its totals from the served energy.

- [ ] **Step 6: Remove the old table.** Delete `MET_BY_KIND` and `DEFAULT_RUN_MIN` from `fuelConfig.ts`, then delete `metDriftGuard.test.ts`. `grep -rn "MET_BY_KIND\|blockKcal\|activityKcal" frontend/src` must return nothing.

- [ ] **Step 7: Typecheck and test in both modes.** Expected: all pass. Fix every expectation that encoded the gross numbers, deriving each new one as an expression from rest 80 or the fixture's BMR.

```bash
cd frontend && pnpm tsc --noEmit && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 8: Commit.**

```bash
git add -A frontend && git commit -m "feat(train,fuel): FE activity-energy mirror + shared-vector drift guard; planned previews net (mezo-32m82)"
```

---

### Task 8: Fuel Mai uses the served target; the „Célod” row

**Files:**
- Modify: `frontend/src/data/types.ts` (`FuelDay` gains `energy?: FuelDayEnergy | null`), `data/fuel/fuelHooks.ts:38-55` (pass `data.energy`), `FUELDAY_EMPTY`
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts:125-196` (`deriveDailyBudget` → `servedBudget`)
- Modify: `frontend/src/data/fuel/timelineHooks.ts:95-200`
- Modify: `frontend/src/features/fuel/logic/keretHero.ts:20-30,105-125,200-240` (+ `keretHero.test.ts`)
- Modify: `frontend/src/features/fuel/components/FuelEnergyHero.tsx:35-40`
- Modify: `frontend/src/features/fuel/logic/buildEnergyBreakdown.ts` (+ test), `features/fuel/sheets/EnergyBreakdownSheet.tsx` (only if its props change)
- Modify, mock and fixtures:
  - the seed day (`seedDayData`, found via `grep -rn "seedDayData" frontend/src/data | head -3`)
  - `frontend/src/test/msw/handlers.ts` (fuel day `energy`; `tdeeBootstrap` numbers from the net model)
  - `frontend/src/data/me/goals.ts:170`

**Interfaces:**
- Consumes: the generated `FuelDayEnergy` type (Task 5), `restKcalPerHour` (Task 7).
- Produces:
  - `servedBudget(targets: MacroSet, energy: FuelDayEnergy | null | undefined): DayBudget`. `DayBudget.energy` becomes `{ base: number; planned: number; extra: number; balance: number; target: number }`.
  - `KeretHeroVM.chips` becomes `{ base: number; activity: number; extra: number; balance: number } | null`, where `activity = planned + extra`.
  - `EquationLine.key` gains `'goal'`.
  - `heroEquationLines(vm, trajectory?: 'cut' | 'bulk' | 'maintain' | null)`.

- [ ] **Step 1: Write the failing `keretHero` tests.** Add to `keretHero.test.ts`:

```ts
describe('heroEquationLines — Célod row (mezo-32m82)', () => {
  const vm = (chips: KeretHeroVM['chips'], remaining = 2951, consumed = 0) =>
    ({ ...baseVm, chips, remainingKcal: remaining, consumedKcal: consumed, targetKcal: remaining + consumed }) as KeretHeroVM

  test('cut day: Alap + Mozgás − Célod − Étel = Marad, and it closes', () => {
    const lines = heroEquationLines(vm({ base: 2356, activity: 922, extra: 0, balance: -327 }), 'cut')
    expect(lines.map(l => l.key)).toEqual(['base', 'activity', 'goal', 'eaten', 'remaining'])
    const goal = lines.find(l => l.key === 'goal')!
    expect(goal.value).toBe(-327)
    expect(goal.sign).toBe('±')
    expect(2356 + 922 - 327 - 0).toBe(2951)
  })

  test('maintain with zero balance hides the row', () => {
    const lines = heroEquationLines(vm({ base: 2356, activity: 500, extra: 0, balance: 0 }, 2856), 'maintain')
    expect(lines.some(l => l.key === 'goal')).toBe(false)
  })

  test('past day (chips null) shows the dash in the Célod row too', () => {
    const lines = heroEquationLines(vm(null), 'cut')
    expect(lines.find(l => l.key === 'goal')!.value).toBeNull()
  })
})
```

`baseVm` is whatever fixture VM the file already builds; reuse it. Run it; expected: FAIL.

- [ ] **Step 2: Implement the equation.** In `keretHero.ts`:
  - Extend the `EquationLine` key union with `'goal'` and allow `sign: '±'` (the row carries its own sign, like `=`).
  - Update `heroEquationLines`:

```ts
export function heroEquationLines(vm: KeretHeroVM, trajectory: 'cut' | 'bulk' | 'maintain' | null = null): EquationLine[] {
  const balance = vm.chips?.balance ?? null
  // A zero balance on a non-cut/bulk goal is "tartás" with nothing to add — the row would only be noise.
  // A past day (chips null) keeps the row so it honestly reads „—" like its neighbours.
  const showGoal = !(balance === 0 && trajectory !== 'cut' && trajectory !== 'bulk')
  return [
    { key: 'base', label: 'Alap', value: vm.chips?.base ?? null, sign: null },
    { key: 'activity', label: 'Mozgás', value: vm.chips?.activity ?? null, sign: '+' },
    ...(showGoal ? [{ key: 'goal' as const, label: 'Célod', value: balance, sign: '±' as const }] : []),
    { key: 'eaten', label: 'Étel', value: vm.consumedKcal, sign: '−' },
    { key: 'remaining', label: 'Marad', value: vm.remainingKcal, sign: '=' },
  ]
}
```

  - `buildKeretHero`'s chips: `{ base: budget.energy.base, activity: budget.energy.planned + budget.energy.extra, extra: budget.energy.extra, balance: budget.energy.balance }`.
  - `asPastDayHero` keeps nulling `chips`.

- [ ] **Step 3: Render the row** in `FuelEnergyHero.tsx`:
  - `NODE` gains `goal`, and `base` switches icon:
    - `base: { color: 'var(--amber)', icon: <body/metabolism sprite>, sub: 'az alapanyagcseréd és az életmódod' }`. List the sprite names with `grep -rn "i-" frontend/src/shared/ui/clay/*.ts | grep -i "name" | head -40` and pick the one reading as body or metabolism. **Never an emoji.**
    - `goal: { color: 'var(--violet)', icon: 'i-cel', sub: '' }`, using the violet token if it exists in the Üveg palette; otherwise `var(--rose)`. Check with `grep -n "\-\-violet\|\-\-rose" frontend/src/styles -r | head`.
  - The `sub` for goal is computed from the trajectory: `cut` → „a fogyási célod napi része”, `bulk` → „a tömegelési célod napi része”, `maintain` → „tartás”.
  - The `activity` sub: „a heti edzésterved mai része”, plus „ + terven kívüli mozgás” when `vm.chips?.extra`.
  - `nodeValue`: for `sign === '±'`, render `huInt(value)` with its own sign (`−` U+2212 for negative, `+` for positive), and `—` when null.
  - `EquationBox` gets a `trajectory` prop threaded from `FuelEnergyHero`'s new optional `trajectory` prop. `FuelMaiPage` passes `goal?.trajectory`; check the field name on the goal hook's type.

- [ ] **Step 4: Fuel Mai drops its own target.**
  - **`buildDayPlan.ts`:** replace `deriveDailyBudget` with:

```ts
/**
 * The day's budget as the backend SERVES it (mezo-32m82): one rule for every surface — the weekly
 * plan's base + day-type shift + unplanned movement credited the same day, floored at BMR
 * (DayTargetProjector). The frontend no longer derives a target; it only reshapes the served one.
 * No `energy` (static path: no goal / no biometric snapshot) → the equation box hides its chips.
 */
export function servedBudget(targets: MacroSet, energy: FuelDayEnergy | null | undefined): DayBudget {
  const e = energy
    ? { base: energy.baseKcal, planned: energy.plannedMovementKcal, extra: energy.extraMovementKcal, balance: energy.balanceKcal, target: energy.targetKcal }
    : { base: targets.kcal, planned: 0, extra: 0, balance: 0, target: targets.kcal }
  return { kcal: targets.kcal, p: targets.p, c: targets.c, f: targets.f, energy: e }
}
```

  - Update `DayBudget` accordingly. Keep `staticEnergy` detection in `timelineHooks` as `fuel.energy == null`.
  - **`timelineHooks.ts`:**
    - `const budget = servedBudget(fuel.targets, fuel.energy)`.
    - Delete `currentSegment` only if nothing else uses it: it still feeds `buildEnergyBreakdown`'s deficit section, so keep it if referenced.
    - Delete the `deriveLoggedBlocks` use for energy (keep it if `dayType`/template needs it; check).
    - Pass `restPerHour = restKcalPerHour(goalResponse?.tdeeBootstrap?.bmr, weightKg)` into `buildDayPlan` and `projectStackDay` wherever Task 7 needed it.
  - **`buildEnergyBreakdown`:** take the `energy` from the budget. Its activity total becomes `planned + extra`, and when `extra > 0` it adds a line „Terven kívüli mozgás” with that kcal. Per-block lines stay previews from `netKcal`. Update its test.
  - Delete the old `deriveDailyBudget` tests in `buildDayPlan.test.ts` (the whole `describe`, including the day-type shift worked example) and add a small `servedBudget` test with both branches.

- [ ] **Step 5: Update the fixtures in BOTH modes.**
  - **Mock seed day:** add an `energy` consistent with its `targets.kcal`. For example targets 2599: `{ baseKcal: 2356, plannedMovementKcal: 570, extraMovementKcal: 0, balanceKcal: -327, targetKcal: 2599 }`, with `targets.kcal` set to 2599 so it closes.
  - **MSW `handlers.ts`:** add the same shape to the fuel day handler. Its `tdeeBootstrap` (~:357) and `data/me/goals.ts:170` must satisfy `tdee = neatBaselineKcal + weeklyEatKcalPerDay`, with `weeklyEatKcalPerDay` recomputed from their own schedule under the net model. Add `activityModel: 2`.
  - `mockSportKcal` (`data/train/trainHooks.ts:514`) and `mockRunKcal` (`data/train/running.ts:95`): switch to `netKcal(sport, rpe, minutes, restKcalPerHour(null, 78))`, so mock mode shows the same model. Keep the fixture weight of 78, and update the comment stating they are the published model now.
  - The `train.ts` `sportSessionsFixed` kcal values: recompute the same way, or derive them with `netKcal` at module load.

- [ ] **Step 6: Typecheck, test both modes, and build.** Expected: green.

```bash
cd frontend && pnpm tsc --noEmit && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 7: Verify at runtime (mock).** Use the repo `verify` skill recipe: open Fuel Mai, tap the energy chip and confirm the box reads Alap / Mozgás / Célod / Étel / Marad, and that the numbers close (base + activity + balance − eaten = remaining). Take a screenshot for the owner. Then check the past-day view: every chip shows „—”.

- [ ] **Step 8: Commit.**

```bash
git add -A frontend && git commit -m "feat(fuel): Fuel Mai shows the served target; Célod row closes the equation (mezo-32m82)"
```

---

### Task 9: Sport log override label, docs, CODEMAP, gates, merge, deploy check

**Files:**
- Modify: `frontend/src/features/train/pages/SportLogPage.tsx` (the kcal override field label + helper text)
- Modify: `docs/features/fuel.md` (§5/§9/§10 energy; stale line ~534), `docs/features/train.md` (§2 estimator rule, lines ~124, ~407, ~980), `docs/features/goal-engine.md` (§9 EAT model; the recompute table gains the runner), `docs/features/me.md` (TDEE breakdown now net)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Change the override label.** In `SportLogPage.tsx`, find the kcal override input (`grep -n "kcal" SportLogPage.tsx`). Set its label to „Aktív kalória (ha az órád mérte)” and its helper to „Csak a mozgás többletét írd be — az órád »aktív« kalóriáját, ne az összeset.”. Update its test's text query if one asserts the old label.

- [ ] **Step 2: Update the docs.** In each feature doc, replace the gross-MET descriptions with the net model. Name `ActivityEnergyModel`, `movementOn`, `DayTargetProjector`'s breakdown, the golden vectors and the migration runner. Fix the stale fuel.md claim about `hasScheduledTrainingOn` and the train.md claims "Train and Fuel use the same table" / the 40′ run. Add a worked example (spec §8) to fuel.md in place of the old `6.0×78.6×1 = 472`. Keep each doc's front-matter `key_files` accurate.

- [ ] **Step 3: Regenerate and lint.**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs
```

Expected: no errors.

- [ ] **Step 4: Run the full gates.** Expected: all green. Any failure is fixed in this task before merging.

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm tsc --noEmit && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 5: Commit and merge.** Follow AGENTS.md: rebase on main, merge from a detached HEAD, regenerate the CODEMAP after the merge, then push.

```bash
git add -A && git commit -m "docs(fuel,train,goal): net activity-energy model + served-target breakdown (mezo-32m82)"
git fetch origin && git rebase origin/main
node scripts/gen-codemap.mjs --check || (node scripts/gen-codemap.mjs && git commit -am "chore(codemap): regen after rebase (mezo-32m82)")
git checkout --detach origin/main && git merge --no-ff feat/activity-energy-model -m "Merge branch 'feat/activity-energy-model' — egységes, reális mozgás-kcal modell + Célod sor (mezo-32m82)"
node scripts/gen-codemap.mjs --check || (node scripts/gen-codemap.mjs && git commit -am "chore(codemap): regen after merge (mezo-32m82)")
git push origin HEAD:main && git branch -d feat/activity-energy-model
```

- [ ] **Step 6: Check the deploy and the live data (read-only).** Watch CI with `gh run list --branch main --limit 1` and ArgoCD sync (docs/infrastructure/deployment-k3s-argocd.md). Then confirm on the live DB:

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl -n mezo logs deploy/backend | grep "Activity model v2"
kubectl -n mezo exec statefulset/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select title, tdee_bootstrap->>'"'"'weeklyEatKcalPerDay'"'"' eat, tdee_bootstrap->>'"'"'activityModel'"'"' v, prescription->'"'"'segments'"'"'->0->>'"'"'kcal'"'"' kcal from goal where status='"'"'active'"'"' and not is_deleted"'
```

Expected for the owner: eat ≈ 570, v = 2, kcal ≈ 2599; sport_session 2026-09-26 kcal ≈ 573. Report the numbers to the owner in Hungarian.

- [ ] **Step 7: Close the bead and back up the tracker.**

```bash
bd close mezo-32m82 && node scripts/check-beads-backup.mjs --fix && git add .beads/issues.jsonl && git commit -m "chore(beads): tracker backup after activity-energy model (mezo-32m82) [skip ci]" && git push origin HEAD:main && bd dolt push
```
