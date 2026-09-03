package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * A mezo-jcpt.2 backfill: a pre-jcpt.1 envelope-ok súlyai nem renormalizáltak, ezért a
 * ScoreLedger kliensoldali Σ-ja széttart a fejléc-pontszámtól. A runner {@code @Profile("demodata")},
 * ezért kell az {@code @ActiveProfiles}; a no-arg {@code run()} overloadot hívjuk közvetlenül,
 * a {@code GoalReevaluateRunnerIT} mintájára.
 */
@Transactional
@ActiveProfiles("demodata")
class MealRescoreRunnerIT extends AbstractIntegrationTest {

    @Autowired private MealRepository mealRepository;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;

    private static final LocalDate DAY = LocalDate.of(2026, 6, 10);
    private static final Instant NOON = Instant.parse("2026-06-10T10:00:00Z");

    private UUID owner() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void findStaleEnvelopes_shouldReturnOnlyThePreStampGeneration() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirkemell");
        MealEntity stale = mealPopulator.createStaleScoredMeal(owner, item, DAY, "régi", NOON);
        MealEntity current = mealPopulator.createCurrentScoredMeal(owner, item, DAY, "friss", NOON);

        List<MealEntity> found = mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION);

        assertThat(found).extracting(MealEntity::getId).contains(stale.getId());
        assertThat(found).extracting(MealEntity::getId).doesNotContain(current.getId());
    }
}
