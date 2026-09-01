package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DetectorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 27);

    private DetectorInput input(Set<LocalDate> mealDates, Map<LocalDate, Integer> checkins,
                                List<DetectorInput.WeightPoint> weights,
                                Map<LocalDate, List<String>> journal) {
        return input(mealDates, checkins, weights, journal, List.of(), List.of(), List.of(), List.of(),
                null, emptyTrend());
    }

    /** Full-control builder for the round-1 detectors; existing helper delegates here. */
    private DetectorInput input(Set<LocalDate> mealDates, Map<LocalDate, Integer> checkins,
            List<DetectorInput.WeightPoint> weights, Map<LocalDate, List<String>> journal,
            List<DetectorInput.GymDay> gymDays, List<DetectorInput.SportPoint> sport,
            List<DetectorInput.RunPoint> runs, List<DetectorInput.SleepPoint> sleep,
            DetectorInput.MesoContext meso, DetectorInput.TrendWindow trend) {
        return new DetectorInput(DAY, mealDates, checkins, weights, journal,
                gymDays, sport, runs, sleep, meso, trend);
    }

    static DetectorInput.TrendWindow emptyTrend() {
        return new DetectorInput.TrendWindow(List.of(), List.of(), List.of(), List.of(),
                null, List.of(), null);
    }

    /** Full-control builder for the round-2 detectors: only the trend window varies. */
    private DetectorInput trendInput(DetectorInput.TrendWindow trend) {
        return new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), List.of(), null, trend);
    }

    private static DetectorInput.MealDayPoint meal(LocalDate d, String kcal, String protein,
                                                   String nova4Share) {
        return new DetectorInput.MealDayPoint(d, new BigDecimal(kcal), new BigDecimal(protein),
                new BigDecimal("200"), new BigDecimal("60"),
                nova4Share == null ? null : new BigDecimal(nova4Share),
                nova4Share == null ? null : new BigDecimal("1.0000"),
                new BigDecimal("3100"), new BigDecimal("220"), List.of());
    }

    /** Same as {@link #meal} but with an explicit (possibly thin) NOVA coverage fraction. */
    private static DetectorInput.MealDayPoint mealWithCoverage(LocalDate d, String kcal,
            String protein, String nova4Share, String novaCoveragePct) {
        return new DetectorInput.MealDayPoint(d, new BigDecimal(kcal), new BigDecimal(protein),
                new BigDecimal("200"), new BigDecimal("60"),
                nova4Share == null ? null : new BigDecimal(nova4Share),
                novaCoveragePct == null ? null : new BigDecimal(novaCoveragePct),
                new BigDecimal("3100"), new BigDecimal("220"), List.of());
    }

    private static DetectorInput.CheckinDayPoint checkin(LocalDate d, String energy, String stress,
                                                         String mental) {
        return new DetectorInput.CheckinDayPoint(d, 1, new BigDecimal(energy), new BigDecimal(stress),
                new BigDecimal("7"), new BigDecimal(mental));
    }

    private static DetectorInput.TrendWindow trend(List<DetectorInput.MealDayPoint> meals,
                                                   List<DetectorInput.WaterDayPoint> water,
                                                   DetectorInput.StackContext stack,
                                                   List<DetectorInput.CheckinDayPoint> checkins,
                                                   DetectorInput.MedContext med,
                                                   List<DetectorInput.GymDay> gym) {
        return new DetectorInput.TrendWindow(List.of(), gym, meals, water, stack, checkins, med);
    }

    @Test
    void loggingGap_firesOnStreak_quietWhenTodayLogged() {
        LoggingGapDetector d = new LoggingGapDetector();
        // meals last seen 3 days ago -> streak 3
        List<DetectorSignal> fired = d.detect(input(Set.of(DAY.minusDays(3)),
                Map.of(), List.of(), Map.of()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("logging-gap");
            assertThat(s.expertKey()).isEqualTo("drill");
            assertThat(s.salience()).isEqualTo(3);
            assertThat(s.summary()).contains("3");
        });
        assertThat(d.detect(input(Set.of(DAY), Map.of(), List.of(), Map.of()))).isEmpty();
    }

    @Test
    void loggingGap_capsHonestly_whenStreakExceedsWindow() {
        LoggingGapDetector d = new LoggingGapDetector();
        // no meals anywhere in the 14-day window -> streak hits the cap, no "utolsó:" clause possible
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.salience()).isEqualTo(5);
            assertThat(s.summary()).isEqualTo("legalább 14 napja nincs étkezés logolva.");
            assertThat(s.summary()).doesNotContain("14. napja");
        });
    }

    @Test
    void underLogging_firesOnGapsPlusRisingWeight_quietWithoutTrend() {
        UnderLoggingDetector d = new UnderLoggingDetector();
        // 4 of last 7 days without meals + weight +0.6 kg
        Set<LocalDate> meals = Set.of(DAY, DAY.minusDays(2), DAY.minusDays(4));
        List<DetectorInput.WeightPoint> rising = List.of(
                new DetectorInput.WeightPoint(DAY.minusDays(7), new BigDecimal("81.2")),
                new DetectorInput.WeightPoint(DAY, new BigDecimal("81.8")));
        assertThat(d.detect(input(meals, Map.of(), rising, Map.of()))).singleElement()
                .satisfies(s -> {
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.salience()).isEqualTo(4);
                    // HU decimal-comma formatting (mezo-1gim.4 item 1) — never BigDecimal.toString()'s dot
                    assertThat(s.summary()).contains("+0,6 kg (81,2 → 81,8)");
                    assertThat(s.summary()).doesNotContain("0.6").doesNotContain("81.2").doesNotContain("81.8");
                });
        // same gaps, flat weight -> quiet
        List<DetectorInput.WeightPoint> flat = List.of(
                new DetectorInput.WeightPoint(DAY.minusDays(7), new BigDecimal("81.2")),
                new DetectorInput.WeightPoint(DAY, new BigDecimal("81.3")));
        assertThat(d.detect(input(meals, Map.of(), flat, Map.of()))).isEmpty();
    }

    @Test
    void journalNote_carriesCappedText_journalSilence_firesAfterSevenQuietDays() {
        JournalNoteDetector note = new JournalNoteDetector();
        assertThat(note.detect(input(Set.of(), Map.of(), List.of(),
                Map.of(DAY, List.of("Ma nehéz nap volt.")))))
                .singleElement().satisfies(s -> {
                    assertThat(s.expertKey()).isEqualTo("pszichologus");
                    assertThat(s.summary()).contains("Ma nehéz nap volt.");
                });
        JournalSilenceDetector silence = new JournalSilenceDetector();
        assertThat(silence.detect(input(Set.of(), Map.of(), List.of(), Map.of())))
                .singleElement().satisfies(s -> assertThat(s.expertKey()).isEqualTo("drill"));
        assertThat(silence.detect(input(Set.of(), Map.of(), List.of(),
                Map.of(DAY.minusDays(2), List.of("x"))))).isEmpty();
    }

    @Test
    void checkinGap_firesOnZeroTodayWithActivePriorWeek() {
        CheckinGapDetector d = new CheckinGapDetector();
        Map<LocalDate, Integer> prior = Map.of(
                DAY.minusDays(1), 3, DAY.minusDays(2), 3, DAY.minusDays(3), 2,
                DAY.minusDays(4), 3, DAY.minusDays(5), 2, DAY.minusDays(6), 3,
                DAY.minusDays(7), 2);
        assertThat(d.detect(input(Set.of(), prior, List.of(), Map.of()))).singleElement();
        // today has check-ins -> quiet
        Map<LocalDate, Integer> withToday = new java.util.HashMap<>(prior);
        withToday.put(DAY, 2);
        assertThat(d.detect(input(Set.of(), withToday, List.of(), Map.of()))).isEmpty();
    }

    @Test
    void registry_skipsDisabledDetectors() {
        CharacterProperties props = new CharacterProperties(
                new CharacterProperties.Observation("0 40 2 * * *", 3),
                new CharacterProperties.Conference("0 30 19 * * SUN", 2),
                new CharacterProperties.Monthly("0 0 20 * * SUN", 90),
                new CharacterProperties.Prompt(new BigDecimal("0.30"), 5, 2000, 30),
                Map.of("journal-silence", new CharacterProperties.Detector(false)));
        DetectorRegistry registry = new DetectorRegistry(List.of(
                new JournalSilenceDetector(), new LoggingGapDetector()), props);
        List<DetectorSignal> signals = registry.runAll(
                input(Set.of(DAY.minusDays(2)), Map.of(), List.of(), Map.of()));
        assertThat(signals).extracting(DetectorSignal::detectorKey)
                .containsExactly("logging-gap"); // silence would fire but is switched off
    }

    @Test
    void rirCalibration_firesOnOverestimation_directionInSummary() {
        RirCalibrationDetector d = new RirCalibrationDetector();
        // One GymDay on DAY with one exercise, 6 sets producing 3 over-events
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("100"), 10, 2, null, null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("100"), 10, 3, null, null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(4, new BigDecimal("100"), 9, 2, null, null, false),
                new DetectorInput.SetPoint(5, new BigDecimal("100"), 5, null, null, null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Bench press", 6, 0, sets, null, null, null);
        DetectorInput.GymDay day = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(day), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("rir-calibration");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("felfelé");
            assertThat(s.salience()).isGreaterThanOrEqualTo(2).isLessThanOrEqualTo(5);
        });
    }

    @Test
    void rirCalibration_quietWithoutNewGymData() {
        RirCalibrationDetector d = new RirCalibrationDetector();
        // Same sets but GymDay dated DAY.minusDays(1), no entry for DAY
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("100"), 10, 2, null, null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("100"), 10, 3, null, null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(4, new BigDecimal("100"), 9, 2, null, null, false),
                new DetectorInput.SetPoint(5, new BigDecimal("100"), 5, null, null, null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Bench press", 6, 0, sets, null, null, null);
        DetectorInput.GymDay day = new DetectorInput.GymDay(DAY.minusDays(1), List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(day), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void rirCalibration_quietOnBalancedDirections() {
        RirCalibrationDetector d = new RirCalibrationDetector();
        // 2 over + 2 under events (no dominant direction)
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("100"), 10, 2, null, null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("100"), 10, 3, null, null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("100"), 7, null, null, null, false),
                new DetectorInput.SetPoint(4, new BigDecimal("100"), 5, 0, null, null, false),
                new DetectorInput.SetPoint(5, new BigDecimal("100"), 5, null, null, null, false),
                new DetectorInput.SetPoint(6, new BigDecimal("100"), 3, 0, null, null, false),
                new DetectorInput.SetPoint(7, new BigDecimal("100"), 4, null, null, null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Bench press", 8, 0, sets, null, null, null);
        DetectorInput.GymDay day = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(day), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void niggleMap_mapsRepeatedJointPain_andShoulderStrain() {
        NiggleMapDetector d = new NiggleMapDetector();
        // Two GymDays (one on DAY) with Hack squat pain=2, plus two sport sessions with strain>=6
        List<DetectorInput.SetPoint> emptySets = List.of();
        DetectorInput.ExerciseWork hackSquat1 = new DetectorInput.ExerciseWork(
                "Hack squat", 1, 0, emptySets, 2, null, null);
        DetectorInput.ExerciseWork hackSquat2 = new DetectorInput.ExerciseWork(
                "Hack squat", 1, 0, emptySets, 2, null, null);
        DetectorInput.GymDay gym1 = new DetectorInput.GymDay(DAY, List.of(hackSquat1));
        DetectorInput.GymDay gym2 = new DetectorInput.GymDay(DAY.minusDays(3), List.of(hackSquat2));
        DetectorInput.SportPoint sport1 = new DetectorInput.SportPoint(
                DAY.minusDays(1), "futás", new BigDecimal("7"), 7, null, null);
        DetectorInput.SportPoint sport2 = new DetectorInput.SportPoint(
                DAY.minusDays(2), "kerékpár", new BigDecimal("6"), 6, null, null);
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gym1, gym2), List.of(sport1, sport2), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("niggle-map");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("Hack squat");
            assertThat(s.summary()).contains("váll");
        });
    }

    @Test
    void niggleMap_quietOnSingleOccurrence() {
        NiggleMapDetector d = new NiggleMapDetector();
        // One pain (not enough repeats), one strained session (not enough repeats)
        List<DetectorInput.SetPoint> emptySets = List.of();
        DetectorInput.ExerciseWork hackSquat = new DetectorInput.ExerciseWork(
                "Hack squat", 1, 0, emptySets, 2, null, null);
        DetectorInput.GymDay gym = new DetectorInput.GymDay(DAY, List.of(hackSquat));
        DetectorInput.SportPoint sport = new DetectorInput.SportPoint(
                DAY.minusDays(1), "futás", new BigDecimal("7"), 7, null, null);
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gym), List.of(sport), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void sportInterference_firesOnRepeatedNextDayDecline() {
        SportInterferenceDetector d = new SportInterferenceDetector();
        // 2 heavy sport sessions (strain 7) at DAY-3 and DAY-1, each followed by a gym day
        // (DAY-2, DAY) whose sets show a reps-vs-target decline of -2 -> 2 pairs.
        DetectorInput.SportPoint sport1 = new DetectorInput.SportPoint(
                DAY.minusDays(3), "kosárlabda", null, 7, null, null);
        DetectorInput.SportPoint sport2 = new DetectorInput.SportPoint(
                DAY.minusDays(1), "kosárlabda", null, 7, null, null);
        List<DetectorInput.SetPoint> decliningSets = List.of(
                new DetectorInput.SetPoint(0, null, 6, null, null, 8, false),
                new DetectorInput.SetPoint(1, null, 6, null, null, 8, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Lat pulldown", 2, 0, decliningSets, null, null, null);
        DetectorInput.GymDay gymBefore = new DetectorInput.GymDay(DAY.minusDays(2), List.of(work));
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymBefore, gymOn), List.of(sport1, sport2), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("sport-interference");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("Sport-interferencia");
            assertThat(s.summary()).contains("2");
        });
        // the DAY gym day is what satisfies the gate (newGymData)
        assertThat(DetectorGates.newGymData(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymBefore, gymOn), List.of(sport1, sport2), List.of(), List.of(), null,
                emptyTrend()))).isTrue();
    }

    @Test
    void sportInterference_quietWhenGymHolds() {
        SportInterferenceDetector d = new SportInterferenceDetector();
        DetectorInput.SportPoint sport1 = new DetectorInput.SportPoint(
                DAY.minusDays(3), "kosárlabda", null, 7, null, null);
        DetectorInput.SportPoint sport2 = new DetectorInput.SportPoint(
                DAY.minusDays(1), "kosárlabda", null, 7, null, null);
        List<DetectorInput.SetPoint> holdingSets = List.of(
                new DetectorInput.SetPoint(0, null, 8, null, null, 8, false),
                new DetectorInput.SetPoint(1, null, 8, null, null, 8, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Lat pulldown", 2, 0, holdingSets, null, null, null);
        DetectorInput.GymDay gymBefore = new DetectorInput.GymDay(DAY.minusDays(2), List.of(work));
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymBefore, gymOn), List.of(sport1, sport2), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void mesoAdherence_firesOnMissedPlannedDays() {
        MesoAdherenceDetector d = new MesoAdherenceDetector();
        // week window DAY-6..DAY (Aug21..Aug27): planned Mon/Wed/Fri hits Aug21,24,26 -> all
        // missed (doneDays empty) -> missed=3. A gym day on DAY satisfies the gate.
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Hyper", 3, 6, false,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), Set.of());
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymOn), List.of(), List.of(), List.of(), meso,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("meso-adherence");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("3");
            assertThat(s.summary()).contains("3/6");
        });
    }

    @Test
    void mesoAdherence_dayItselfMissedAloneBelowThresholdIsQuiet() {
        MesoAdherenceDetector d = new MesoAdherenceDetector();
        // Only DAY (Thursday) itself is planned in the trailing week -> missed=1, no new gym
        // data. The day-itself-missed clause must NOT bypass the missed>=2 threshold.
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Hyper", 3, 6, false,
                Set.of(DayOfWeek.THURSDAY), Set.of());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), List.of(), meso,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void mesoAdherence_firesWithoutNewGymDataWhenDayItselfIsSecondMiss() {
        MesoAdherenceDetector d = new MesoAdherenceDetector();
        // Planned Mon + Thu -> Aug24(Mon) and DAY=Aug27(Thu) both missed -> missed=2, one of
        // which is DAY itself, and no new gym data at all. The widened gate (day-itself-missed
        // OR new gym data) must still let this fire once the threshold is met.
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Hyper", 3, 6, false,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.THURSDAY), Set.of());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), List.of(), meso,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("2");
            assertThat(s.summary()).contains("3/6");
        });
    }

    @Test
    void mesoAdherence_deloadSuppresses() {
        MesoAdherenceDetector d = new MesoAdherenceDetector();
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Hyper", 3, 6, true,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), Set.of());
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymOn), List.of(), List.of(), List.of(), meso,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void progressionAdherence_firesOnSystematicUndershoot() {
        ProgressionAdherenceDetector d = new ProgressionAdherenceDetector();
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Squat", 4, 0, sets, null, null, null);
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymOn), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("progression-adherence");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("maradt el");
            assertThat(s.summary()).contains("2,5");
            assertThat(s.summary()).contains("4");
        });
    }

    @Test
    void progressionAdherence_firesOnSystematicOvershoot() {
        ProgressionAdherenceDetector d = new ProgressionAdherenceDetector();
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("90"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("90"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("90"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("90"), 8, null,
                        new BigDecimal("85"), null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Squat", 4, 0, sets, null, null, null);
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of(work));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymOn), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("progression-adherence");
            assertThat(s.summary()).contains("lőtt túl");
            assertThat(s.summary()).contains("2,5");
            assertThat(s.summary()).contains("4");
        });
    }

    @Test
    void progressionAdherence_deloadWeekQuiet() {
        ProgressionAdherenceDetector d = new ProgressionAdherenceDetector();
        List<DetectorInput.SetPoint> sets = List.of(
                new DetectorInput.SetPoint(0, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(1, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(2, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false),
                new DetectorInput.SetPoint(3, new BigDecimal("80"), 8, null,
                        new BigDecimal("85"), null, false));
        DetectorInput.ExerciseWork work = new DetectorInput.ExerciseWork(
                "Squat", 4, 0, sets, null, null, null);
        DetectorInput.GymDay gymOn = new DetectorInput.GymDay(DAY, List.of(work));
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Hyper", 3, 6, true,
                Set.of(), Set.of());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymOn), List.of(), List.of(), List.of(), meso,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void hrRecoveryTrend_firesOnBandFlip_only() {
        // Two runs (Mon+Thu) per week, 8 weeks. Oldest 4 weeks (n=7..4) both days = 120s.
        // Middle 3 weeks (n=3..1) both days = 112s. Current week (n=0): Mon Aug24 = 108s;
        // Thu Aug27 = DAY, value varies per scenario below.
        //
        // Hand-computed bands (TreeMap orders weekStart ascending, oldest first; half=4):
        //  as-of DAY-1 (Aug26, excludes the DAY run): weekly avgs oldest->newest =
        //    120,120,120,120 | 112,112,112,108(Mon-only, n=0 has 1 pt)
        //    firstHalf = avg(120,120,120,120) = 120
        //    lastHalf  = avg(112,112,112,108) = 444/4 = 111
        //    delta = 120 - 111 = 9  -> |9| < 10 -> KOZOMBOS
        //  as-of DAY (Aug27, includes the DAY run X): n=0 avg = (108+X)/2
        //    lastHalf' = avg(112,112,112,(108+X)/2)
        //    X=40  -> n=0 avg=74   -> lastHalf'=(112+112+112+74)/4=410/4=102.5 -> delta'=17.5 -> JAVUL (flip!)
        //    X=108 -> n=0 avg=108  -> lastHalf'=(112+112+112+108)/4=444/4=111  -> delta'=9    -> KOZOMBOS (no flip)
        HrRecoveryTrendDetector d = new HrRecoveryTrendDetector();
        LocalDate mon0 = DAY.minusDays(3); // Aug24
        List<DetectorInput.RunPoint> olderWeeks = List.of(
                // n=7: Jul6/Jul9
                new DetectorInput.RunPoint(DAY.minusDays(52), null, 120, null),
                new DetectorInput.RunPoint(DAY.minusDays(49), null, 120, null),
                // n=6: Jul13/Jul16
                new DetectorInput.RunPoint(DAY.minusDays(45), null, 120, null),
                new DetectorInput.RunPoint(DAY.minusDays(42), null, 120, null),
                // n=5: Jul20/Jul23
                new DetectorInput.RunPoint(DAY.minusDays(38), null, 120, null),
                new DetectorInput.RunPoint(DAY.minusDays(35), null, 120, null),
                // n=4: Jul27/Jul30
                new DetectorInput.RunPoint(DAY.minusDays(31), null, 120, null),
                new DetectorInput.RunPoint(DAY.minusDays(28), null, 120, null),
                // n=3: Aug3/Aug6
                new DetectorInput.RunPoint(DAY.minusDays(24), null, 112, null),
                new DetectorInput.RunPoint(DAY.minusDays(21), null, 112, null),
                // n=2: Aug10/Aug13
                new DetectorInput.RunPoint(DAY.minusDays(17), null, 112, null),
                new DetectorInput.RunPoint(DAY.minusDays(14), null, 112, null),
                // n=1: Aug17/Aug20
                new DetectorInput.RunPoint(DAY.minusDays(10), null, 112, null),
                new DetectorInput.RunPoint(DAY.minusDays(7), null, 112, null),
                // n=0: Aug24 (Mon)
                new DetectorInput.RunPoint(mon0, null, 108, null));

        // Scenario 1: DAY run at 40s -> band flips KOZOMBOS -> JAVUL -> fires "javul"
        List<DetectorInput.RunPoint> withFlip = new java.util.ArrayList<>(olderWeeks);
        withFlip.add(new DetectorInput.RunPoint(DAY, null, 40, null));
        DetectorInput.TrendWindow flipTrend = new DetectorInput.TrendWindow(withFlip, List.of(), List.of(), List.of(), null, List.of(), null);
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), withFlip, List.of(), null, flipTrend));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("hr-recovery-trend");
            assertThat(s.expertKey()).isEqualTo("doki");
            assertThat(s.summary()).contains("javul");
        });

        // Scenario 2: DAY run removed entirely -> no new run data -> empty regardless of band
        DetectorInput.TrendWindow noDayTrend = new DetectorInput.TrendWindow(olderWeeks, List.of(), List.of(), List.of(), null, List.of(), null);
        assertThat(d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), olderWeeks, List.of(), null, noDayTrend))).isEmpty();

        // Scenario 3: DAY run at 108s (same as Mon) -> band stays KOZOMBOS -> band-change gate
        // suppresses even though new run data exists
        List<DetectorInput.RunPoint> noFlip = new java.util.ArrayList<>(olderWeeks);
        noFlip.add(new DetectorInput.RunPoint(DAY, null, 108, null));
        DetectorInput.TrendWindow noFlipTrend = new DetectorInput.TrendWindow(noFlip, List.of(), List.of(), List.of(), null, List.of(), null);
        assertThat(d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), noFlip, List.of(), null, noFlipTrend))).isEmpty();
    }

    @Test
    void hrRecoveryTrend_quietUnderFourWeeks() {
        HrRecoveryTrendDetector d = new HrRecoveryTrendDetector();
        // 3 distinct weeks (current, -7d, -14d), incl. one run on DAY -> weekly.size()=3 < MIN_WEEKS
        List<DetectorInput.RunPoint> runs = List.of(
                new DetectorInput.RunPoint(DAY, null, 100, null),
                new DetectorInput.RunPoint(DAY.minusDays(7), null, 100, null),
                new DetectorInput.RunPoint(DAY.minusDays(14), null, 100, null));
        DetectorInput.TrendWindow trend = new DetectorInput.TrendWindow(runs, List.of(), List.of(), List.of(), null, List.of(), null);
        assertThat(d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), runs, List.of(), null, trend))).isEmpty();
    }

    @Test
    void sleepChain_firesOnRepeatedPoorSleepDecline() {
        SleepPerformanceChainDetector d = new SleepPerformanceChainDetector();
        List<DetectorInput.SleepPoint> sleep = List.of(
                new DetectorInput.SleepPoint(DAY.minusDays(3), 3, null, null),
                new DetectorInput.SleepPoint(DAY, 3, null, null));
        List<DetectorInput.RunPoint> runs = List.of(
                new DetectorInput.RunPoint(DAY.minusDays(3), 9, null, null),
                new DetectorInput.RunPoint(DAY, 9, null, null));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), runs, sleep, null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("sleep-performance-chain");
            assertThat(s.expertKey()).isEqualTo("szomnologus");
            assertThat(s.summary()).contains("2");
        });
    }

    @Test
    void sleepChain_quietWithGoodSleep() {
        SleepPerformanceChainDetector d = new SleepPerformanceChainDetector();
        List<DetectorInput.SleepPoint> sleep = List.of(
                new DetectorInput.SleepPoint(DAY.minusDays(3), 8, null, null),
                new DetectorInput.SleepPoint(DAY, 8, null, null));
        List<DetectorInput.RunPoint> runs = List.of(
                new DetectorInput.RunPoint(DAY.minusDays(3), 9, null, null),
                new DetectorInput.RunPoint(DAY, 9, null, null));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), runs, sleep, null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void avoidance_firesOnRepeatedSkips() {
        AvoidancePatternDetector d = new AvoidancePatternDetector();
        DetectorInput.ExerciseWork skipped = new DetectorInput.ExerciseWork(
                "Tricepsznyújtás", 0, 2, List.of(), null, null, null);
        DetectorInput.GymDay gym1 = new DetectorInput.GymDay(DAY, List.of(skipped));
        DetectorInput.GymDay gym2 = new DetectorInput.GymDay(DAY.minusDays(2), List.of(skipped));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gym1, gym2), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("avoidance-pattern");
            assertThat(s.expertKey()).isEqualTo("drill");
            assertThat(s.summary()).contains("Tricepsznyújtás");
        });
    }

    @Test
    void avoidance_quietOnOneOff() {
        AvoidancePatternDetector d = new AvoidancePatternDetector();
        DetectorInput.ExerciseWork skipped = new DetectorInput.ExerciseWork(
                "Tricepsznyújtás", 0, 1, List.of(), null, null, null);
        DetectorInput.GymDay gym = new DetectorInput.GymDay(DAY, List.of(skipped));
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gym), List.of(), List.of(), List.of(), null,
                emptyTrend()));
        assertThat(fired).isEmpty();
    }

    @Test
    void detectorGates_roundTwoFamilies_seeOnlyDataDatedOnTheObservedDay() {
        DetectorInput.TrendWindow todayMeal = new DetectorInput.TrendWindow(
                List.of(), List.of(),
                List.of(new DetectorInput.MealDayPoint(DAY, new BigDecimal("2000"),
                        new BigDecimal("150"), new BigDecimal("200"), new BigDecimal("60"),
                        null, null, new BigDecimal("3100"), new BigDecimal("220"), List.of())),
                List.of(), null, List.of(), null);
        assertThat(DetectorGates.newMealData(trendInput(todayMeal))).isTrue();

        DetectorInput.TrendWindow yesterdayMeal = new DetectorInput.TrendWindow(
                List.of(), List.of(),
                List.of(new DetectorInput.MealDayPoint(DAY.minusDays(1), new BigDecimal("2000"),
                        new BigDecimal("150"), new BigDecimal("200"), new BigDecimal("60"),
                        null, null, new BigDecimal("3100"), new BigDecimal("220"), List.of())),
                List.of(), null, List.of(), null);
        assertThat(DetectorGates.newMealData(trendInput(yesterdayMeal))).isFalse();
    }

    @Test
    void detectorGates_absentRoundTwoContexts_areQuietNotCrashing() {
        DetectorInput in = trendInput(emptyTrend());
        assertThat(DetectorGates.newMealData(in)).isFalse();
        assertThat(DetectorGates.newWaterData(in)).isFalse();
        assertThat(DetectorGates.newStackData(in)).isFalse();
        assertThat(DetectorGates.newCheckinData(in)).isFalse();
        assertThat(DetectorGates.newDoseData(in)).isFalse();
    }

    @Test
    void macroAdherence_firesOnSystematicUndershoot_quietWhenUnchangedYesterday() {
        MacroAdherenceDetector d = new MacroAdherenceDetector();
        // 15 consecutive days at 2200 kcal against a 3100 target = a stable ~29% undershoot:
        // the state is the same as of DAY and DAY-1, so a stable pattern stays QUIET.
        List<DetectorInput.MealDayPoint> stable = new java.util.ArrayList<>();
        for (int i = 0; i < 15; i++) {
            stable.add(meal(DAY.minusDays(i), "2200", "180", null));
        }
        assertThat(d.detect(trendInput(trend(stable, List.of(), null, List.of(), null, List.of()))))
                .isEmpty();

        // a window that CROSSES the threshold exactly on DAY: 14 days at 2700 kcal against a
        // 3100 target is a ~13% undershoot, but as of DAY-1 the window still contains a 4500 kcal
        // day (offset 14) that pulls the mean back inside the band -> yesterday null, today fires.
        List<DetectorInput.MealDayPoint> flipping = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            flipping.add(meal(DAY.minusDays(i), "2700", "220", null));
        }
        flipping.add(meal(DAY.minusDays(14), "4500", "220", null));
        assertThat(d.detect(trendInput(trend(flipping, List.of(), null, List.of(), null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("macro-adherence");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.summary()).contains("alálövi");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void hydrationConsistency_firesOnBandChangeOnly() {
        HydrationConsistencyDetector d = new HydrationConsistencyDetector();
        // 14 days all on target -> band JO both as of DAY and DAY-1 -> quiet
        List<DetectorInput.WaterDayPoint> good = new java.util.ArrayList<>();
        for (int i = 0; i < 15; i++) {
            good.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 4000, 4000));
        }
        assertThat(d.detect(trendInput(trend(List.of(), good, null, List.of(), null, List.of()))))
                .isEmpty();

        // three low days at offsets 0-2: as of DAY the 14-day window (offsets 0-13) holds all
        // three -> 11/14 = 79% -> INGADOZO; as of DAY-1 (offsets 1-14) it holds only two ->
        // 12/14 = 86% -> JO. Exactly one band change, on DAY.
        List<DetectorInput.WaterDayPoint> crossing = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            crossing.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 500, 4000));
        }
        for (int i = 3; i < 15; i++) {
            crossing.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 4200, 4000));
        }
        assertThat(d.detect(trendInput(trend(List.of(), crossing, null, List.of(), null, List.of()))))
                .hasSize(1);
    }

    @Test
    void comfortEating_silentBelowMinimumPairedDays() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = List.of(
                meal(DAY, "3000", "200", "0.70"),
                meal(DAY.minusDays(1), "2900", "200", "0.20"));
        List<DetectorInput.CheckinDayPoint> checkins = List.of(
                checkin(DAY, "3", "9", "3"),
                checkin(DAY.minusDays(1), "8", "2", "8"));
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .isEmpty();
    }

    @Test
    void comfortEating_firesWhenHighNovaDaysClusterOnLowMoodDays() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        // 24 paired days: every 4th day is a low-mood day AND a high-NOVA day; the rest are calm
        // and clean. Day 0 (DAY) is one of the low-mood/high-NOVA days, so the state turns on today.
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0;
            meals.add(meal(DAY.minusDays(i), bad ? "3600" : "2900", "200", bad ? "0.75" : "0.15"));
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("comfort-eating");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void comfortEating_ignoresDaysWithoutNovaCoverage() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0;
            meals.add(meal(DAY.minusDays(i), bad ? "3600" : "2900", "200", null)); // no NOVA class
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .isEmpty();
    }

    @Test
    void comfortEating_ignoresDaysWithThinNovaCoverageEvenWhenShareNonNull() {
        // Task 2 review carry-forward: the read layer only nulls nova4KcalShare when coverage is
        // ZERO, so the 70% pairing gate has no home except here. A day with a non-null share but
        // thin coverage (40%) must not be paired -- even though it would otherwise look identical
        // to a qualifying high-NOVA low-mood day.
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0;
            // thin coverage (0.40 < MIN_NOVA_COVERAGE 0.70) on every day -> never pairable
            meals.add(mealWithCoverage(DAY.minusDays(i), bad ? "3600" : "2900", "200",
                    bad ? "0.75" : "0.15", "0.40"));
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .isEmpty();
    }

    @Test
    void proteinTrainingMismatch_firesWhenProteinIsMissedOnGymDaysSpecifically() {
        ProteinTrainingMismatchDetector d = new ProteinTrainingMismatchDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.GymDay> gym = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            boolean gymDay = i % 2 == 0;
            meals.add(meal(DAY.minusDays(i), "2900", gymDay ? "120" : "230", null));
            if (gymDay) {
                gym.add(new DetectorInput.GymDay(DAY.minusDays(i), List.of()));
            }
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, List.of(), null, gym))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("protein-training-mismatch");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.summary()).contains("edzésnap");
                });
    }

    @Test
    void lateEating_firesOnRepeatedLateMealsFollowedByWorseSleep() {
        LateEatingPatternDetector d = new LateEatingPatternDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.SleepPoint> sleep = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            LocalDate date = DAY.minusDays(i);
            boolean late = i % 2 == 0;
            meals.add(new DetectorInput.MealDayPoint(date, new BigDecimal("2900"),
                    new BigDecimal("200"), new BigDecimal("200"), new BigDecimal("60"),
                    null, null, new BigDecimal("3100"), new BigDecimal("220"),
                    List.of(new DetectorInput.MealPoint("snack",
                            late ? java.time.LocalTime.of(22, 30) : java.time.LocalTime.of(19, 0),
                            new BigDecimal("600"), null))));
            // SleepPoint dated D = the night leading INTO D, so day D's night is dated D+1
            sleep.add(new DetectorInput.SleepPoint(date.plusDays(1),
                    late ? 4 : 8, new BigDecimal(late ? "5.5" : "8.0"), 1));
        }
        DetectorInput in = new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), sleep, null,
                trend(meals, List.of(), null, List.of(), null, List.of()));
        assertThat(d.detect(in)).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("late-eating-pattern");
            assertThat(s.expertKey()).isEqualTo("szomnologus");
        });
    }

    @Test
    void stackSkip_ignoresPeriWorkoutItemsOnRestDays() {
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID pwo = UUID.randomUUID();
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(pwo, "PWO", "pre_workout", null)),
                List.of(new DetectorInput.StackDayPoint(DAY, Set.of())));
        // no gym days anywhere -> the pre-workout item was never EXPECTED -> quiet
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), stack, List.of(), null, List.of()))))
                .isEmpty();
    }

    @Test
    void stackSkip_firesOnRepeatedMissesOfAnEverydayItem() {
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID creatine = UUID.randomUUID();
        List<DetectorInput.StackDayPoint> days = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            // taken on odd offsets, missed on even ones (5 misses, DAY itself among them)
            days.add(new DetectorInput.StackDayPoint(DAY.minusDays(i),
                    i % 2 == 0 ? Set.of() : Set.of(creatine)));
        }
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(creatine, "Kreatin", "wake", null)), days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), stack, List.of(), null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("stack-skip-pattern");
                    assertThat(s.expertKey()).isEqualTo("drill");
                    assertThat(s.summary()).contains("Kreatin");
                });
    }

    @Test
    void medCycleCovariance_silentBelowMinimumCycles_andDropsStaleDays() {
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 20; i++) {
            // every day marked stale -> nothing usable, regardless of how strong the pattern is
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), (i % 7) + 1, "peak",
                    i + 10, true));
            checkins.add(checkin(DAY.minusDays(i), i % 7 >= 5 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), null, checkins, med, List.of()))))
                .isEmpty();
    }

    @Test
    void medCycleCovariance_firesOnACycleDayBucketThatDivergesFromTheCycleMean() {
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 28; i++) {
            int cycleDay = (i % 7) + 1;
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), cycleDay, "peak",
                    cycleDay - 1, false));
            // energy collapses on cycle days 6-7 in every cycle
            checkins.add(checkin(DAY.minusDays(i), cycleDay >= 6 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), null, checkins, med, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("med-cycle-covariance");
                    assertThat(s.expertKey()).isEqualTo("doki");
                    // descriptive only: no advice, no diagnosis verbs
                    assertThat(s.summary()).doesNotContain("javaslom").doesNotContain("kellene");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }
}
