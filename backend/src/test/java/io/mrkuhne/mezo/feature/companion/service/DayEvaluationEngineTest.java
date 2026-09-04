package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayDimension;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayEvaluation;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayInputs;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.MealLogFact;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

/**
 * Pure-math unit test (no Spring): the engine's inputs are a directly-constructed
 * {@link DayInputs} carrier + a directly-constructed {@link DayEvaluationProperties} config
 * record (testing_standards.md "pure utility" rule), same house style as
 * {@code MealScoringServiceTest}. Task 2 added {@code nutrition}; this file (Task 3) adds {@code
 * quality} and {@code training} to the same fixture; Task 4 adds the rest.
 */
class DayEvaluationEngineTest {

    /** Values from constraints.md / the task-2 brief's config defaults. */
    private final DayEvaluationProperties props = new DayEvaluationProperties(
        new DayEvaluationProperties.Weights(0.30, 0.15, 0.20, 0.15, 0.10, 0.10),
        new DayEvaluationProperties.NutritionBands(0.10, 0.05, 3.0, 0.05, 2.5, 0.15, 1.5),
        150,   // workoutDayKcalWiden
        7.5,   // sleepTargetH
        7,     // rhythmWindowDays
        3,     // rhythmMinDays
        120);  // logTimelyMin

    private final DayEvaluationEngine engine = new DayEvaluationEngine(props);

    /** Fluent {@link DayInputs} fixture. Defaults sit at a "full-fit" nutrition baseline
     *  (consumed == target on every macro) so a test can override just the one field it's
     *  probing without the other nutrition components dragging the score down. */
    private static final class DayInputsBuilder {
        private LocalDate date = LocalDate.of(2026, 9, 2);
        private boolean closed = true;
        private Double kcal = 2600.0;
        private Double proteinG = 170.0;
        private Double carbsG = 310.0;
        private Double fatG = 80.0;
        private Double kcalTarget = 2600.0;
        private Double proteinTargetG = 170.0;
        private Double carbsTargetG = 310.0;
        private Double fatTargetG = 80.0;
        private boolean workoutDay = false;
        private List<MealLogFact> meals = List.of();
        private Integer plannedWorkouts = null;
        private Integer doneWorkouts = null;
        private Double sleepH = null;
        private Integer sleepQuality1to10 = null;
        private boolean waterLogged = false;
        private int checkinCount = 0;
        private Double weightKg = null;
        private Integer xp = null;
        private List<Integer> priorBaseScores = List.of();

        DayInputsBuilder kcal(double v) {
            this.kcal = v;
            return this;
        }

        DayInputsBuilder proteinG(double v) {
            this.proteinG = v;
            return this;
        }

        DayInputsBuilder carbsG(double v) {
            this.carbsG = v;
            return this;
        }

        DayInputsBuilder fatG(double v) {
            this.fatG = v;
            return this;
        }

        DayInputsBuilder targets(double kcalT, double proteinT, double carbsT, double fatT) {
            this.kcalTarget = kcalT;
            this.proteinTargetG = proteinT;
            this.carbsTargetG = carbsT;
            this.fatTargetG = fatT;
            return this;
        }

        DayInputsBuilder kcalTarget(double v) {
            this.kcalTarget = v;
            return this;
        }

        DayInputsBuilder workoutDay(boolean v) {
            this.workoutDay = v;
            return this;
        }

        DayInputsBuilder closed(boolean v) {
            this.closed = v;
            return this;
        }

        DayInputsBuilder noKcalLogged() {
            this.kcal = null;
            return this;
        }

        DayInputsBuilder noCarbFatLogged() {
            this.carbsG = null;
            this.fatG = null;
            return this;
        }

        DayInputsBuilder meals(List<MealLogFact> v) {
            this.meals = v;
            return this;
        }

        DayInputsBuilder plannedWorkouts(Integer v) {
            this.plannedWorkouts = v;
            return this;
        }

        DayInputsBuilder doneWorkouts(Integer v) {
            this.doneWorkouts = v;
            return this;
        }

        DayInputsBuilder sleepH(double v) {
            this.sleepH = v;
            return this;
        }

        DayInputsBuilder sleepQuality1to10(int v) {
            this.sleepQuality1to10 = v;
            return this;
        }

