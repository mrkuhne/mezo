package io.mrkuhne.mezo.feature.character.detector;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Check-in 2.0 (mezo-ck2, plan Task 6): fixture tests for the seven new detectors (a positive, a
 * negative and a small-n case each) and the new arms of the three changed ones.
 */
class CheckinTwoDetectorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    // ── fixture builders ────────────────────────────────────────────────────────

    /** Mutable CheckinDayPoint builder — every item absent unless set. */
    private static final class Day {
        private final LocalDate date;
        private BigDecimal energy;
        private BigDecimal stress;
        private BigDecimal body;
        private BigDecimal mental;
        private BigDecimal mood;
        private BigDecimal rested;
        private BigDecimal soreness;
        private BigDecimal painIntensity;
        private BigDecimal motivation;
        private BigDecimal craving;
        private BigDecimal connection;
        private List<PainRegion> regions = List.of();

        Day(LocalDate date) {
            this.date = date;
        }

        Day stress(double v) { stress = bd(v); return this; }
        Day mental(double v) { mental = bd(v); return this; }
        Day mood(double v) { mood = bd(v); return this; }
        Day rested(double v) { rested = bd(v); return this; }
        Day soreness(double v) { soreness = bd(v); return this; }
        Day pain(double intensity, PainRegion... r) { painIntensity = bd(intensity); regions = List.of(r); return this; }
        Day craving(double v) { craving = bd(v); return this; }
        Day connection(double v) { connection = bd(v); return this; }

        DetectorInput.CheckinDayPoint build() {
            return new DetectorInput.CheckinDayPoint(date, 1, energy, stress, body, mental, mood, rested,
                    soreness, painIntensity, motivation, null, craving, null, connection, null, regions);
        }
    }

    private static Day day(LocalDate d) {
        return new Day(d);
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }

    /** Fluent TrendWindow builder — every component defaults to empty. */
    private static final class Trend {
        private List<DetectorInput.GymDay> gym = List.of();
        private List<DetectorInput.MealDayPoint> meals = List.of();
        private List<DetectorInput.CheckinDayPoint> checkins = List.of();
        private List<DetectorInput.SleepPoint> sleep = List.of();
        private List<DetectorInput.CheckinSlotPoint> slots = List.of();
        private List<DetectorInput.MentionPoint> mentions = List.of();
        private Integer sleepGoal;
        private List<DetectorInput.TextMoodPoint> textMoods = List.of();
        private List<DetectorInput.HabitDayPoint> habits = List.of();

        Trend gym(List<DetectorInput.GymDay> v) { gym = v; return this; }
        Trend meals(List<DetectorInput.MealDayPoint> v) { meals = v; return this; }
        Trend checkins(List<DetectorInput.CheckinDayPoint> v) { checkins = v; return this; }
        Trend sleep(List<DetectorInput.SleepPoint> v) { sleep = v; return this; }
        Trend slots(List<DetectorInput.CheckinSlotPoint> v) { slots = v; return this; }
        Trend mentions(List<DetectorInput.MentionPoint> v) { mentions = v; return this; }
        Trend sleepGoal(Integer v) { sleepGoal = v; return this; }
        Trend textMoods(List<DetectorInput.TextMoodPoint> v) { textMoods = v; return this; }
        Trend habits(List<DetectorInput.HabitDayPoint> v) { habits = v; return this; }

        DetectorInput build() {
            return build(null);
        }

        DetectorInput build(DetectorInput.MesoContext meso) {
            DetectorInput.TrendWindow trend = new DetectorInput.TrendWindow(List.of(), gym, meals, List.of(), null,
                    checkins, null, sleep, List.of(), List.of(), List.of(), null, slots, List.of(), List.of(),
                    mentions, List.of(), DetectorInput.MetaWindow.empty(), sleepGoal, textMoods, habits);
            return new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(), List.of(), List.of(),
                    List.of(), List.of(), meso, trend);
        }
    }

    private static DetectorInput.SleepPoint sleep(LocalDate d, String hours, Integer quality) {
        return new DetectorInput.SleepPoint(d, quality, hours == null ? null : new BigDecimal(hours), null, null, null);
    }

    private static DetectorInput.GymDay gym(LocalDate d, String type) {
        return new DetectorInput.GymDay(d, List.of(), type);
    }

    private static DetectorInput.MealDayPoint mealDay(LocalDate d, String kcal, String protein, String nova4Share,
                                                      List<DetectorInput.MealPoint> meals) {
        return new DetectorInput.MealDayPoint(d, new BigDecimal(kcal), new BigDecimal(protein),
                new BigDecimal("200"), new BigDecimal("60"),
                nova4Share == null ? null : new BigDecimal(nova4Share),
                nova4Share == null ? null : new BigDecimal("1.0000"),
                new BigDecimal("3000"), new BigDecimal("200"), meals);
    }

    private static DetectorInput.CheckinSlotPoint slot(LocalDate d, String time, Integer motivation, Integer digestion) {
        return new DetectorInput.CheckinSlotPoint(d, time, d.atTime(LocalTime.parse(time)), null, motivation, digestion);
    }

    // ── pain-map ────────────────────────────────────────────────────────────────

    @Test
    void painMap_firesWhenARegionBecomesRecurring_withTheGymContext() {
        List<DetectorInput.CheckinDayPoint> checkins = List.of(
                day(DAY).pain(5, PainRegion.DEREK).build(),
                day(DAY.minusDays(3)).pain(5, PainRegion.DEREK, PainRegion.TERD).build(),
                day(DAY.minusDays(6)).pain(5, PainRegion.DEREK).build());
        List<DetectorInput.GymDay> gyms = List.of(gym(DAY.minusDays(1), "Láb"), gym(DAY.minusDays(4), "Láb"),
                gym(DAY.minusDays(7), "Láb"));

        List<DetectorSignal> fired = new PainMapDetector().detect(new Trend().checkins(checkins).gym(gyms).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("pain-map");
            assertThat(s.expertKey()).isEqualTo("doki");
            assertThat(s.summary()).contains("derék 3 napon").doesNotContain("térd")
                    .contains("5,0/10").contains("Főleg edzésnapon vagy az azt követő napon jelentkezett (3/3)")
                    .contains("nem diagnózis");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void painMap_silentWhenTheRecurringSetIsUnchangedSinceYesterday() {
        List<DetectorInput.CheckinDayPoint> checkins = List.of(
                day(DAY.minusDays(1)).pain(4, PainRegion.VALL).build(),
                day(DAY.minusDays(3)).pain(4, PainRegion.VALL).build(),
                day(DAY.minusDays(5)).pain(4, PainRegion.VALL).build());
        assertThat(new PainMapDetector().detect(new Trend().checkins(checkins).build())).isEmpty();
    }

    @Test
    void painMap_silentBelowThreeDaysInTheWindow() {
        List<DetectorInput.CheckinDayPoint> checkins = List.of(
                day(DAY).pain(7, PainRegion.VALL).build(),
                day(DAY.minusDays(2)).pain(7, PainRegion.VALL).build(),
                day(DAY.minusDays(14)).pain(7, PainRegion.VALL).build()); // outside the 14-day window
        assertThat(new PainMapDetector().detect(new Trend().checkins(checkins).build())).isEmpty();
    }

    // ── sleep-need ──────────────────────────────────────────────────────────────

    /** 20 paired nights, 5 per 30-min bucket (6,0 / 6,5 / 7,0 / 7,5 h) with the given rested values;
     *  one 7,5 h night is ON DAY, so as of DAY-1 the top bucket has only 4 nights. */
    private static Trend sleepFixture(double r60, double r65, double r70, double r75) {
        String[] hours = {"7.5", "6.0", "6.5", "7.0"};
        double[] rested = {r75, r60, r65, r70};
        List<DetectorInput.SleepPoint> sleep = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            LocalDate d = DAY.minusDays(i);
            sleep.add(sleep(d, hours[i % 4], 6));
            checkins.add(day(d).rested(rested[i % 4]).build());
        }
        return new Trend().sleep(sleep).checkins(checkins);
    }

    @Test
    void sleepNeed_estimatesThePlateau_andProposesTheGoalWithoutWritingIt() {
        List<DetectorSignal> fired = new SleepNeedDetector()
                .detect(sleepFixture(4, 5, 7, 7.2).sleepGoal(480).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("sleep-need");
            assertThat(s.expertKey()).isEqualTo("szomnologus");
            assertThat(s.summary()).contains("20 összepárosított éjszaka").contains("kb. 7 óra alvás elég")
                    .contains("7–7,5 órás").contains("Az alváscélod most 8 óra").contains("7 órára igazítani")
                    .contains("csak javaslat");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void sleepNeed_noGoalProposal_whenTheGoalIsWithinHalfAnHour() {
        List<DetectorSignal> fired = new SleepNeedDetector()
                .detect(sleepFixture(4, 5, 7, 7.2).sleepGoal(435).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).doesNotContain("alváscélod");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void sleepNeed_silentWithoutAPlateau_whenTheLongestBucketIsStillTheBest() {
        assertThat(new SleepNeedDetector().detect(sleepFixture(4, 5, 6, 7.5).build())).isEmpty();
    }

    @Test
    void sleepNeed_silentBelowFourteenPairedNights() {
        Trend t = sleepFixture(4, 5, 7, 7.2);
        t.sleep(t.sleep.subList(0, 13));
        assertThat(new SleepNeedDetector().detect(t.build())).isEmpty();
    }

    // ── craving-trigger ─────────────────────────────────────────────────────────

    /** 5 craving days (incl. DAY) after short nights; 8 other answered days, {@code shortOthers} of them short. */
    private static Trend cravingFixture(int cravingDays, int shortOthers) {
        List<DetectorInput.SleepPoint> sleep = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < cravingDays; i++) {
            LocalDate d = DAY.minusDays(2L * i);
            checkins.add(day(d).craving(8).build());
            sleep.add(sleep(d, "5.5", null));
        }
        for (int i = 0; i < 8; i++) {
            LocalDate d = DAY.minusDays(20L + i);
            checkins.add(day(d).craving(3).build());
            sleep.add(sleep(d, i < shortOthers ? "5.5" : "7.5", null));
        }
        return new Trend().sleep(sleep).checkins(checkins);
    }

    @Test
    void cravingTrigger_namesShortSleepWhenItPrecedesCravingDays() {
        List<DetectorSignal> fired = new CravingTriggerDetector().detect(cravingFixture(5, 1).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("craving-trigger");
            assertThat(s.expertKey()).isEqualTo("taplalkozo");
            assertThat(s.summary()).contains("rövid alvás").contains("5 ilyen napból 5 előtt (100%)")
                    .contains("8 megválaszolt napból csak 1 előtt (13%)").contains("nem ok");
        });
    }

    @Test
    void cravingTrigger_silentWhenTheFactorIsEquallyCommonOnOtherDays() {
        assertThat(new CravingTriggerDetector().detect(cravingFixture(5, 7).build())).isEmpty();
    }

    @Test
    void cravingTrigger_silentBelowFiveCravingDays() {
        assertThat(new CravingTriggerDetector().detect(cravingFixture(4, 0).build())).isEmpty();
    }

    // ── food-digestion ──────────────────────────────────────────────────────────

    /** {@code low} low answers at 14:00 after a bab+rizs lunch at 11:00, and 5 OK answers after
     *  {@code okLunch}. The first low answer is ON DAY. */
    private static Trend digestionFixture(int low, List<String> okLunch) {
        List<DetectorInput.MealDayPoint> meals = new ArrayList<>();
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        for (int i = 0; i < low; i++) {
            LocalDate d = DAY.minusDays(i);
            meals.add(mealDay(d, "2500", "150", "0.2", List.of(
                    new DetectorInput.MealPoint("lunch", LocalTime.of(11, 0), new BigDecimal("800"), 1,
                            List.of("bab", "rizs")),
                    // 30 min before the answer: outside the 1–5 h window
                    new DetectorInput.MealPoint("snack", LocalTime.of(13, 30), new BigDecimal("200"), 4,
                            List.of("keksz")))));
            slots.add(slot(d, "14:00", null, 3));
        }
        for (int i = 0; i < 5; i++) {
            LocalDate d = DAY.minusDays(10L + i);
            meals.add(mealDay(d, "2500", "150", "0.2", List.of(
                    new DetectorInput.MealPoint("lunch", LocalTime.of(11, 0), new BigDecimal("800"), 1, okLunch),
                    new DetectorInput.MealPoint("snack", LocalTime.of(13, 30), new BigDecimal("200"), 4,
                            List.of("keksz")))));
            slots.add(slot(d, "14:00", null, 8));
        }
        return new Trend().meals(meals).slots(slots);
    }

    @Test
    void foodDigestion_namesTheRecurringCulprit_notTheIngredientInEveryMeal() {
        List<DetectorSignal> fired = new FoodDigestionDetector()
                .detect(digestionFixture(5, List.of("csirke", "rizs")).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("food-digestion");
            assertThat(s.expertKey()).isEqualTo("taplalkozo");
            assertThat(s.summary()).contains("„bab”").contains("5 alkalomból 5 esetben")
                    .contains("5 nehéz és 5 rendben").doesNotContain("keksz").doesNotContain("rizs");
        });
    }

    @Test
    void foodDigestion_silentWhenTheSuspectPrecedesGoodAnswersJustAsOften() {
        assertThat(new FoodDigestionDetector().detect(digestionFixture(5, List.of("bab", "rizs")).build()))
                .isEmpty();
    }

    @Test
    void foodDigestion_silentBelowFiveLowAnswers() {
        assertThat(new FoodDigestionDetector().detect(digestionFixture(4, List.of("csirke")).build())).isEmpty();
    }

    // ── mood-text-calibration ───────────────────────────────────────────────────

    private static Trend moodTextFixture(int days, double mood, int textMood) {
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        List<DetectorInput.TextMoodPoint> text = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate d = DAY.minusDays(i * 3L);
            checkins.add(day(d).mood(mood).build());
            text.add(new DetectorInput.TextMoodPoint(d, BigDecimal.valueOf(textMood)));
        }
        // a text-only day and a check-in-only day never pair
        text.add(new DetectorInput.TextMoodPoint(DAY.minusDays(1), BigDecimal.ONE));
        checkins.add(day(DAY.minusDays(2)).mood(1).build());
        return new Trend().checkins(checkins).textMoods(text);
    }

    @Test
    void moodTextCalibration_reportsAgreement_onTheRescaledScale() {
        // text 4/5 → 7,75/10 vs check-in 8 → agrees; the 8th paired day is DAY
        List<DetectorSignal> fired = new MoodTextCalibrationDetector().detect(moodTextFixture(8, 8, 4).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("mood-text-calibration");
            assertThat(s.expertKey()).isEqualTo("pszichologus");
            assertThat(s.summary()).contains("8 olyan napján").contains("8 napon (100%)")
                    .contains("úgy írsz, ahogy értékelsz").doesNotContain("ponttal");
            assertThat(s.salience()).isEqualTo(3);
        });
        assertThat(MoodTextCalibrationDetector.rescale(1)).isEqualTo(1.0);
        assertThat(MoodTextCalibrationDetector.rescale(5)).isEqualTo(10.0);
    }

    @Test
    void moodTextCalibration_namesTheDirection_whenTheCheckinRunsHigher() {
        List<DetectorSignal> fired = new MoodTextCalibrationDetector().detect(moodTextFixture(8, 9, 2).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("0 napon (0%)").contains("többnyire máshol áll")
                    .contains("5,8 ponttal magasabbra");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void moodTextCalibration_silentBelowEightPairedDays() {
        assertThat(new MoodTextCalibrationDetector().detect(moodTextFixture(7, 8, 4).build())).isEmpty();
    }

    // ── motivation-follow-through ───────────────────────────────────────────────

    /** Low (3) and high (8) morning-motivation days, 2 habits each; low days deliver {@code lowDone}. */
    private static Trend motivationFixture(int lowDays, int highDays, int lowDone) {
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        List<DetectorInput.HabitDayPoint> habits = new ArrayList<>();
        for (int i = 0; i < lowDays; i++) {
            LocalDate d = DAY.minusDays(2L * i);
            slots.add(slot(d, "06:30", 3, null));
            slots.add(slot(d, "20:00", 9, null)); // an evening answer is not "morning motivation"
            habits.add(new DetectorInput.HabitDayPoint(d, 2, lowDone));
        }
        for (int i = 0; i < highDays; i++) {
            LocalDate d = DAY.minusDays(2L * i + 1);
            slots.add(slot(d, "10:00", 8, null));
            habits.add(new DetectorInput.HabitDayPoint(d, 2, 2));
        }
        return new Trend().slots(slots).habits(habits);
    }

    @Test
    void motivationFollowThrough_firesWhenLowMorningsDeliverLess() {
        List<DetectorSignal> fired = new MotivationFollowThroughDetector().detect(motivationFixture(5, 5, 0).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("motivation-follow-through");
            assertThat(s.expertKey()).isEqualTo("drill");
            assertThat(s.summary()).contains("5 nap) a tervezett edzés és szokások 0%-a")
                    .contains("100%-a").contains("előre jelzi");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void motivationFollowThrough_saysSoWhenDeliveryIsIndependentOfMotivation() {
        List<DetectorSignal> fired = new MotivationFollowThroughDetector().detect(motivationFixture(5, 5, 2).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("függetlenül hozod a tervet");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void motivationFollowThrough_countsThePlannedWorkoutFromTheMeso() {
        // No habits: the only planned item is the meso's weekday workout. Low days (DAY's weekday)
        // skip it, high days (the weekday before) do it.
        List<DetectorInput.CheckinSlotPoint> slots = new ArrayList<>();
        List<DetectorInput.GymDay> gyms = new ArrayList<>();
        for (int w = 0; w < 5; w++) {
            LocalDate thu = DAY.minusWeeks(w);
            LocalDate wed = thu.minusDays(1);
            slots.add(slot(thu, "06:30", 2, null));
            slots.add(slot(wed, "06:30", 9, null));
            gyms.add(gym(wed, "Push"));
        }
        DetectorInput.MesoContext meso = new DetectorInput.MesoContext("Blokk", 3, 6, false,
                Set.of(DAY.getDayOfWeek(), DAY.minusDays(1).getDayOfWeek()), Set.of());
        List<DetectorSignal> fired = new MotivationFollowThroughDetector()
                .detect(new Trend().slots(slots).gym(gyms).build(meso));
        assertThat(fired).singleElement().satisfies(s -> assertThat(s.summary()).contains("előre jelzi"));
    }

    @Test
    void motivationFollowThrough_silentBelowFiveDaysPerGroup() {
        assertThat(new MotivationFollowThroughDetector().detect(motivationFixture(5, 4, 0).build())).isEmpty();
    }

    // ── soreness-recovery ───────────────────────────────────────────────────────

    /** "Láb" sessions every 7 days from DAY-3 back; soreness 7, 5, then back to 2 on day 3. */
    private static Trend sorenessFixture(int sessions, int spacingDays) {
        List<DetectorInput.GymDay> gyms = new ArrayList<>();
        Map<LocalDate, Double> soreness = new java.util.TreeMap<>();
        for (int s = 0; s < sessions; s++) {
            LocalDate g = DAY.minusDays(3L + (long) s * spacingDays);
            gyms.add(gym(g, "Láb"));
            for (int k = 1; k <= 6; k++) {
                soreness.putIfAbsent(g.plusDays(k), k == 1 ? 7.0 : k == 2 ? 5.0 : 2.0);
            }
        }
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        soreness.forEach((d, v) -> {
            if (!d.isAfter(DAY)) {
                checkins.add(day(d).soreness(v).build());
            }
        });
        return new Trend().gym(gyms).checkins(checkins);
    }

    @Test
    void sorenessRecovery_reportsDaysBackToTheOwnBaseline_perSessionType() {
        List<DetectorSignal> fired = new SorenessRecoveryDetector().detect(sorenessFixture(5, 7).build());

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("soreness-recovery");
            assertThat(s.expertKey()).isEqualTo("edzo");
            assertThat(s.summary()).contains("alapszintedre (2,0/10)").contains("Láb: átlagosan 3,0 nap (5 edzés)");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void sorenessRecovery_silentWhenSessionsOverlapTheRecovery() {
        // a session every 2 days: every episode is censored by the next session
        assertThat(new SorenessRecoveryDetector().detect(sorenessFixture(12, 2).build())).isEmpty();
    }

    @Test
    void sorenessRecovery_silentBelowFiveEpisodes() {
        assertThat(new SorenessRecoveryDetector().detect(sorenessFixture(4, 7).build())).isEmpty();
    }

    // ── changed: people-mood-link ───────────────────────────────────────────────

    private static DetectorInput.MentionPoint mention(LocalDate d) {
        return new DetectorInput.MentionPoint(d, UUID.nameUUIDFromBytes(d.toString().getBytes()), "munka", false);
    }

    @Test
    void peopleMoodLink_readsMoodBeforeMental() {
        // mood says mention days are HIGHER; the (ignored) mental scale says the opposite
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean mentionDay = i % 2 == 0;
            if (mentionDay) {
                mentions.add(mention(d));
            }
            checkins.add(day(d).mood(mentionDay ? 8 : 5).mental(mentionDay ? 3 : 9).build());
        }
        List<DetectorSignal> fired = new PeopleMoodLinkDetector()
                .detect(new Trend().mentions(mentions).checkins(checkins).build());
        assertThat(fired).singleElement().satisfies(s ->
                assertThat(s.summary()).contains("hangulat check-in átlaga").contains("8,0").contains("magasabb"));
    }

    private static Trend connectionFixture(int mentionDays, int otherDays) {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < mentionDays; i++) {
            LocalDate d = DAY.minusDays(2L * i);
            mentions.add(mention(d));
            checkins.add(day(d).connection(8).build());
        }
        for (int i = 0; i < otherDays; i++) {
            checkins.add(day(DAY.minusDays(2L * i + 1)).connection(4).build());
        }
        return new Trend().mentions(mentions).checkins(checkins);
    }

    @Test
    void peopleMoodLink_connectionArmFires_onceBothGroupsHaveFiveAnswers() {
        List<DetectorSignal> fired = new PeopleMoodLinkDetector().detect(connectionFixture(5, 5).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("kapcsolódás-érzésed").contains("8,0").contains("4,0")
                    .contains("(5 és 5 nap)").contains("magasabb").doesNotContain("hangulat check-in");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void peopleMoodLink_connectionArmSilent_belowFivePerGroup() {
        assertThat(new PeopleMoodLinkDetector().detect(connectionFixture(5, 4).build())).isEmpty();
    }

    // ── changed: comfort-eating ─────────────────────────────────────────────────

    /** 24 paired days; three of them (incl. DAY) spike on the given check-in. */
    private static Trend comfortFixture(Day bad, Day calm) {
        List<DetectorInput.MealDayPoint> meals = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            boolean spike = i % 4 == 0 && i <= 8;
            LocalDate d = DAY.minusDays(i);
            meals.add(mealDay(d, spike ? "3600" : "2900", "200", spike ? "0.75" : "0.15", List.of()));
            Day template = spike ? bad : calm;
            Day c = day(d);
            c.mood = template.mood;
            c.mental = template.mental;
            c.stress = template.stress;
            checkins.add(c.build());
        }
        return new Trend().meals(meals).checkins(checkins);
    }

    @Test
    void comfortEating_lowMoodUsesMood_evenWhenMentalLooksFine() {
        List<DetectorSignal> fired = new ComfortEatingDetector().detect(comfortFixture(
                day(DAY).mood(3).mental(8).stress(2), day(DAY).mood(8).mental(8).stress(2)).build());
        assertThat(fired).singleElement().satisfies(s ->
                assertThat(s.summary()).contains("Rossz közérzetű napokon").doesNotContain("sóvárgás"));
    }

    @Test
    void comfortEating_lowMentalNoLongerCounts_whenMoodIsAnswered() {
        assertThat(new ComfortEatingDetector().detect(comfortFixture(
                day(DAY).mood(8).mental(3).stress(2), day(DAY).mood(8).mental(8).stress(2)).build())).isEmpty();
    }

    /** 20 paired, good-mood days; {@code cravingDays} craving-8 days (incl. DAY) at a 60% NOVA-4 share,
     *  6 craving-3 days at 20%, the rest unanswered at 20%. */
    private static Trend cravingComfortFixture(int cravingDays) {
        List<DetectorInput.MealDayPoint> meals = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean craving = i < cravingDays;
            boolean calmAnswer = !craving && i < cravingDays + 6;
            meals.add(mealDay(d, "2900", "200", craving ? "0.60" : "0.20", List.of()));
            Day c = day(d).mood(8).stress(2);
            if (craving) {
                c.craving(8);
            } else if (calmAnswer) {
                c.craving(3);
            }
            checkins.add(c.build());
        }
        return new Trend().meals(meals).checkins(checkins);
    }

    @Test
    void comfortEating_cravingArmFires_whenCravingDaysRunMoreProcessed() {
        List<DetectorSignal> fired = new ComfortEatingDetector().detect(cravingComfortFixture(5).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("erős sóvárgást jeleztél").contains("60%-át")
                    .contains("20%-át").contains("(5 és 6 nap)").doesNotContain("Rossz közérzetű");
            assertThat(s.expertKey()).isEqualTo("taplalkozo");
        });
    }

    @Test
    void comfortEating_cravingArmSilent_belowFiveCravingDays() {
        assertThat(new ComfortEatingDetector().detect(cravingComfortFixture(4).build())).isEmpty();
    }

    // ── changed: self-calibration ───────────────────────────────────────────────

    /** rested = quality per day offset (index 0 = DAY). */
    private static Trend restedFixture(double[] valuesByOffset) {
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        List<DetectorInput.SleepPoint> sleep = new ArrayList<>();
        for (int i = 0; i < valuesByOffset.length; i++) {
            LocalDate d = DAY.minusDays(i);
            checkins.add(day(d).rested(valuesByOffset[i]).build());
            sleep.add(sleep(d, null, (int) valuesByOffset[i]));
        }
        return new Trend().checkins(checkins).sleep(sleep);
    }

    @Test
    void selfCalibration_restedArmFires_onceItHoldsTwoDays() {
        // 11 distinct values: as of DAY-2 9 pairs → 4|4 around the median → null (below the Whoop
        // guard); DAY-1 10 pairs → 5|5; DAY 11 pairs → 5|5. Same direction on both → fires.
        double[] v = {10, 6, 1, 2, 3, 4, 5, 7, 8, 9, 5.5};
        List<DetectorSignal> fired = new SelfCalibrationDetector().detect(restedFixture(v).build());
        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("self-calibration");
            assertThat(s.summary()).contains("a reggeli kipihentség-érzés együtt mozog az éjszaka rögzített alvásminőségével");
        });
    }

    @Test
    void selfCalibration_restedArmSilent_belowFiveDaysPerSide() {
        // 9 distinct values: at most a 4|4 split around the median on any day → never 5 per side
        double[] v = {10, 6, 1, 2, 3, 4, 5, 7, 8};
        assertThat(new SelfCalibrationDetector().detect(restedFixture(v).build())).isEmpty();
    }
}
