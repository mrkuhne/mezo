package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

/**
 * V3.4 katalógus-bővítés (mezo-6ha5): az új KÖZVETLEN metrikák extraktorai populator-adat felett —
 * nap-aggregálás (átlag vs csúcs-érzékeny max), ablak-határok, hiányzó nap = nincs adatpont.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesExpansionIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private HabitDayRepository habitDayRepository;
    @Autowired private RitualPopulator ritualPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private RunningPopulator runningPopulator;

    /** Egy befejezett workout-instance DAY-en két gyakorlattal + két feedbackkel. */
    private UUID seedFeedbackDay(UUID owner, int workloadA, int painA, int workloadB, int painB) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "V3.4 meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
                owner, meso.getId(), "H", "Pull Day", 0, "planned");
        ExerciseEntity exA = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        ExerciseEntity exB = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
                owner, template, DAY, "completed");
        trainPopulator.createFeedback(owner, instance.getId(), exA.getId(), 3, painA, workloadA);
        trainPopulator.createFeedback(owner, instance.getId(), exB.getId(), 3, painB, workloadB);
        return instance.getId();
    }

    @Test
    void testSeries_shouldAverageWorkload_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 1, 1, 3, 1);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_WORKLOAD, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isEqualTo(2.0);
    }

    @Test
    void testSeries_shouldTakeMaxJointPain_whenMultipleFeedbacksOnDay() {
        UUID owner = userPopulator.createUser().getId();
        seedFeedbackDay(owner, 2, 1, 2, 3);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.GYM_JOINT_PAIN, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(3.0); // a fájdalom csúcs-érzékeny
    }

    @Test
    void testSeries_shouldShiftPastMidnightBedtimePlus24_whenBedtimeAfterMidnight() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "23:15", "06:30", new BigDecimal("7.0"), 4, 0, null);
        sleepLogPopulator.createSleepLog(owner, DAY.minusDays(1), "0:30", "07:00", new BigDecimal("6.5"), 3, 1, null);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.BEDTIME_HOUR, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(23.25);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(24.5); // éjfél utáni óra +24
    }

    @Test
    void testSeries_shouldReturnPlainFractionalWakeup_whenWakeupLogged() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "22:00", "06:30", new BigDecimal("8.0"), 4, 0, null);

        assertThat(metricSeriesService.series(owner, MetricKey.WAKEUP_HOUR, DAY, DAY).get(DAY))
                .isEqualTo(6.5); // ébredésnél nincs +24 eltolás
    }

    @Test
    void testSeries_shouldTakeMaxAwakenings_whenMultipleRowsOnDay() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "22:00", "06:00", new BigDecimal("7.0"), 4, 1, null);
        sleepLogPopulator.createSleepLog(owner, DAY, "23:00", "06:30", new BigDecimal("6.0"), 3, 3, null);

        assertThat(metricSeriesService.series(owner, MetricKey.SLEEP_AWAKENINGS, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
    }

    @Test
    void testSeries_shouldSkipRow_whenBedtimeMalformed() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, "későn", "06:30", new BigDecimal("7.0"), 4, 0, null);

        assertThat(metricSeriesService.series(owner, MetricKey.BEDTIME_HOUR, DAY, DAY)).isEmpty();
    }

    @Test
    void testSeries_shouldReturnProteinOnMealDaysOnly_whenMealsLogged() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity food = pantryItemPopulator.createFoodWithNutrients(owner, "Csirkemell");
        mealPopulator.createPantryMeal(owner, food, DAY);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.DAILY_PROTEIN_G, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY);
        assertThat(series.get(DAY)).isGreaterThan(0);
    }

    @Test
    void testSeries_shouldAverageMealScores_whenScoredMealsExist() {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity food = pantryItemPopulator.createFoodWithNutrients(owner, "Zabkása");
        mealPopulator.createScoredMeal(owner, food, DAY, "Reggeli",
                DAY.atStartOfDay(ZoneOffset.UTC).toInstant());

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.MEAL_SCORE, DAY, DAY);

        assertThat(series.get(DAY)).isEqualTo(0.62); // score nélküli meal nem ad pontot
    }

    @Test
    void testSeries_shouldCarryLastDoseForward_whenDoseAdministeredEarlier() {
        UUID owner = userPopulator.createUser().getId();
        MedicationEntity med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), DAY.minusDays(2), new BigDecimal("6"));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.MEDICATION_DOSE_MG, DAY.minusDays(3), DAY);

        assertThat(series.get(DAY.minusDays(3))).isNull(); // dózis-horgony előtt nincs adat
        assertThat(series.get(DAY.minusDays(2))).isEqualTo(6.0);
        assertThat(series.get(DAY)).isEqualTo(6.0); // az aktuális dózis-szint továbbél
    }

    @Test
    void testSeries_shouldCountDoneHabits_whenDayHasHabitRows() {
        UUID owner = userPopulator.createUser().getId();
        habitPopulator.row(owner, DAY, "wake_on_time", "done");
        habitPopulator.row(owner, DAY, "protein_target", "done");
        habitPopulator.row(owner, DAY, "bed_on_time", "missed");
        habitPopulator.row(owner, DAY.minusDays(1), "wake_on_time", "missed");

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.HABITS_DONE, DAY.minusDays(7), DAY);

        assertThat(series.get(DAY)).isEqualTo(2.0);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(0.0); // van sor, nincs done → valódi 0
        assertThat(series).doesNotContainKey(DAY.minusDays(2)); // sor nélküli nap = nincs adat
    }

    @Test
    void testSeries_shouldEmitBinaryRitualSeries_fromFirstAdoptionDay() {
        UUID owner = userPopulator.createUser().getId();
        ritualPopulator.closedDay(owner, DAY.minusDays(2));
        ritualPopulator.closedDay(owner, DAY);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.RITUAL_CLOSED, DAY.minusDays(7), DAY);

        assertThat(series).containsOnlyKeys(DAY.minusDays(2), DAY.minusDays(1), DAY);
        assertThat(series.get(DAY.minusDays(1))).isEqualTo(0.0); // adopció utáni le-nem-zárt nap = 0
        assertThat(series.get(DAY)).isEqualTo(1.0);
    }

    @Test
    void testSeries_shouldSumXpAcrossSources_whenActivityHabitAndQuestAwardXp() {
        UUID owner = userPopulator.createUser().getId();
        activityPopulator.activity(owner, DAY, "Olvasás", "mindset", 15, "AI");
        HabitDayEntity habit = habitPopulator.row(owner, DAY, "wake_on_time", "done");
        habit.setXpAwarded(10);
        habitDayRepository.saveAndFlush(habit);
        questPopulator.quest(owner, DAY, "FUELBIO", "hydrate", "vitality", "LIFE",
                "water_ml", new BigDecimal("500"), 20, "completed");
        questPopulator.quest(owner, DAY, "BODY", "stretch", "vitality", "LIFE",
                "minutes", new BigDecimal("10"), 20, "offered"); // nem completed → nem számít

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.DAILY_XP, DAY, DAY);

        assertThat(series.get(DAY)).isEqualTo(45.0);
    }

    @Test
    void testSeries_shouldCountMentionsPerDay_whenMentionsLogged() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        Instant noon = DAY.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
        mentionPopulator.createMention(owner, anna.getId(), noon, "positive");
        mentionPopulator.createMention(owner, anna.getId(), noon.plusSeconds(3600), "neutral");

        assertThat(metricSeriesService.series(owner, MetricKey.SOCIAL_MENTIONS, DAY, DAY).get(DAY))
                .isEqualTo(2.0);
    }

    @Test
    void testSeries_shouldAverageHrRecovery_whenRunsLogged() {
        UUID owner = userPopulator.createUser().getId();
        RunningBlockEntity block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 1, "tue-sprint", DAY, 6, 8, 40, null, 30);
        runningPopulator.createRunLog(owner, block.getId(), 1, "thu-sprint", DAY, 6, 7, 60, null, 30);

        assertThat(metricSeriesService.series(owner, MetricKey.RUN_HR_RECOVERY_S, DAY, DAY).get(DAY))
                .isEqualTo(50.0);
    }

    @Test
    void testSeries_shouldAverageBodyAndMental_whenMultipleCheckInsPerDay() {
        UUID owner = userPopulator.createUser().getId();
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 3, 2, 2, 4, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 3, 2, 4, 2, null);

        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_BODY, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
        assertThat(metricSeriesService.series(owner, MetricKey.CHECKIN_MENTAL, DAY, DAY).get(DAY))
                .isEqualTo(3.0);
    }
}
