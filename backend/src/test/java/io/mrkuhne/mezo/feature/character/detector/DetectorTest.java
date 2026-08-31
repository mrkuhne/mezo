package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import java.math.BigDecimal;
import java.time.DayOfWeek;
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("sport-interference");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("Sport-interferencia");
            assertThat(s.summary()).contains("2");
        });
        // the DAY gym day is what satisfies the gate (newGymData)
        assertThat(RoundOneGates.newGymData(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(gymBefore, gymOn), List.of(sport1, sport2), List.of(), List.of(), null,
                new DetectorInput.TrendWindow(List.of(), List.of())))).isTrue();
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
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
                new DetectorInput.TrendWindow(List.of(), List.of())));
        assertThat(fired).isEmpty();
    }
}