        DayInputsBuilder waterLogged(boolean v) {
            this.waterLogged = v;
            return this;
        }

        DayInputsBuilder checkinCount(int v) {
            this.checkinCount = v;
            return this;
        }

        DayInputsBuilder priorBaseScores(List<Integer> v) {
            this.priorBaseScores = v;
            return this;
        }

        DayInputsBuilder weightKg(double v) {
            this.weightKg = v;
            return this;
        }

        DayInputsBuilder xp(int v) {
            this.xp = v;
            return this;
        }

        DayInputs build() {
            return new DayInputs(date, closed, kcal, proteinG, carbsG, fatG,
                kcalTarget, proteinTargetG, carbsTargetG, fatTargetG, workoutDay,
                plannedWorkouts, doneWorkouts, sleepH, sleepQuality1to10, meals,
                waterLogged, checkinCount, weightKg, xp, priorBaseScores);
        }
    }

    private static DayInputs closedDay(Consumer<DayInputsBuilder> customize) {
        DayInputsBuilder b = new DayInputsBuilder();
        customize.accept(b);
        return b.build();
    }

    /** A closed day with NO log of any kind — {@link DayEvaluationEngine#anyLogPresent} is false
     *  (mezo-el0t). Returns the builder (not a built {@link DayInputs}) so a caller can layer one
     *  or two fields on top before {@code .build()}, per {@code a_weigh_in_only_day_counts_as_logged}
     *  and friends. */
    private static DayInputsBuilder untouchedClosedDay() {
        DayInputsBuilder b = new DayInputsBuilder();
        b.noKcalLogged();
        return b;
    }

    /** Builds a closed day at the given kcal target with the customization applied, evaluates it,
     *  and returns the nutrition dimension's score — isolates the kcal-fit component since the
     *  builder's other macros default to a full-fit baseline. */
    private static int score(DayEvaluationEngine engine, Consumer<DayInputsBuilder> customize,
                             double kcalTarget) {
        DayInputsBuilder b = new DayInputsBuilder();
        b.kcalTarget(kcalTarget);
        customize.accept(b);
        DayEvaluation e = engine.evaluate(b.build());
        return dim(e, "nutrition").score();
    }

    private static DayDimension dim(DayEvaluation e, String id) {
        return e.dimensions().stream().filter(d -> d.id().equals(id)).findFirst()
            .orElseThrow(() -> new AssertionError("no dimension " + id));
    }

    @Test
    void nutrition_insideAsymmetricBands_fullScore() {
        // kcal 2450/2600 (-5.77% under target, under-band 10% -> inside, no penalty)
        // protein 170/170 (exact match, no deficit)
        // carbs 300/310 (-3.2%), fat 75/80 (-6.25%) -- both inside the 15% carb/fat band
        // kcalFit=1.0, proteinFit=1.0, carbFatFit=1.0 -> 0.5+0.3+0.2 = 1.0 -> 100
        DayEvaluation e = engine.evaluate(closedDay(b -> b.kcal(2450.0).proteinG(170.0)
            .carbsG(300.0).fatG(75.0).targets(2600, 170, 310, 80)));
        assertThat(dim(e, "nutrition").score()).isEqualTo(100);
    }

    @Test
    void nutrition_kcalOverIsPenalizedHarderThanUnder() {
        // overBy8pct: relOver = 2808/2600 - 1 = 0.08; over = 0.08 - 0.05(overBand) = 0.03
        //   kcalFit = 1 - 0.03*3 = 0.91 -> nutrition = 0.5*0.91 + 0.3 + 0.2 = 0.955 -> round -> 96
        // underBy8pct: relUnder = 1 - 2392/2600 = 0.08; under = 0.08 - 0.10(underBand) = 0 (inside band)
        //   kcalFit = 1.0 -> nutrition = 0.5 + 0.3 + 0.2 = 1.0 -> 100
        int overBy8pct = score(engine, b -> b.kcal(2808.0), 2600);   // +8% (over-band 5%)
        int underBy8pct = score(engine, b -> b.kcal(2392.0), 2600);  // -8% (under-band 10% -> bent)
        assertThat(underBy8pct).isGreaterThan(overBy8pct);
    }

