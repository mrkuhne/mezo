package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DayEvaluationResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.service.DayReviewLlm;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * HTTP contract for {@code GET /api/me/day/{date}/evaluation} (mezo-jcpt.4, task 8) — the day
 * page's 6-dimension read. Three honest states are pinned here: a scored past day, today's
 * {@code in_progress} (no overall score while the day is still gathering), and a future date.
 *
 * <p>The fake companion LLM echoes the prompt rather than answering JSON, so the prose layer
 * degrades exactly as it would on a malformed provider answer — which is the point: the endpoint
 * answers 200 with every dimension and an EMPTY narrative regardless. The prose is a bonus; the
 * deterministic evaluation is the contract.
 */
@ActiveProfiles("companion-fake")
class DayEvaluationApiIT extends ApiIntegrationTest {

    /** Far enough back that the day is closed and the rhythm window has room. */
    private static final LocalDate PAST_DAY = LocalDate.of(2026, 6, 15);

    @Autowired private ApplicationContext applicationContext;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private DayEvaluationResponse evaluation(LocalDate date) {
        return getForBody("/api/me/day/" + date + "/evaluation", ownerAuthHeaders(), HttpStatus.OK,
            DayEvaluationResponse.class);
    }

    @Test
    void testGetDayEvaluation_shouldScoreEveryDimension_whenTheDayIsClosedAndLogged() {
        UUID owner = ownerId();
        seedDenseDay(owner, PAST_DAY);

        DayEvaluationResponse response = evaluation(PAST_DAY);

        assertThat(response.getDate()).isEqualTo(PAST_DAY);
        assertThat(response.getState()).isEqualTo("scored");
        assertThat(response.getDimensions()).extracting("id")
            .containsExactly("nutrition", "quality", "training", "sleep", "logging", "rhythm");
        assertThat(response.getBase()).isNotNull().isBetween(0, 100);
        // no adjustment came back (the fake answers prose, not JSON) -> score IS base
        assertThat(response.getScore()).isEqualTo(response.getBase());
        assertThat(response.getNarrative()).isEmpty();
        assertThat(response.getDimensions()).allSatisfy(d ->
            assertThat(d.getStatus()).isIn("DONE", "IN_PROGRESS", "NO_DATA"));
        // the DONE dimensions' renormalized weights sum to 1.0 — the honesty rule, on the wire
        double doneWeights = response.getDimensions().stream()
            .filter(d -> "DONE".equals(d.getStatus()))
            .mapToDouble(d -> d.getWeight().doubleValue())
            .sum();
        assertThat(doneWeights).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void testGetDayEvaluation_shouldReportInProgressWithoutScore_whenTheDayIsToday() {
        DayEvaluationResponse response = evaluation(LocalDate.now());

        assertThat(response.getState()).isEqualTo("in_progress");
        assertThat(response.getScore()).isNull();
        assertThat(response.getBase()).isNull();
        assertThat(response.getDimensions()).hasSize(6);
        assertThat(response.getNarrative()).isEmpty();
    }

    @Test
    void testGetDayEvaluation_shouldReportFuture_whenTheDayHasNotHappened() {
        DayEvaluationResponse response = evaluation(LocalDate.now().plusDays(5));

        assertThat(response.getState()).isEqualTo("future");
        assertThat(response.getScore()).isNull();
        assertThat(response.getDimensions()).hasSize(6);
        assertThat(response.getContext()).isEmpty();
    }

    /** The switch-ON half of the pair {@code DayEvaluationSwitchOffApiIT} completes: with
     *  {@code mezo.feature.day-review.enabled} at its default {@code true} the adapter bean EXISTS.
     *  Together the two tests prove the switch actually gates something. */
    @Test
    void testDayReviewLlm_shouldHaveABean_whenDayReviewSwitchOn() {
        assertThat(applicationContext.getBeanNamesForType(DayReviewLlm.class)).hasSize(1);
    }

    @Test
    void testGetDayEvaluation_should401_whenUnauthenticated() {
        getForBody("/api/me/day/" + PAST_DAY + "/evaluation", null, HttpStatus.UNAUTHORIZED,
            String.class);
    }

    /** {@code MeWeekControllerIT.seedDenseDay} — sleep + an at-target meal + all four check-in
     *  slots + a workout, so several dimensions land DONE and the day gets a base. */
    private void seedDenseDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("8.0"), 10);
        seedMeal(owner, date);
        checkInPopulator.createCheckIn(owner, date, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "20:00", 10, 5, null);
        trainPopulator.createSportSession(owner, date);
    }

    /** A pantry-arm meal whose consumed kcal/protein land exactly on the day's targets. */
    private void seedMeal(UUID owner, LocalDate date) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item =
            pantryItemPopulator.createFood(owner, "day-eval-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
            .toInstant(ZoneOffset.UTC));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Day evaluation fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(BigDecimal.valueOf(targets.getKcal().doubleValue()));
        line.setSnapshotProteinG(BigDecimal.valueOf(targets.getP().doubleValue()));
        line.setSnapshotCarbsG(BigDecimal.TEN);
        line.setSnapshotFatG(BigDecimal.ONE);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }
}
