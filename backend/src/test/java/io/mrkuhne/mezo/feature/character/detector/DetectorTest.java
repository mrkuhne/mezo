package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DetectorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 27);

    private DetectorInput input(Set<LocalDate> mealDates, Map<LocalDate, Integer> checkins,
                                List<DetectorInput.WeightPoint> weights,
                                Map<LocalDate, List<String>> journal) {
        return input(mealDates, checkins, weights, journal, List.of(), List.of(), List.of(), List.of(),
                null, new DetectorInput.TrendWindow(List.of(), List.of()));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
        assertThat(fired).isEmpty();
    }
}