    @Test
    void nutrition_proteinSurplusForgiven_deficitCounts() {
        // 190/170 (surplus): relUnder = max(0, 1 - 190/170) = 0 -> proteinFit = 1.0 -> nutrition 100
        // 170/170 (exact): relUnder = 0 -> proteinFit = 1.0 -> nutrition 100 -- equal to the surplus case
        int surplus = score(engine, b -> b.proteinG(190.0), 2600);
        int exact = score(engine, b -> b.proteinG(170.0), 2600);
        assertThat(surplus).isEqualTo(exact);

        // 150/170 (deficit): relUnder = 1 - 150/170 = 0.1176; under = 0.1176 - 0.05 = 0.0676
        //   proteinFit = 1 - 0.0676*2.5 = 0.831 -> nutrition = 0.5 + 0.3*0.831 + 0.2 = 0.9494 -> 95
        int deficit = score(engine, b -> b.proteinG(150.0), 2600);
        assertThat(deficit).isEqualTo(95);
    }

    @Test
    void nutrition_workoutDayWidensKcalTopBand() {
        // At kcal=2750=target(2600)+widen(150): with workoutDay, top=2750 -> relOver=0 -> kcalFit=1.0
        // -> nutrition = 0.5+0.3+0.2 = 1.0 -> 100
        int widened = score(engine, b -> b.kcal(2750.0).workoutDay(true), 2600);
        assertThat(widened).isEqualTo(100);

        // Same kcal, no workoutDay: top=2600 -> relOver=2750/2600-1=0.0577; over=0.0577-0.05=0.0077
        //   kcalFit = 1 - 0.0077*3 = 0.9769 -> nutrition = 0.5*0.9769+0.3+0.2 = 0.98846 -> round -> 99
        int notWidened = score(engine, b -> b.kcal(2750.0).workoutDay(false), 2600);
        assertThat(notWidened).isLessThan(widened);
    }

    @Test
    void nutrition_noKcalLogged_degradesAndWeightRenormalizes() {
        DayEvaluation e = engine.evaluate(closedDay(DayInputsBuilder::noKcalLogged));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("NO_DATA");
        assertThat(nutrition.score()).isNull();
        // renormalized weight: nutrition itself is degraded -> 0, regardless of what else survives
        assertThat(nutrition.weight()).isZero();
        // noKcalLogged() alone leaves this fixture fully untouched (no meals/water/check-ins/
        // sleep/workout/weigh-in/XP either) -- every dimension, including `logging`, degrades to
        // NO_DATA (mezo-el0t) -> 0 DONE dimensions -> no overall score
        assertThat(e.base()).isNull();
    }

    @Test
    void nutrition_openDay_isInProgressWithNullScore() {
        DayEvaluation e = engine.evaluate(closedDay(b -> b.closed(false)));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("IN_PROGRESS");
        assertThat(nutrition.score()).isNull();
        assertThat(e.base()).isNull();
    }

    @Test
    void nutrition_and_logging_bothDone_weightsRenormalizeToSumOne() {
        // The plain default fixture (no customization) closes with exactly two DONE dimensions
        // now that logging is one of the six: nutrition (full-fit kcal/protein/carb-fat -> 100)
        // and logging (0 meals -> meal-part drops out; water=false, checkinCount=0 are real
        // measurements, not missing data -> DONE with score 0). quality/training/sleep/rhythm all
        // degrade to NO_DATA (no meals-with-nova, no planned workouts, no sleep log, no prior
        // scores). Their configured weights (.30 nutrition, .10 logging) renormalize over their
        // combined .40 share: 0.30/0.40=0.75, 0.10/0.40=0.25 -- summing back to 1.0, the same
        // renormalization property this test verified back when nutrition was the only dimension.
        DayEvaluation e = engine.evaluate(closedDay(b -> { }));
        DayDimension nutrition = dim(e, "nutrition");
        DayDimension logging = dim(e, "logging");
        assertThat(nutrition.status()).isEqualTo("DONE");
        assertThat(nutrition.score()).isEqualTo(100);
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isEqualTo(0);
        assertThat(nutrition.weight()).isCloseTo(0.75, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(logging.weight()).isCloseTo(0.25, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(nutrition.weight() + logging.weight())
            .isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-9));
        // >=2 DONE dimensions on a closed day -> base = round(0.75*100 + 0.25*0) = 75
        assertThat(e.base()).isEqualTo(75);
    }

