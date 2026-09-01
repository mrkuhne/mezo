package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
                null, List.of(), null, List.of(), List.of(), List.of(), List.of(), null, List.of(),
                List.of(), List.of(), List.of(), List.of(), DetectorInput.MetaWindow.empty());
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

    /** Fluent {@link DetectorInput.TrendWindow} builder — every component defaults to empty. */
    private static final class TrendBuilder {
        private List<DetectorInput.RunPoint> runs = List.of();
        private List<DetectorInput.GymDay> gym = List.of();
        private List<DetectorInput.MealDayPoint> meals = List.of();
        private List<DetectorInput.WaterDayPoint> water = List.of();
        private DetectorInput.StackContext stack;
        private List<DetectorInput.CheckinDayPoint> checkins = List.of();
        private DetectorInput.MedContext med;
        private List<DetectorInput.SleepPoint> sleep = List.of();
        private List<DetectorInput.IntentionDayPoint> intentions = List.of();
        private List<DetectorInput.DecisionPoint> decisions = List.of();
        private List<DetectorInput.GratitudePoint> gratitudes = List.of();
        private DetectorInput.NeedsContext needs;
        private List<DetectorInput.CheckinSlotPoint> slots = List.of();
        private List<java.time.LocalDateTime> chat = List.of();
        private List<DetectorInput.LogLatencyPoint> latencies = List.of();
        private List<DetectorInput.MentionPoint> mentions = List.of();
        private List<DetectorInput.ChatToolCallPoint> toolCalls = List.of();
        private DetectorInput.MetaWindow meta = DetectorInput.MetaWindow.empty();

        TrendBuilder runs(List<DetectorInput.RunPoint> v) { this.runs = v; return this; }
        TrendBuilder gym(List<DetectorInput.GymDay> v) { this.gym = v; return this; }
        TrendBuilder meals(List<DetectorInput.MealDayPoint> v) { this.meals = v; return this; }
        TrendBuilder water(List<DetectorInput.WaterDayPoint> v) { this.water = v; return this; }
        TrendBuilder stack(DetectorInput.StackContext v) { this.stack = v; return this; }
        TrendBuilder checkins(List<DetectorInput.CheckinDayPoint> v) { this.checkins = v; return this; }
        TrendBuilder med(DetectorInput.MedContext v) { this.med = v; return this; }
        TrendBuilder sleep(List<DetectorInput.SleepPoint> v) { this.sleep = v; return this; }
        TrendBuilder intentions(List<DetectorInput.IntentionDayPoint> v) { this.intentions = v; return this; }
        TrendBuilder decisions(List<DetectorInput.DecisionPoint> v) { this.decisions = v; return this; }
        TrendBuilder gratitudes(List<DetectorInput.GratitudePoint> v) { this.gratitudes = v; return this; }
        TrendBuilder needs(DetectorInput.NeedsContext v) { this.needs = v; return this; }
        TrendBuilder slots(List<DetectorInput.CheckinSlotPoint> v) { this.slots = v; return this; }
        TrendBuilder chat(List<java.time.LocalDateTime> v) { this.chat = v; return this; }
        TrendBuilder latencies(List<DetectorInput.LogLatencyPoint> v) { this.latencies = v; return this; }
        TrendBuilder mentions(List<DetectorInput.MentionPoint> v) { this.mentions = v; return this; }
        TrendBuilder toolCalls(List<DetectorInput.ChatToolCallPoint> v) { this.toolCalls = v; return this; }
        TrendBuilder meta(DetectorInput.MetaWindow v) { this.meta = v; return this; }

        DetectorInput.TrendWindow build() {
            return new DetectorInput.TrendWindow(runs, gym, meals, water, stack, checkins, med,
                    sleep, intentions, decisions, gratitudes, needs, slots, chat, latencies,
                    mentions, toolCalls, meta);
        }
    }

    /** A DetectorInput carrying only a trend window — the shape every round-2/3 detector reads. */
    private static DetectorInput trendOnly(LocalDate day, DetectorInput.TrendWindow trend) {
        return new DetectorInput(day, Set.of(), Map.of(), List.of(), Map.of(), List.of(),
                List.of(), List.of(), List.of(), null, trend);
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
        DetectorInput.TrendWindow flipTrend = new DetectorInput.TrendWindow(withFlip, List.of(), List.of(), List.of(), null, List.of(), null, List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(), List.of(), List.of(), DetectorInput.MetaWindow.empty());
        List<DetectorSignal> fired = d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), withFlip, List.of(), null, flipTrend));
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("hr-recovery-trend");
            assertThat(s.expertKey()).isEqualTo("doki");
            assertThat(s.summary()).contains("javul");
        });

        // Scenario 2: DAY run removed entirely -> no new run data -> empty regardless of band
        DetectorInput.TrendWindow noDayTrend = new DetectorInput.TrendWindow(olderWeeks, List.of(), List.of(), List.of(), null, List.of(), null, List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(), List.of(), List.of(), DetectorInput.MetaWindow.empty());
        assertThat(d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), olderWeeks, List.of(), null, noDayTrend))).isEmpty();

        // Scenario 3: DAY run at 108s (same as Mon) -> band stays KOZOMBOS -> band-change gate
        // suppresses even though new run data exists
        List<DetectorInput.RunPoint> noFlip = new java.util.ArrayList<>(olderWeeks);
        noFlip.add(new DetectorInput.RunPoint(DAY, null, 108, null));
        DetectorInput.TrendWindow noFlipTrend = new DetectorInput.TrendWindow(noFlip, List.of(), List.of(), List.of(), null, List.of(), null, List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(), List.of(), List.of(), DetectorInput.MetaWindow.empty());
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
        DetectorInput.TrendWindow trend = new DetectorInput.TrendWindow(runs, List.of(), List.of(), List.of(), null, List.of(), null, List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(), List.of(), List.of(), DetectorInput.MetaWindow.empty());
        assertThat(d.detect(input(Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), runs, List.of(), null, trend))).isEmpty();
    }

    @Test
    void sleepChain_firesOnRepeatedPoorSleepDecline() {
        SleepPerformanceChainDetector d = new SleepPerformanceChainDetector();
        List<DetectorInput.SleepPoint> sleep = List.of(
                new DetectorInput.SleepPoint(DAY.minusDays(3), 3, null, null, null, null),
                new DetectorInput.SleepPoint(DAY, 3, null, null, null, null));
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
                new DetectorInput.SleepPoint(DAY.minusDays(3), 8, null, null, null, null),
                new DetectorInput.SleepPoint(DAY, 8, null, null, null, null));
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
                List.of(), null, List.of(), null,
                List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(),
                List.of(), List.of(), DetectorInput.MetaWindow.empty());
        assertThat(DetectorGates.newMealData(trendInput(todayMeal))).isTrue();

        DetectorInput.TrendWindow yesterdayMeal = new DetectorInput.TrendWindow(
                List.of(), List.of(),
                List.of(new DetectorInput.MealDayPoint(DAY.minusDays(1), new BigDecimal("2000"),
                        new BigDecimal("150"), new BigDecimal("200"), new BigDecimal("60"),
                        null, null, new BigDecimal("3100"), new BigDecimal("220"), List.of())),
                List.of(), null, List.of(), null,
                List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of(),
                List.of(), List.of(), DetectorInput.MetaWindow.empty());
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
        assertThat(d.detect(trendInput(new TrendBuilder().meals(stable).build())))
                .isEmpty();

        // a window that CROSSES the threshold exactly on DAY: 14 days at 2700 kcal against a
        // 3100 target is a ~13% undershoot, but as of DAY-1 the window still contains a 4500 kcal
        // day (offset 14) that pulls the mean back inside the band -> yesterday null, today fires.
        List<DetectorInput.MealDayPoint> flipping = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            flipping.add(meal(DAY.minusDays(i), "2700", "220", null));
        }
        flipping.add(meal(DAY.minusDays(14), "4500", "220", null));
        assertThat(d.detect(trendInput(new TrendBuilder().meals(flipping).build())))
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
        assertThat(d.detect(trendInput(new TrendBuilder().water(good).build())))
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
        assertThat(d.detect(trendInput(new TrendBuilder().water(crossing).build())))
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
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).checkins(checkins).build())))
                .isEmpty();
    }

    @Test
    void comfortEating_firesWhenHighNovaDaysClusterOnLowMoodDays() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        // 24 paired days, of which exactly THREE (offsets 0, 4, 8) are low-mood AND spiking; the
        // other 21 are calm and clean. As of DAY-1 only two low-mood days remain, which is below
        // MIN_DAYS_PER_GROUP, so yesterday's state is null and the pattern genuinely turns on
        // today -- the state-change gate is doing real work here, not a shifting count.
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0 && i <= 8;
            meals.add(meal(DAY.minusDays(i), bad ? "3600" : "2900", "200", bad ? "0.75" : "0.15"));
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).checkins(checkins).build())))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("comfort-eating");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    // Finding A: the spike test is share OR kcal, so the copy must name both --
                    // it must NOT attribute the whole count to processed-food share alone.
                    assertThat(s.summary()).contains("feldolgozott étel aránya vagy a napi kalória");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void comfortEating_silentWhenEveryPairedDayIsLowMood_noContrastGroup() {
        // A chronically stressed user: every paired day is low-mood, so there is no contrast group
        // to covary AGAINST. The rate-ratio guard would be skipped entirely (otherRate == 0), so
        // without a floor on the non-low-mood group this would announce a "covariance" computed
        // against nothing.
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            boolean spike = i % 4 == 0;
            meals.add(meal(DAY.minusDays(i), spike ? "3600" : "2900", "200",
                    spike ? "0.75" : "0.15"));
            checkins.add(checkin(DAY.minusDays(i), "3", "9", "3")); // every day low-mood
        }
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).checkins(checkins).build())))
                .isEmpty();
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
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).checkins(checkins).build())))
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
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).checkins(checkins).build())))
                .isEmpty();
    }

    @Test
    void proteinTrainingMismatch_firesWhenProteinIsMissedOnGymDaysSpecifically() {
        ProteinTrainingMismatchDetector d = new ProteinTrainingMismatchDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.GymDay> gym = new java.util.ArrayList<>();
        // Gym on offsets 0-3, no gym on 4-13. Protein missed on gym offsets 0 and 1, plus one
        // non-gym miss on offset 4. As of DAY:   gym 2/4 = 0,50 vs non-gym 1/10 = 0,10 -> gap 0,40
        //                                        (>= MIN_RATE_GAP 0,30) -> qualifies.
        // As of DAY-1 the gym group is offsets 1-3: 1/3 = 0,33 vs 0,10 -> gap 0,23 -> does NOT
        // qualify. So the pattern genuinely CROSSES its threshold on the observed day.
        for (int i = 0; i < 14; i++) {
            boolean gymDay = i <= 3;
            boolean miss = i == 0 || i == 1 || i == 4;
            meals.add(meal(DAY.minusDays(i), "2900", miss ? "120" : "230", null));
            if (gymDay) {
                gym.add(new DetectorInput.GymDay(DAY.minusDays(i), List.of()));
            }
        }
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).gym(gym).build())))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("protein-training-mismatch");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.summary()).contains("edzésnap");
                    // the contrast group is "no completed gym session", which is NOT a rest day:
                    // a run or a sport session lands there too, so the copy must not claim rest
                    assertThat(s.summary()).doesNotContain("pihenőnap");
                });
    }

    @Test
    void proteinTrainingMismatch_quietWhenTheSameGapAlreadyHeldYesterday() {
        // Same qualitative finding on both days: gym days are missed at 100%, non-gym days at 0%,
        // as of DAY (4/4) and as of DAY-1 (3/3) alike. Only the COUNTS move -- which is exactly
        // what a count-valued state string would mistake for news, re-announcing nightly.
        ProteinTrainingMismatchDetector d = new ProteinTrainingMismatchDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.GymDay> gym = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            boolean gymDay = i <= 3;
            meals.add(meal(DAY.minusDays(i), "2900", gymDay ? "120" : "230", null));
            if (gymDay) {
                gym.add(new DetectorInput.GymDay(DAY.minusDays(i), List.of()));
            }
        }
        assertThat(d.detect(trendInput(new TrendBuilder().meals(meals).gym(gym).build())))
                .isEmpty();
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
                    late ? 4 : 8, new BigDecimal(late ? "5.5" : "8.0"), 1, null, null));
        }
        DetectorInput in = new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), sleep, null,
                new TrendBuilder().meals(meals).build());
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
                List.of(new DetectorInput.StackItem(pwo, "PWO", "pre_workout", null,
                        DAY.minusDays(60))),
                List.of(new DetectorInput.StackDayPoint(DAY, Set.of())));
        // no gym days anywhere -> the pre-workout item was never EXPECTED -> quiet
        assertThat(d.detect(trendInput(new TrendBuilder().stack(stack).build())))
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
                List.of(new DetectorInput.StackItem(creatine, "Kreatin", "wake", null,
                        DAY.minusDays(60))), days);
        assertThat(d.detect(trendInput(new TrendBuilder().stack(stack).build())))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("stack-skip-pattern");
                    assertThat(s.expertKey()).isEqualTo("drill");
                    assertThat(s.summary()).contains("Kreatin");
                });
    }

    @Test
    void stackSkip_doesNotFabricateSkipsForDaysBeforeTheItemEnteredTheProtocol() {
        // The user adds Kreatin TODAY and takes it. Without an item-start bound the expectation
        // loop would run the whole 14-day window and report "13 napon maradt ki a tervezett 14
        // napból" -- thirteen skips of an item that did not exist. Absent, not zero (spec §4.3).
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID creatine = UUID.randomUUID();
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(creatine, "Kreatin", "wake", null, DAY)),
                List.of(new DetectorInput.StackDayPoint(DAY, Set.of(creatine))));
        assertThat(d.detect(trendInput(new TrendBuilder().stack(stack).build())))
                .isEmpty();
    }

    @Test
    void stackSkip_denominatorShrinksToTheItemsOwnLifetime() {
        // Item added 4 days ago and never taken: 4 expected days, 4 missed -- NOT 14 and 14.
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID creatine = UUID.randomUUID();
        List<DetectorInput.StackDayPoint> days = new java.util.ArrayList<>();
        for (int i = 0; i < 4; i++) {
            days.add(new DetectorInput.StackDayPoint(DAY.minusDays(i), Set.of()));
        }
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(creatine, "Kreatin", "wake", null,
                        DAY.minusDays(3))), days);
        assertThat(d.detect(trendInput(new TrendBuilder().stack(stack).build())))
                .singleElement().satisfies(s ->
                        assertThat(s.summary()).contains("4 napon maradt ki a tervezett 4 napból"));
    }

    @Test
    void medCycleCovariance_silentBelowMinimumUsableDays_andDropsStaleDays() {
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
        assertThat(d.detect(trendInput(new TrendBuilder().checkins(checkins).med(med).build())))
                .isEmpty();
    }

    @Test
    void medCycleCovariance_firesOnACycleDayBucketThatDivergesFromTheCycleMean() {
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        // Energy is a flat 8 across all 28 days EXCEPT the observed day itself, which collapses to
        // 3. That single day drags cycle-day-1's bucket mean to 6,75 against an overall 7,82 --
        // a delta of -1,07, just past MIN_DELTA_POINTS. As of DAY-1 every bucket sits exactly on
        // the mean, so yesterday's state is null: the finding genuinely CROSSES its threshold on
        // the observed day rather than merely shifting a magnitude.
        for (int i = 0; i < 28; i++) {
            int cycleDay = (i % 7) + 1;
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), cycleDay, "peak",
                    cycleDay - 1, false));
            checkins.add(checkin(DAY.minusDays(i), i == 0 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(new TrendBuilder().checkins(checkins).med(med).build())))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("med-cycle-covariance");
                    assertThat(s.expertKey()).isEqualTo("doki");
                    // descriptive only: no advice, no diagnosis verbs
                    assertThat(s.summary()).doesNotContain("javaslom").doesNotContain("kellene");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void medCycleCovariance_quietWhenTheSameCycleDayBucketAlreadyDivergedYesterday() {
        // The same qualitative finding on both days -- energy is low on every cycle day 1 -- so
        // only the DELTA'S MAGNITUDE moves (-4,29 as of DAY, -3,56 as of DAY-1). A state carrying
        // that magnitude would re-announce this sensitive medication signal nightly; a state of
        // metric + cycle day + direction correctly stays silent.
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 28; i++) {
            int cycleDay = (i % 7) + 1;
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), cycleDay, "peak",
                    cycleDay - 1, false));
            checkins.add(checkin(DAY.minusDays(i), cycleDay == 1 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(new TrendBuilder().checkins(checkins).med(med).build())))
                .isEmpty();
    }

    private static DetectorInput.CheckinDayPoint scale(LocalDate d, String energy, String body) {
        return new DetectorInput.CheckinDayPoint(d, 1, new BigDecimal(energy), new BigDecimal("5"),
                new BigDecimal(body), new BigDecimal("6"));
    }

    private static DetectorInput.SleepPoint sleep(LocalDate d, int quality) {
        return new DetectorInput.SleepPoint(d, quality, new BigDecimal("7.0"), 1, null, null);
    }

    private static DetectorInput.IntentionDayPoint intention(LocalDate d, int foci, String reflection) {
        return new DetectorInput.IntentionDayPoint(d, foci, reflection);
    }

    private static DetectorInput.DecisionPoint decision(LocalDate reviewedOn, Integer rating) {
        return new DetectorInput.DecisionPoint(DAY.minusDays(40), DAY.minusDays(40),
                DAY.minusDays(20), reviewedOn, rating == null ? null : rating.shortValue(),
                "döntés szövege");
    }

    @Test
    void selfCalibration_suppressesASingleDayFlip() {
        // 10 paired days; the 5 highest self-rated days slept badly, the 5 lowest slept well.
        // As of DAY-1 the window's low-self group collapses onto the median and is excluded, so
        // verdict() returns null there -- the direction as of DAY has not held for two days, only
        // one, so the confirmation gate (round-3 review fix, I10) must suppress it.
        List<DetectorInput.CheckinDayPoint> scales = new java.util.ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean highSelf = i < 5;
            scales.add(scale(d, highSelf ? "8" : "3", "6"));
            sleeps.add(sleep(d, highSelf ? 3 : 8));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        assertThat(new SelfCalibrationDetector().detect(in)).isEmpty();
    }

    @Test
    void selfCalibration_firesOnlyOnceADirectionHasHeldForTwoDays() {
        // Core 6 days sit inside every trailing-14-day window evaluated below (DAY, DAY-1, DAY-2)
        // and alone are perfectly neutral (diff 0). Four edge days enter/leave the window as the
        // evaluation date advances one day at a time:
        //  - as of DAY-2 the window holds the neutral edges DAY-15/DAY-14 -> still neutral (nincs-jel)
        //  - as of DAY-1 the window swaps in DAY-1's poor-sleep/high-energy pairing -> forditott
        //  - as of DAY the window swaps in DAY's matching pairing too -> forditott again (confirmed)
        // So the state changed between DAY-2 and DAY-1 and then HELD between DAY-1 and DAY: exactly
        // the two-day-stable transition the confirmation gate (round-3 review fix, I10) must fire on.
        List<DetectorInput.CheckinDayPoint> scales = new ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new ArrayList<>();
        LocalDate[] coreHigh = {DAY.minusDays(10), DAY.minusDays(9), DAY.minusDays(8)};
        LocalDate[] coreLow = {DAY.minusDays(7), DAY.minusDays(6), DAY.minusDays(5)};
        for (LocalDate d : coreHigh) {
            scales.add(scale(d, "8", "6"));
            sleeps.add(sleep(d, 5));
        }
        for (LocalDate d : coreLow) {
            scales.add(scale(d, "3", "6"));
            sleeps.add(sleep(d, 5));
        }
        scales.add(scale(DAY.minusDays(15), "8", "6"));
        sleeps.add(sleep(DAY.minusDays(15), 5));
        scales.add(scale(DAY.minusDays(14), "3", "6"));
        sleeps.add(sleep(DAY.minusDays(14), 5));
        scales.add(scale(DAY.minusDays(1), "8", "6"));
        sleeps.add(sleep(DAY.minusDays(1), 1));
        // DAY itself is a low-self/high-sleep pairing rather than another high-self/low-sleep one:
        // this keeps the high/low self-rating groups symmetric (4-and-4) once DAY-14 drops out of
        // the window, while still widening the same forditott gap (a low self-rating paired with a
        // good night's sleep pulls the LOW group's objective mean up, which pulls diff further
        // negative) -- an asymmetric 5-and-3 split would instead push the high group's self-rating
        // (8) to equal the window median and get excluded from both groups.
        scales.add(scale(DAY, "3", "6"));
        sleeps.add(sleep(DAY, 9));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        List<DetectorSignal> fired = new SelfCalibrationDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("ellentétesen mozog")
                .contains("nincs objektív párja");
        assertThat(fired.getFirst().expertKey()).isEqualTo("pszichologus");
    }

    @Test
    void selfCalibration_silentWhenOneSideOfTheContrastIsTooThin() {
        // 10 paired days but only ONE day above the median -> no contrast group.
        List<DetectorInput.CheckinDayPoint> scales = new java.util.ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            LocalDate d = DAY.minusDays(i);
            scales.add(scale(d, i == 0 ? "9" : "5", "6"));
            sleeps.add(sleep(d, i == 0 ? 2 : 8));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        assertThat(new SelfCalibrationDetector().detect(in)).isEmpty();
    }

    @Test
    void selfCalibration_silentWhenTheDirectionIsUnchangedSinceYesterday() {
        // 11 paired days with the SAME direction on both evaluations -> state unchanged -> silent.
        List<DetectorInput.CheckinDayPoint> scales = new java.util.ArrayList<>();
        List<DetectorInput.SleepPoint> sleeps = new java.util.ArrayList<>();
        for (int i = 0; i < 11; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean highSelf = i % 2 == 0;
            scales.add(scale(d, highSelf ? "8" : "3", "6"));
            sleeps.add(sleep(d, highSelf ? 8 : 3));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(scales).sleep(sleeps).build());

        assertThat(new SelfCalibrationDetector().detect(in)).isEmpty();
    }

    @Test
    void promiseVsDelivery_firesOnPoorClosure() {
        // 5 focus days as of DAY (meets MIN_FOCUS_DAYS=5) but only 4 as of DAY-1 (below the
        // gate, so yesterday's state is null) -- the pattern genuinely CROSSES its focus-day
        // gate on the observed day, rather than merely holding a stable "hianyos" band on both.
        List<DetectorInput.IntentionDayPoint> days = new java.util.ArrayList<>();
        days.add(intention(DAY, 2, null));
        for (int i = 1; i <= 4; i++) {
            days.add(intention(DAY.minusDays(i), 1, i <= 3 ? null : "yes"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().intentions(days).build());

        List<DetectorSignal> fired = new PromiseVsDeliveryDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("nem zárja le");
        assertThat(fired.getFirst().expertKey()).isEqualTo("drill");
    }

    @Test
    void promiseVsDelivery_silentBelowTheFocusDayGate() {
        List<DetectorInput.IntentionDayPoint> days = List.of(
                intention(DAY, 1, "yes"), intention(DAY.minusDays(1), 1, "no"));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().intentions(days).build());

        assertThat(new PromiseVsDeliveryDetector().detect(in)).isEmpty();
    }

    @Test
    void decisionProfile_firesOnWeakOutcomes_andCarriesEvidence() {
        List<DetectorInput.DecisionPoint> decisions = List.of(
                decision(DAY, 1), decision(DAY.minusDays(3), 2),
                decision(DAY.minusDays(9), 1), decision(DAY.minusDays(20), 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        List<DetectorSignal> fired = new DecisionProfileDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("a skála alsó részén van")
                .contains("legjobbra értékelt").contains("legrosszabbra értékelt")
                .contains("döntés szövege");
    }

    @Test
    void decisionProfile_silentBelowTheReviewGate() {
        List<DetectorInput.DecisionPoint> decisions = List.of(decision(DAY, 1), decision(DAY, 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        assertThat(new DecisionProfileDetector().detect(in)).isEmpty();
    }

    @Test
    void decisionReviewBacklog_firesWhenOverdueEntriesPileUp() {
        List<DetectorInput.DecisionPoint> decisions = List.of(
                new DetectorInput.DecisionPoint(DAY.minusDays(30), DAY.minusDays(30),
                        DAY.minusDays(5), null, null, "a"),
                new DetectorInput.DecisionPoint(DAY.minusDays(29), DAY.minusDays(29),
                        DAY.minusDays(4), null, null, "b"),
                new DetectorInput.DecisionPoint(DAY.minusDays(28), DAY.minusDays(28),
                        DAY, null, null, "c"));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        List<DetectorSignal> fired = new DecisionReviewBacklogDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("3 döntés");
    }

    @Test
    void decisionReviewBacklog_stateKeyIsQualitative_soAnExtraOverdueEntryDoesNotRefire() {
        // Four overdue yesterday, five today: the COUNT moved, the BAND did not -> silent.
        // If this test ever fails, the state key has picked up a moving number (Global Constraints).
        List<DetectorInput.DecisionPoint> decisions = new java.util.ArrayList<>();
        for (int i = 0; i < 5; i++) {
            decisions.add(new DetectorInput.DecisionPoint(DAY.minusDays(30), DAY.minusDays(30),
                    i == 0 ? DAY : DAY.minusDays(5), null, null, "x"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().decisions(decisions).build());

        assertThat(new DecisionReviewBacklogDetector().detect(in)).isEmpty();
    }

    private static DetectorInput.GratitudePoint gratitude(LocalDate d, String area) {
        return new DetectorInput.GratitudePoint(d, d, area);
    }

    private static DetectorInput.NeedsDayPoint needsDay(LocalDate d, boolean allGreen) {
        int v = allGreen ? 80 : 30;
        return new DetectorInput.NeedsDayPoint(d, 80, 80, 80, 80, allGreen ? 80 : 30, v,
                allGreen ? 6 : 4, allGreen, allGreen ? 3 : 0);
    }

    private static DetectorInput.LogLatencyPoint latency(String genre, LocalDate about, int lagDays) {
        return new DetectorInput.LogLatencyPoint(genre, "teszt", about, about.plusDays(lagDays));
    }

    @Test
    void gratitudeFocus_firesOnAConcentratedArea() {
        List<DetectorInput.GratitudePoint> entries = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            entries.add(gratitude(DAY.minusDays(i), i < 4 ? "connection" : "learning"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().gratitudes(entries).build());

        List<DetectorSignal> fired = new GratitudeFocusDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("kapcsolatok");
        assertThat(fired.getFirst().expertKey()).isEqualTo("antropologus");
    }

    @Test
    void gratitudeFocus_silentWhenTooFewEntriesCarryAnArea() {
        List<DetectorInput.GratitudePoint> entries = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            entries.add(gratitude(DAY.minusDays(i), i < 2 ? "connection" : null));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().gratitudes(entries).build());

        assertThat(new GratitudeFocusDetector().detect(in)).isEmpty();
    }

    @Test
    void streakBreakResponse_firesOnACascade() {
        // all-green up to DAY-4, break on DAY-3, then nothing complete on DAY-2..DAY.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 10; i >= 4; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        for (int i = 3; i >= 0; i--) {
            days.add(needsDay(DAY.minusDays(i), false));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new StreakBreakResponseDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("egyike sem lett teljes");
    }

    @Test
    void streakBreakResponse_silentWhileTheResponseWindowHasNotElapsed() {
        // break on DAY-1: only one of the three response days exists yet.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 10; i >= 2; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        days.add(needsDay(DAY.minusDays(1), false));
        days.add(needsDay(DAY, false));
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        assertThat(new StreakBreakResponseDetector().detect(in)).isEmpty();
    }

    @Test
    void restartPattern_reportsAnOpenRestart() {
        // all-green through DAY-1, break happens ON DAY: as of DAY-1 no break exists yet at all
        // (state null), as of DAY the break is brand new and still open -> the state changes.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 20; i >= 1; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        days.add(needsDay(DAY, false));
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new RestartPatternDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("még nem volt újra teljes");
    }

    @Test
    void restartPattern_reportsASlowButRealRecoveryAsAFactNotAsStillOpen() {
        // Break on DAY-9 (DAY-10 all-green, DAY-9 not), nothing complete again until DAY itself
        // (gap 9, past HOSSZU_MAX=7) -- the C1 regression: this used to fall into the same
        // "nyitott" bucket as a break that never recovered, and the dossier said "still no
        // complete day" on the very day the user got back on track. As of DAY-1 no recovery had
        // happened yet (state "nyitott"), so the band genuinely changes as of DAY.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 27; i >= 10; i--) {
            days.add(needsDay(DAY.minusDays(i), true));
        }
        for (int i = 9; i >= 1; i--) {
            days.add(needsDay(DAY.minusDays(i), false));
        }
        days.add(needsDay(DAY, true));
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new RestartPatternDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("9 nap telt el")
                .doesNotContain("még nem volt újra teljes");
    }

    @Test
    void retroLogging_firesWhenReflectionEntriesAreMostlyBackfilled() {
        List<DetectorInput.LogLatencyPoint> pts = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            pts.add(latency("reflexio", DAY.minusDays(i), i % 4 == 0 ? 0 : 2));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().latencies(pts).build());

        List<DetectorSignal> fired = new RetroLoggingRatioDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("többnyire utólag rögzíti")
                .contains("nem arról, hogy pontosak-e");
    }

    @Test
    void retroLogging_silentBelowThePerGroupMinimum() {
        List<DetectorInput.LogLatencyPoint> pts = List.of(
                latency("reflexio", DAY, 3), latency("esemeny", DAY.minusDays(1), 2));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().latencies(pts).build());

        assertThat(new RetroLoggingRatioDetector().detect(in)).isEmpty();
    }

    private static DetectorInput.CheckinSlotPoint slot(LocalDate d, String slotTime, int hour,
                                                       int minute, String note) {
        return new DetectorInput.CheckinSlotPoint(d, slotTime, d.atTime(hour, minute), note);
    }

    private static DetectorInput.NeedsDayPoint needsDomains(LocalDate d, int lelek) {
        return new DetectorInput.NeedsDayPoint(d, 80, 80, 80, 80, lelek, 80,
                lelek >= 60 ? 6 : 5, lelek >= 60, 1);
    }

    @Test
    void nightActivity_firesOnRegularLateNightChat() {
        // 3 nights of chat as of DAY -> "rendszeres" (n=3 > ALKALMI_MAX=2); as of DAY-1 only the
        // 2 older nights remain -> "alkalmi" (n=2 <= ALKALMI_MAX): the band crosses a boundary.
        List<LocalDateTime> chat = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            chat.add(DAY.minusDays(i).atTime(1, 30));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().chat(chat).build());

        List<DetectorSignal> fired = new NightActivityDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("a chat használatát mutatja");
        assertThat(fired.getFirst().expertKey()).isEqualTo("szomnologus");
    }

    @Test
    void nightActivity_silentWhenTheUserDoesNotChatAtAll() {
        DetectorInput in = trendOnly(DAY, new TrendBuilder().build());

        assertThat(new NightActivityDetector().detect(in)).isEmpty();
    }

    @Test
    void checkinLatency_firesOnLateFilling_andIgnoresEarlyAsPunctual() {
        // As of DAY-1: 3 punctual (10 min) + 3 late (300 min) -> median 155 -> "keses". Adding the
        // DAY row (660 min late) as of DAY shifts the 7-row median to 300 -> "kesoi": a real
        // band crossing, hand-verified (the brief's own single-outlier fixture never crosses a
        // band since one row can never move a 6/7-element median past the majority).
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        slots.add(slot(DAY, "07:00", 18, 0, null));               // 660 min late
        slots.add(slot(DAY.minusDays(1), "07:00", 12, 0, null));  // 300 min late
        slots.add(slot(DAY.minusDays(2), "07:00", 12, 0, null));  // 300 min late
        slots.add(slot(DAY.minusDays(3), "07:00", 12, 0, null));  // 300 min late
        slots.add(slot(DAY.minusDays(4), "07:00", 7, 10, null));  // 10 min, punctual
        slots.add(slot(DAY.minusDays(5), "07:00", 7, 10, null));  // 10 min, punctual
        slots.add(slot(DAY.minusDays(6), "07:00", 7, 10, null));  // 10 min, punctual
        List<DetectorInput.CheckinDayPoint> scales = List.of(scale(DAY, "6", "6"));
        DetectorInput in = trendOnly(DAY,
                new TrendBuilder().slots(slots).checkins(scales).build());

        List<DetectorSignal> fired = new CheckinLatencyDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("jóval a saját idősávjuk után");
    }

    @Test
    void checkinSlotDrift_namesTheSlotThatStopped() {
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        for (int i = 14; i < 20; i++) {                 // baseline window
            slots.add(slot(DAY.minusDays(i), "07:00", 7, 5, null));
            slots.add(slot(DAY.minusDays(i), "21:00", 21, 5, null));
        }
        for (int i = 0; i < 6; i++) {                   // recent window: only the evening survives
            slots.add(slot(DAY.minusDays(i), "21:00", 21, 5, null));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().slots(slots).build());

        List<DetectorSignal> fired = new CheckinSlotDriftDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("07:00").doesNotContain("21:00");
    }

    @Test
    void checkinSlotDrift_firstEverStabilDoesNotClaimARecovery() {
        // "07:00" only reaches MIN_BASELINE_ROWS(3) in the baseline window as of DAY (DAY-14,
        // DAY-15, DAY-16); as of DAY-1 the baseline window shifts to end at DAY-15, so DAY-14 falls
        // out and only 2 rows remain -> below the gate -> state(DAY-1) is null. So "slot:stabil" as
        // of DAY is the FIRST state ever computed here, not a return from "kikopott" -- the C2
        // regression said "visszaállt" (recovered) on a slot the user never actually dropped.
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        slots.add(slot(DAY.minusDays(14), "07:00", 7, 5, null));
        slots.add(slot(DAY.minusDays(15), "07:00", 7, 5, null));
        slots.add(slot(DAY.minusDays(16), "07:00", 7, 5, null));
        slots.add(slot(DAY, "07:00", 7, 5, null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().slots(slots).build());

        List<DetectorSignal> fired = new CheckinSlotDriftDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).doesNotContain("visszaállt")
                .contains("Nincs olyan");
    }

    @Test
    void needsDomainImbalance_firesWhenOneDomainLagsWhileTheRestAreGreen() {
        // Exactly MIN_NEEDS_DAYS(7) rows: as of DAY the window holds all 7 (gate open, lélek is
        // weak against 5 strong domains); as of DAY-1 only 6 remain (below the gate, state null) —
        // a real state change, not a same-value coincidence like a wider uniform window would give.
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            days.add(needsDomains(DAY.minusDays(i), 20));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        List<DetectorSignal> fired = new NeedsDomainImbalanceDetector().detect(in);

        assertThat(fired).hasSize(1);
        assertThat(fired.getFirst().summary()).contains("lélek");
        assertThat(fired.getFirst().expertKey()).isEqualTo("pszichologus");
    }

    @Test
    void needsDomainImbalance_silentBelowTheClosedDayGate() {
        List<DetectorInput.NeedsDayPoint> days = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            days.add(needsDomains(DAY.minusDays(i), 20));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder()
                .needs(new DetectorInput.NeedsContext(60, days)).build());

        assertThat(new NeedsDomainImbalanceDetector().detect(in)).isEmpty();
    }

    @Test
    void allTwelveRoundThreeDetectorsHaveDistinctKeysAndValidExperts() {
        List<CharacterDetector> detectors = List.of(new SelfCalibrationDetector(),
                new PromiseVsDeliveryDetector(), new DecisionProfileDetector(),
                new DecisionReviewBacklogDetector(), new GratitudeFocusDetector(),
                new StreakBreakResponseDetector(), new RestartPatternDetector(),
                new RetroLoggingRatioDetector(), new NightActivityDetector(),
                new CheckinLatencyDetector(), new CheckinSlotDriftDetector(),
                new NeedsDomainImbalanceDetector());

        assertThat(detectors).extracting(CharacterDetector::key).doesNotHaveDuplicates().hasSize(12);
    }

    private static DetectorInput.MentionPoint mention(LocalDate d, String contextLabel) {
        return new DetectorInput.MentionPoint(d, UUID.fromString("00000000-0000-0000-0000-000000000001"), contextLabel, false);
    }

    private static DetectorInput.SleepPoint sleepClock(LocalDate d, String bed, String wake) {
        return new DetectorInput.SleepPoint(d, 7, new BigDecimal("7.5"), 1,
                java.time.LocalTime.parse(bed), java.time.LocalTime.parse(wake));
    }

    private static DetectorInput.CheckinDayPoint mentalOnly(LocalDate d, String mental) {
        return new DetectorInput.CheckinDayPoint(d, 1, null, null, null, new BigDecimal(mental));
    }

    // ── people-mood-link ────────────────────────────────────────────────────────

    @Test
    void peopleMoodLink_firesWhenMentionDaysRunHigher_firstTimeThePairedFloorIsMet() {
        // 7 mention days (incl. DAY) at mental 8 + 7 other days at mental 5 → paired = 14 as of DAY
        // (gate met, Δ = +3,0 → "magasabb", tier "gyenge" since |M| = 7); as of DAY-1 paired = 13 → null.
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean mentionDay = i % 2 == 0;           // i=0 is DAY → a mention day
            if (mentionDay) {
                mentions.add(mention(d, "munka"));
            }
            checkins.add(mentalOnly(d, mentionDay ? "8" : "5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        List<DetectorSignal> fired = new PeopleMoodLinkDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("people-mood-link");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("7 napján").contains("8,0").contains("7 említés nélküli napon")
                    .contains("5,0").contains("magasabb").contains("gyenge").contains("nem irány");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void peopleMoodLink_silentBelowTheOnePointDelta() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            LocalDate d = DAY.minusDays(i);
            if (i % 2 == 0) {
                mentions.add(mention(d, null));
            }
            checkins.add(mentalOnly(d, i % 2 == 0 ? "6" : "5.5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        assertThat(new PeopleMoodLinkDetector().detect(in)).isEmpty();
    }

    @Test
    void peopleMoodLink_silentWhenTheBandIsUnchangedSinceYesterday() {
        // nothing on DAY: both evaluations see the same 16 paired days → same band → no signal
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 1; i <= 16; i++) {
            LocalDate d = DAY.minusDays(i);
            if (i % 2 == 0) {
                mentions.add(mention(d, "munka"));
            }
            checkins.add(mentalOnly(d, i % 2 == 0 ? "8" : "5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        assertThat(new PeopleMoodLinkDetector().detect(in)).isEmpty();
    }

    // ── mention-context-shift ───────────────────────────────────────────────────

    @Test
    void mentionContextShift_firesWhenADominantContextFirstAppears() {
        // 6 labelled mentions, all on DAY: munka×3, csalad×2, konfliktus×1 → dominant munka (50%),
        // konfliktus share 17% → "jelen". As of DAY-1: 0 labelled → null.
        List<DetectorInput.MentionPoint> mentions = List.of(
                mention(DAY, "munka"), mention(DAY, "munka"), mention(DAY, "munka"),
                mention(DAY, "csalad"), mention(DAY, "csalad"), mention(DAY, "konfliktus"),
                mention(DAY, null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        List<DetectorSignal> fired = new MentionContextShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("mention-context-shift");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("6 címkézett").contains("munka").contains("50%")
                    .contains("17%").contains("jelen").contains("még kevés volt").contains("1 említés még címkézetlen")
                    .contains("éjszakai osztályozója");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void mentionContextShift_firesWithSalience4WhenTheKonfliktusBandRisesToMagas() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            mentions.add(mention(DAY.minusDays(i), "munka"));
        }
        mentions.add(mention(DAY.minusDays(5), "csalad"));
        mentions.add(mention(DAY.minusDays(6), "csalad"));          // as of DAY-1: munka|nincs (0% konfliktus)
        for (int i = 0; i < 3; i++) {
            mentions.add(mention(DAY, "konfliktus"));               // as of DAY: 3/9 = 33% → magas
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        List<DetectorSignal> fired = new MentionContextShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("33%").contains("magas").contains("korábban munka/nincs");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void mentionContextShift_silentWhenUnchanged() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            mentions.add(mention(DAY.minusDays(i), i <= 5 ? "edzes" : "baratok"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        assertThat(new MentionContextShiftDetector().detect(in)).isEmpty();
    }

    // ── weekend-gap ─────────────────────────────────────────────────────────────

    @Test
    void weekendGap_midsleepMinutes_handlesMidnightCrossing() {
        assertThat(WeekendGapDetector.midsleepMinutes(java.time.LocalTime.of(0, 30), java.time.LocalTime.of(8, 30)))
                .isEqualTo(270);   // 04:30
        assertThat(WeekendGapDetector.midsleepMinutes(java.time.LocalTime.of(23, 30), java.time.LocalTime.of(7, 30)))
                .isEqualTo(210);   // 03:30
    }

    @Test
    void weekendGap_firesWhenTheJetlagBandBecomesComputable() {
        // DAY = 2026-08-27 (Thursday). Work nights: 14 weekday dates before DAY + DAY itself = 15
        // (as of DAY-1 only 14 → "keves"; as of DAY → computable). Free nights: 6 (three weekends).
        // Work midsleep 23:00→07:00 = 03:00 = 180; free 01:00→10:00 = 05:30 = 330; Δ = +150 → "jelentos".
        List<DetectorInput.SleepPoint> sleep = new ArrayList<>();
        for (LocalDate d : List.of(LocalDate.of(2026, 8, 26), LocalDate.of(2026, 8, 25), LocalDate.of(2026, 8, 24),
                LocalDate.of(2026, 8, 21), LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 19), LocalDate.of(2026, 8, 18),
                LocalDate.of(2026, 8, 17), LocalDate.of(2026, 8, 14), LocalDate.of(2026, 8, 13), LocalDate.of(2026, 8, 12),
                LocalDate.of(2026, 8, 11), LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 7), DAY)) {
            sleep.add(sleepClock(d, "23:00", "07:00"));
        }
        for (LocalDate d : List.of(LocalDate.of(2026, 8, 22), LocalDate.of(2026, 8, 23), LocalDate.of(2026, 8, 15),
                LocalDate.of(2026, 8, 16), LocalDate.of(2026, 8, 8), LocalDate.of(2026, 8, 9))) {
            sleep.add(sleepClock(d, "01:00", "10:00"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().sleep(sleep).build());

        List<DetectorSignal> fired = new WeekendGapDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("weekend-gap");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("150 perccel később").contains("jelentős social jetlag")
                    .contains("6 szabad- és 15 munkaéjszakából").contains("nincs érdemi rés")
                    .contains("Hétvége itt szombat–vasárnap");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void weekendGap_firesWhenTheLoggingGapCrossesTheQuarterLine() {
        // 49-day window as of DAY (2026-08-27): Jul 10 .. Aug 27 → 35 weekdays, 14 weekend days.
        // Check-ins on every weekday except Aug 24 (34/35 = 97%) and on 10 of 14 weekend days
        // (skip Aug 15, 16, 22, 23 → 71%) → gap 26% ≥ 25% → "res". As of DAY-1 the window is
        // Jul 9 .. Aug 26: Jul 9 unlogged too → 33/35 = 94% − 71% = 23% → "nincs-res". Change → fires.
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        Set<LocalDate> skip = Set.of(LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 15), LocalDate.of(2026, 8, 16),
                LocalDate.of(2026, 8, 22), LocalDate.of(2026, 8, 23));
        for (LocalDate d = LocalDate.of(2026, 7, 10); !d.isAfter(DAY); d = d.plusDays(1)) {
            if (!skip.contains(d)) {
                checkins.add(mentalOnly(d, "6"));
            }
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(checkins).build());

        List<DetectorSignal> fired = new WeekendGapDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("még kevés a hétvégi alvásnapló")
                    .contains("hétvégén a napok 71%-án").contains("hétköznap 97%-án").contains("hétvégi rés");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void weekendGap_silentWhenNothingChanged() {
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            checkins.add(mentalOnly(DAY.minusDays(i), "6"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(checkins).build());

        assertThat(new WeekendGapDetector().detect(in)).isEmpty();
    }
}
