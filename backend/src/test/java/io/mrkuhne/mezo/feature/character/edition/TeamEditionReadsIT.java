package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionReads;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.feature.character.service.edition.EditionMeal;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for {@link TeamEditionReads} (Task 4, csapatfal H1): every method is a straight repository
 * pass-through, so the IT only has to prove the wiring is correct — a real DB round trip per
 * source, and that {@code resolvedPredictions} really filters {@code pending} out. It must NOT
 * call an LLM: every read here is a plain SELECT (verified by reading {@code PatternMonitorService}
 * and the repository methods before wiring them — none of them write), so there is nothing to
 * fake-count; the assertion below confirms no new {@code prediction} row appears as a side effect
 * of calling {@code resolvedPredictions}.
 */
@ActiveProfiles("companion-fake")
class TeamEditionReadsIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    @Autowired private TeamEditionReads reads;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private PredictionRepository predictionRepository;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private MealPopulator mealPopulator;

    private UUID owner;

    @BeforeEach
    void owner() {
        owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void patterns_returnsSeededProposedPattern() {
        PatternEntity seeded = patternPopulator.statistical(owner, "pair-" + UUID.randomUUID(),
                PatternEntity.STATUS_PROPOSED);

        List<PatternEntity> out = reads.patterns(owner);

        assertThat(out).extracting(PatternEntity::getId).contains(seeded.getId());
    }

    @Test
    void monitor_returnsResponse_withoutWriting() {
        long patternsBefore = reads.patterns(owner).size();

        var response = reads.monitor(owner);

        assertThat(response).isNotNull();
        assertThat(response.getPairs()).isNotNull();
        assertThat(reads.patterns(owner)).hasSize((int) patternsBefore); // no row appeared/changed
    }

    @Test
    void resolvedPredictions_excludesPending_andCreatesNoNewRow() {
        long before = predictionRepository.count();
        predictionPopulator.prediction(owner, DAY.minusDays(10), "sleep_avg", "up",
                PredictionEntity.STATUS_VALIDATED); // validTo = DAY-4, in window
        predictionPopulator.prediction(owner, DAY.minusDays(10), "sleep_avg", "up",
                PredictionEntity.STATUS_PENDING);   // same window, but pending: excluded
        long afterSeeding = predictionRepository.count();

        List<PredictionEntity> out = reads.resolvedPredictions(owner, DAY.minusDays(7), DAY);

        assertThat(out).extracting(PredictionEntity::getStatus)
                .containsOnly(PredictionEntity.STATUS_VALIDATED);
        assertThat(predictionRepository.count()).isEqualTo(afterSeeding); // no LLM-triggered row appeared
        assertThat(afterSeeding).isEqualTo(before + 2);
    }

    @Test
    void activeExperiments_returnsOnlyActiveStatus() {
        ExperimentEntity active = experimentPopulator.experiment(owner, ExperimentEntity.STATUS_ACTIVE,
                "sleep_avg", "up");
        experimentPopulator.experiment(owner, ExperimentEntity.STATUS_COMPLETED, "sleep_avg", "up");

        List<ExperimentEntity> out = reads.activeExperiments(owner);

        assertThat(out).extracting(ExperimentEntity::getId).containsExactly(active.getId());
    }

    @Test
    void dailyConference_freshOwner_isEmpty() {
        assertThat(reads.dailyConference(owner, DAY)).isEmpty();
    }
    // ---- H5 (mezo-a9bo7.16) ------------------------------------------------------------------

    @Test
    void meals_sumsItemKcal_perMealOfTheDay_only() {
        Instant at = Instant.parse("2026-09-24T10:00:00Z");
        mealPopulator.createMealWithItems(owner, DAY, "lunch", at, List.of(
                new MealPopulator.Line("h5-csirke", "300", "30", "0", "10", (short) 1),
                new MealPopulator.Line("h5-rizs", "200", "4", "44", "1", (short) 1)));
        mealPopulator.createMealWithItems(owner, DAY.minusDays(1), "lunch", List.of(
                new MealPopulator.Line("h5-tegnap", "999", "1", "1", "1", (short) 1)));

        List<EditionMeal> out = reads.meals(owner, DAY);

        assertThat(out).singleElement().satisfies(m -> {
            assertThat(m.loggedAt()).isEqualTo(at);
            assertThat(m.kcal()).isEqualByComparingTo(new BigDecimal("500"));
        });
    }

    @Test
    void targets_resolveForTheDay() {
        assertThat(reads.targets(owner, DAY).kcal()).isPositive(); // config fallback without a goal
    }

}