    // --- Review round 1 fixes: no invented score for unmeasured carb/fat data; no NaN/Infinity
    //     from a non-positive target -----------------------------------------------------------

    @Test
    void nutrition_missingCarbFatData_dropsOutAndRenormalizesKcalProtein() {
        // protein deficit 150/170 -> proteinFit = 0.830882 (see the deficit case above).
        // kcal 2600/2600 (=target) -> kcalFit = 1.0. carbsG/fatG null but the targets ARE set
        // (310/80, the builder default) -- this is missing DATA against a real target, not a
        // missing target, so the carb/fat component drops out and kcal/protein renormalize over
        // their combined 0.8 share instead of the component getting an invented full score:
        //   value = (0.5*1.0 + 0.3*0.830882) / 0.8 = 0.749265 / 0.8 = 0.936581 -> round*100 -> 94
        // (had the old bug awarded the missing component a full 1.0 instead of dropping out, the
        // score would have been 95 -- see nutrition_proteinSurplusForgiven_deficitCounts's
        // deficit case, which is the same protein input with a MEASURED, on-target carb/fat pair)
        DayEvaluation e = engine.evaluate(closedDay(b -> b.proteinG(150.0).noCarbFatLogged()));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("DONE");
        assertThat(nutrition.score()).isEqualTo(94);
        assertThat(nutrition.facts()).contains(new DayEvaluationEngine.DimFact("c · f", "nincs adat"));
    }

    @Test
    void nutrition_missingCarbFatTarget_isForgiven_fullCredit() {
        // carbsTargetG/fatTargetG = 0 (no target ever set for them) -- a DIFFERENT case from the
        // one above: no expectation was set, so the component is forgiven (full credit), matching
        // the brief's original null-target policy. kcal/protein both at-target -> kcalFit=
        // proteinFit=1.0 -> value = 0.5 + 0.3 + 0.2*1.0 = 1.0 -> 100.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.targets(2600, 170, 0, 80)));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("DONE");
        assertThat(nutrition.score()).isEqualTo(100);
    }

    @Test
    void nutrition_nonPositiveKcalTarget_isTreatedAsNoTarget_degradesToNoData() {
        // kcalTarget = 0 is not null, so it would otherwise slip past the null-check and divide
        // by zero inside kcalFit -- must be caught the same way a null target is.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.kcalTarget(0.0)));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("NO_DATA");
        assertThat(nutrition.score()).isNull();
    }

    @Test
    void nutrition_nonPositiveProteinTarget_isTreatedAsNoTarget_degradesToNoData() {
        DayEvaluation e = engine.evaluate(closedDay(b -> b.targets(2600, -5, 310, 80)));
        DayDimension nutrition = dim(e, "nutrition");
        assertThat(nutrition.status()).isEqualTo("NO_DATA");
        assertThat(nutrition.score()).isNull();
    }

    // --- Task 3: quality + training -----------------------------------------------------------

    @Test
    void quality_kcalWeightedMeanOfMealNovaScores_blendedWithMicro() {
        // két meal: nova 0.9 (600 kcal), nova 0.5 (200 kcal) -> nova-rész
        //   (0.9*600 + 0.5*200) / 800 = (540 + 100) / 800 = 0.8
        // micro-átlag (0.6 + 0.6) / 2 = 0.6
        // quality = 0.75*0.8 + 0.25*0.6 = 0.6 + 0.15 = 0.75 -> 75
        List<MealLogFact> meals = List.of(
            new MealLogFact(null, null, null, 0.9, 0.6, 600),
            new MealLogFact(null, null, null, 0.5, 0.6, 200));
        DayEvaluation e = engine.evaluate(closedDay(b -> b.meals(meals)));
        DayDimension quality = dim(e, "quality");
        assertThat(quality.status()).isEqualTo("DONE");
        assertThat(quality.score()).isEqualTo(75);
    }

