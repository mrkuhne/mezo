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
import org.springframework.test.context.TestPropertySource;

/**
 * The day-review switch OFF state (configuration_conventions.md: both switch states tested;
 * the {@code SlotPlanEvaluateSwitchOffApiIT} shape). With
 * {@code mezo.feature.day-review.enabled=false} the {@code DayReviewLlmAdapter} bean does not
 * exist, so {@code DayReviewService}'s {@code ObjectProvider<DayReviewLlm>} is empty.
 *
 * <p><b>The contract this locks in (binding, constraints.md):</b> the LLM layer being off is NOT
 * an error. The endpoint still answers <b>200</b> with the full deterministic evaluation — all
 * six dimensions, a real {@code base}, the {@code scored} state — and an EMPTY narrative. No 503,
 * no 5xx, no half-answer. Prose is a bonus over numbers that are already complete.
 *
 * <p><b>Why the bean-absence assertion (review round 1, Important).</b> Every wire-level
 * assertion here is ALSO satisfiable with the switch ON: the {@code companion-fake} LLM echoes
 * the prompt instead of answering JSON, so the prose degrades either way and an
 * "empty narrative" assertion alone would pass in both states — the test would prove nothing
 * about the switch. {@link #testDayReviewLlm_shouldHaveNoBean_whenDayReviewSwitchOff} is the
 * discriminating half: with the switch on (or removed) the adapter bean exists and that
 * assertion fails. It was chosen over teaching {@code FakeCompanionLlm} a day-review sentinel
 * because it needs no change to shared test infrastructure and it pins the actual gating
 * mechanism ({@code @ConditionalOnProperty} on the adapter) rather than a downstream symptom.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.day-review.enabled=false")
class DayEvaluationSwitchOffApiIT extends ApiIntegrationTest {

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

    /** The discriminating assertion: the gated adapter bean is genuinely gone. */
    @Test
    void testDayReviewLlm_shouldHaveNoBean_whenDayReviewSwitchOff() {
        assertThat(applicationContext.getBeanNamesForType(DayReviewLlm.class)).isEmpty();
    }

    @Test
    void testGetDayEvaluation_shouldServeFullDeterministicAnswer_whenDayReviewSwitchOff() {
        UUID owner = ownerId();
        seedDenseDay(owner, PAST_DAY);

        DayEvaluationResponse response = getForBody(
            "/api/me/day/" + PAST_DAY + "/evaluation", ownerAuthHeaders(), HttpStatus.OK,
            DayEvaluationResponse.class);

        // The deterministic answer is COMPLETE without any prose — that is the whole contract.
        assertThat(response.getDate()).isEqualTo(PAST_DAY);
        assertThat(response.getState()).isEqualTo("scored");
        assertThat(response.getDimensions()).extracting("id")
            .containsExactly("nutrition", "quality", "training", "sleep", "logging", "rhythm");
        assertThat(response.getBase()).isNotNull().isBetween(0, 100);
        // asserted against a NON-NULL base, so this cannot collapse to null == null
        assertThat(response.getScore()).isEqualTo(response.getBase());

        // …and no prose at all came back.
        assertThat(response.getNarrative()).isEmpty();
        assertThat(response.getHighlights()).isEmpty();
        assertThat(response.getAdjustment()).isNull();
        assertThat(response.getDimensions()).allSatisfy(d -> assertThat(d.getNote()).isNull());
    }

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    /** {@code DayEvaluationApiIT.seedDenseDay} — sleep + an at-target meal + all four check-in
     *  slots + a workout, so several dimensions land DONE and the day gets a real base. */
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
            pantryItemPopulator.createFood(owner, "day-eval-off-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
            .toInstant(ZoneOffset.UTC));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Day evaluation switch-off fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getCatalog().getName());
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