    @Test
    void quality_mealsWithoutNovaScores_degrade() {
        // novaDimScore=null mindenhol -- nincs alap a pontozásra, a micro adat léte sem menti meg
        // (honesty rule: nem találunk ki neutrális/hiányzó-helyettesítő értéket).
        List<MealLogFact> meals = List.of(
            new MealLogFact(null, null, null, null, 0.6, 600),
            new MealLogFact(null, null, null, null, 0.5, 200));
        DayEvaluation e = engine.evaluate(closedDay(b -> b.meals(meals)));
        DayDimension quality = dim(e, "quality");
        assertThat(quality.status()).isEqualTo("NO_DATA");
        assertThat(quality.score()).isNull();
        assertThat(quality.weight()).isZero();
    }

    @Test
    void training_restDayIsNeutral() {
        // plannedWorkouts=0 -> a training dim NO_DATA "Pihenőnap" ténnyel, súlya kiesik -- a nap
        // NEM kap edzés-levonást a pihenésért.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.plannedWorkouts(0)));
        DayDimension training = dim(e, "training");
        assertThat(training.status()).isEqualTo("NO_DATA");
        assertThat(training.score()).isNull();
        assertThat(training.weight()).isZero();
        assertThat(training.facts()).anyMatch(f -> f.value().contains("Pihenőnap"));
    }

    @Test
    void training_plannedAndDone_scoresFull() {
        // planned=1, done=1 -> done/planned=1 -> 0.3 + 0.7*1 = 1.0 -> 100
        DayEvaluation e = engine.evaluate(closedDay(b -> b.plannedWorkouts(1).doneWorkouts(1)));
        DayDimension training = dim(e, "training");
        assertThat(training.status()).isEqualTo("DONE");
        assertThat(training.score()).isEqualTo(100);
    }

    @Test
    void training_plannedButSkipped_scoresLow() {
        // planned=1, done=0, zárt nap -> DONE (a nap zárult) -> 0.3 + 0.7*0 = 0.3 -> 30
        DayEvaluation e = engine.evaluate(closedDay(b -> b.plannedWorkouts(1).doneWorkouts(0)));
        DayDimension training = dim(e, "training");
        assertThat(training.status()).isEqualTo("DONE");
        assertThat(training.score()).isEqualTo(30);
    }

    @Test
    void training_openDayNotYetDone_isInProgress() {
        // planned=1, done=0, nyitott nap -> done < planned és a nap nem zárult -> IN_PROGRESS
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.closed(false).plannedWorkouts(1).doneWorkouts(0)));
        DayDimension training = dim(e, "training");
        assertThat(training.status()).isEqualTo("IN_PROGRESS");
        assertThat(training.score()).isNull();
    }

    // --- Task 4: sleep + logging + rhythm + honesty gate --------------------------------------

    @Test
    void sleep_durationBlendedWithQuality() {
        // 6.33h/7.5 cél -> d = 0.84400; Q6 -> (6-1)/9 = 0.55556
        // value = 0.7*0.84400 + 0.3*0.55556 = 0.59080 + 0.16667 = 0.75747 -> round*100 -> 76
        DayEvaluation e = engine.evaluate(closedDay(b -> b.sleepH(6.33).sleepQuality1to10(6)));
        DayDimension sleep = dim(e, "sleep");
        assertThat(sleep.status()).isEqualTo("DONE");
        assertThat(sleep.score()).isEqualTo(76);
    }

    @Test
    void sleep_presentOnOpenDay_isDone() {
        // A+ lifecycle: sleep finalizes independently of the day's own closure -- a sleep log on
        // an OPEN day is still DONE (unlike nutrition/quality/training/logging/rhythm, which wait
        // for day close).
        DayEvaluation e = engine.evaluate(closedDay(b -> b.closed(false).sleepH(7.5)));
        DayDimension sleep = dim(e, "sleep");
        assertThat(sleep.status()).isEqualTo("DONE");
        assertThat(sleep.score()).isEqualTo(100);
    }

    @Test
    void logging_timelyMealsWaterCheckins() {
        // 4/4 meal logolva a slot-ablak+logTimelyMin(120p)-en belül -> mealPart = 1.0
        // víz logolva -> 1.0; 3 check-in a 4-ből -> min(1, 3/4) = 0.75
        // value = 0.5*1.0 + 0.2*1.0 + 0.3*0.75 = 0.5 + 0.2 + 0.225 = 0.925 -> round*100 -> 93
        List<MealLogFact> meals = List.of(
            new MealLogFact("breakfast", LocalTime.of(8, 10), LocalTime.of(8, 0), null, null, 500),
            new MealLogFact("lunch", LocalTime.of(12, 30), LocalTime.of(12, 0), null, null, 700),
            new MealLogFact("dinner", LocalTime.of(19, 50), LocalTime.of(19, 0), null, null, 700),
            new MealLogFact("snack", LocalTime.of(21, 30), LocalTime.of(21, 0), null, null, 300));
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.meals(meals).waterLogged(true).checkinCount(3)));
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isEqualTo(93);
    }

    @Test
    void logging_lateLogsLowerTheScore() {
        // 2/4 meal logolva 120 percen túl (180p késés) -> mealPart = 2/4 = 0.5
        // víz logolva -> 1.0; 4/4 check-in -> 1.0
        // value = 0.5*0.5 + 0.2*1.0 + 0.3*1.0 = 0.25 + 0.2 + 0.3 = 0.75 -> 75 (< a teljes 93-nál)
        List<MealLogFact> meals = List.of(
            new MealLogFact("breakfast", LocalTime.of(8, 10), LocalTime.of(8, 0), null, null, 500),
            new MealLogFact("lunch", LocalTime.of(12, 30), LocalTime.of(12, 0), null, null, 700),
            new MealLogFact("dinner", LocalTime.of(19, 0), LocalTime.of(16, 0), null, null, 700),
            new MealLogFact("snack", LocalTime.of(23, 0), LocalTime.of(20, 0), null, null, 300));
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.meals(meals).waterLogged(true).checkinCount(4)));
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isEqualTo(75);
    }

    /**
     * Review round 1, Important 4: {@link MealLogFact} carries wall-clock {@link LocalTime}s with
     * no date, so a dinner eaten 23:30 and logged 00:10 — an entirely ordinary pattern — used to
     * read as 1160 minutes late and zero the meal component. Timeliness is now the CIRCULAR
     * distance {@code min(|delta|, 1440 - |delta|)} = 40 minutes, comfortably inside the 120-minute
     * band.
     */
    @Test
    void logging_aMealLoggedJustAfterMidnightIsTimelyNotADayLate() {
        List<MealLogFact> meals = List.of(
            new MealLogFact("dinner", LocalTime.of(0, 10), LocalTime.of(23, 30), null, null, 700));
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.meals(meals).waterLogged(true).checkinCount(4)));
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        // mealPart 1.0 -> 0.5*1.0 + 0.2*1.0 + 0.3*1.0 = 1.0 -> 100
        assertThat(logging.score()).isEqualTo(100);
    }

    /** The other side of the circular reading: half a day apart is the FARTHEST two times of day
     *  can be, so a breakfast written up in the evening is still late — the wrap must not quietly
     *  forgive everything. */
    @Test
    void logging_aHalfDayLateLogIsStillLate() {
        List<MealLogFact> meals = List.of(
            new MealLogFact("breakfast", LocalTime.of(20, 0), LocalTime.of(8, 0), null, null, 500));
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.meals(meals).waterLogged(true).checkinCount(4)));
        DayDimension logging = dim(e, "logging");
        // mealPart 0.0 -> 0.2*1.0 + 0.3*1.0 = 0.5 -> 50
        assertThat(logging.score()).isEqualTo(50);
    }

    @Test
    void logging_noMealsLogged_mealPartDropsOutAndRenormalizes() {
        // 0 meal -> a meal-rész (0.5) kiesik, a maradék két rész arányosan skálázódik: 0.2/0.5=0.4,
        // 0.3/0.5=0.6. víz logolva -> 1.0; 2/4 check-in -> 0.5
        // value = 0.4*1.0 + 0.6*0.5 = 0.4 + 0.3 = 0.7 -> 70
        DayEvaluation e = engine.evaluate(
            closedDay(b -> b.meals(List.of()).waterLogged(true).checkinCount(2)));
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isEqualTo(70);
    }

    @Test
    void rhythm_meanOfPriorBaseScores_minDaysGate() {
        // rhythmMinDays = 3, [84, 72, 80] van 3 nap -> mean = 236/3 = 78.667 -> round -> 79
        DayEvaluation enough = engine.evaluate(closedDay(b -> b.priorBaseScores(List.of(84, 72, 80))));
        DayDimension rhythmEnough = dim(enough, "rhythm");
        assertThat(rhythmEnough.status()).isEqualTo("DONE");
        assertThat(rhythmEnough.score()).isEqualTo(79);

        // 2 elem < rhythmMinDays(3) -> NO_DATA, súlya kiesik
        DayEvaluation notEnough = engine.evaluate(closedDay(b -> b.priorBaseScores(List.of(84, 72))));
        DayDimension rhythmNotEnough = dim(notEnough, "rhythm");
        assertThat(rhythmNotEnough.status()).isEqualTo("NO_DATA");
        assertThat(rhythmNotEnough.score()).isNull();
        assertThat(rhythmNotEnough.weight()).isZero();
    }

    @Test
    void overall_fewerThanTwoDoneDims_isNull() {
        // nutrition/quality/training/sleep/rhythm mind adat nélkül degradálnak (nincs kcal, nincs
        // meal, nincs terv, nincs alvás-log egy zárt napon, nincs elég korábbi nap). A logging
        // dimenziónak a Task 4 fix után is csak a SAJÁT bemeneteire (meal/víz/check-in) nézve
        // nincs NO_DATA menekülőútja -- de mezo-el0t óta az EGÉSZ napra nézve van: ha ez lenne az
        // egyetlen log a napon, a logging is NO_DATA-ra degradálna. A checkinCount(1) itt a nap
        // EGYETLEN logja -- anyLogPresent igaz, logging DONE marad, őszinte (alacsony) ponttal.
        // Ez pontosan a <2-DONE kaput teszteli: ha a kapu (doneCount >= 2) eltűnne,
        // a base = round(1.0 * 15) = 15 lenne, nem null.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.noKcalLogged().checkinCount(1)));
        long doneCount = e.dimensions().stream().filter(d -> "DONE".equals(d.status())).count();
        assertThat(doneCount).isEqualTo(1);
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isEqualTo(15);
        assertThat(logging.weight()).isEqualTo(1.0);
        assertThat(e.base()).isNull();
    }

    /**
     * The gate the review round-2 Important fix installed: {@code rhythm} is EXTRINSIC — the mean
     * of OTHER days' bases — so it may not open the data-sufficiency gate on its own. This is the
     * case {@code overall_fewerThanTwoDoneDims_isNull} could not reach: it passes an EMPTY prior
     * list, the one situation where rhythm cannot be DONE at all. With three priors, rhythm IS
     * DONE (79 = round(236/3)) and, before the fix, paired with logging's honest 0 to yield
     * base = round(0.5*0 + 0.5*79) = 40 for a day on which the user logged absolutely nothing.
     */
    @Test
    void overall_untouchedClosedDayWithPriors_stillHasNoBaseScore() {
        // mezo-el0t: this fixture is now a fully UNTOUCHED day (no kcal, no meals, no water, no
        // check-ins, no sleep, no workout, no weigh-in, no XP) -- `logging` degrades to NO_DATA
        // too, not just nutrition. rhythm alone still cannot open the gate.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.noKcalLogged()
            .priorBaseScores(List.of(84, 72, 80))));

        assertThat(dim(e, "rhythm").status()).isEqualTo("DONE");
        assertThat(dim(e, "rhythm").score()).isEqualTo(79);
        assertThat(dim(e, "logging").status()).isEqualTo("NO_DATA");
        assertThat(dim(e, "logging").score()).isNull();
        // rhythm is the ONLY DONE dimension, and it is EXTRINSIC -> below the 2-dimension gate
        assertThat(e.base()).isNull();
    }

    /** The other side of the same gate: a dimension that DID measure the day opens it, and rhythm
     *  keeps its weight in the sum once it is open. A planned-but-skipped workout is real evidence
     *  about the day (training DONE at 30), so it scores even though nothing else was logged. */
    @Test
    void overall_skippedPlannedWorkout_scoresAndRhythmStillCarriesWeight() {
        // A skipped workout (doneWorkouts=0) is a PLAN comparison, not itself something the user
        // logged that day -- anyLogPresent only counts doneWorkouts > 0 (mezo-el0t). So this
        // fixture also logs a single check-in, keeping `logging` DONE (mezo-el0t narrows the
        // NO_DATA escape hatch to a day with NO log of any kind, not to this dimension's own
        // inputs) alongside `training`, which still measures the plan-vs-actual gap regardless.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.noKcalLogged().checkinCount(1)
            .plannedWorkouts(1).doneWorkouts(0).priorBaseScores(List.of(84, 72, 80))));

        assertThat(dim(e, "training").score()).isEqualTo(30);   // 0.3 + 0.7*0
        assertThat(dim(e, "logging").status()).isEqualTo("DONE");
        assertThat(dim(e, "logging").score()).isEqualTo(15);    // (0.3*0.25)/0.5 -> 0.15 -> 15
        assertThat(dim(e, "rhythm").score()).isEqualTo(79);
        // weights .20 training + .10 logging + .10 rhythm = .40 -> 0.5 / 0.25 / 0.25
        // base = round(0.5*30 + 0.25*15 + 0.25*79) = round(38.5) = 39
        assertThat(e.base()).isEqualTo(39);
    }

    /** A lone sleep log is also a measurement of THIS day, so it opens the gate too. */
    @Test
    void overall_onlyASleepLog_stillScores() {
        DayEvaluation e = engine.evaluate(closedDay(b -> b.noKcalLogged().sleepH(7.5)));

        assertThat(dim(e, "sleep").score()).isEqualTo(100);
        // .15 sleep + .10 logging = .25 -> 0.6 / 0.4; base = round(0.6*100 + 0.4*0) = 60
        assertThat(e.base()).isEqualTo(60);
    }

    @Test
    void overall_openDay_hasNoBaseScore() {
        // closed=false -> nincs összpontszám, de a dimenziók státusza él: sleep DONE marad (A+
        // lifecycle), a többi (pl. nutrition) IN_PROGRESS.
        DayEvaluation e = engine.evaluate(closedDay(b -> b.closed(false).sleepH(7.5)));
        assertThat(e.base()).isNull();
        assertThat(dim(e, "sleep").status()).isEqualTo("DONE");
        assertThat(dim(e, "nutrition").status()).isEqualTo("IN_PROGRESS");
    }

    // --- Task 2 (mezo-el0t): logging is not measurable on a day with NO log of any kind --------

    @Test
    void logging_is_not_measurable_on_a_day_with_no_logs_at_all() {
        // The contract (me-week.yml) has always said: "null = not measurable this day -- never 0".
        // Until now the engine sent an honest-looking 0 regardless, so "no data" could never
        // actually occur in production for this dimension (mezo-el0t).
        DayEvaluation e = engine.evaluate(untouchedClosedDay().build());
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("NO_DATA");
        assertThat(logging.score()).isNull();
    }

    @Test
    void logging_STILL_penalises_a_day_that_was_lived_but_not_logged() {
        // The loggingDim javadoc's earlier review decision (:348-359) is untouched: someone who
        // trained and slept, but logged no meals/water/check-ins, is still measurable and still
        // gets an honest 0.
        DayEvaluation e = engine.evaluate(untouchedClosedDay()
            .doneWorkouts(1).sleepH(7.5).build());
        DayDimension logging = dim(e, "logging");
        assertThat(logging.status()).isEqualTo("DONE");
        assertThat(logging.score()).isZero();
    }

    @Test
    void a_weigh_in_only_day_counts_as_logged() {
        // mezo-jcpt.8: this used to read as 'empty', even though the user DID do something.
        assertThat(DayEvaluationEngine.anyLogPresent(
            untouchedClosedDay().weightKg(74.2).build())).isTrue();
    }

    @Test
    void an_untouched_day_stays_below_the_gate_even_with_priors() {
        // REGRESSION PIN -- the Köteg A/B lesson: rhythm is extrinsic, it may not open the gate
        // alone. Now structurally true too: zero intrinsic DONE dimensions.
        DayEvaluation e = engine.evaluate(untouchedClosedDay()
            .priorBaseScores(List.of(70, 78, 80)).build());
        assertThat(e.base()).isNull();
    }
}
