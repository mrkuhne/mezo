package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * A mezo-1f7b backfill: a mezo-m6uv migráció idején a katalógusban 147-ből 2 sorban volt telített
 * zsír, ezért a logolt étkezések {@code snapshot_saturated_fat_g}-je szinte mindenhol NULL maradt.
 * A seed most feltölti a katalógust — ez a runner viszi be a MÁR logolt sorokba, különben a
 * Zsírminőség a régi étkezéseken örökre „nincs adat" maradna (a pontszám a pillanatképet olvassa,
 * nem a katalógust).
 *
 * <p>A runner {@code @Profile("demodata")}, innen az {@code @ActiveProfiles}; a no-arg
 * {@code backfill()} overloadot hívjuk közvetlenül, a {@link MealRescoreRunnerIT} mintájára.
 */
@Transactional
@ActiveProfiles("demodata")
class MealSaturatedFatBackfillRunnerIT extends AbstractIntegrationTest {

    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private MealSaturatedFatBackfillRunner runner;
    @Autowired private EntityManager entityManager;

    private static final LocalDate DAY = LocalDate.of(2026, 6, 10);
    private static final java.time.Instant NOON = java.time.Instant.parse("2026-06-10T10:00:00Z");

    private UUID owner() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    /** The catalog fixture carries 2.8 g satFat per 100 g and the line's frozen basis is also 100 g. */
    @Test
    void backfill_shouldCopyTheCatalogSaturatedFat_intoAPantryLineThatHasNone() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "túró");
        MealEntity meal = mealPopulator.createPantryMeal(owner, item, DAY);
        assertThat(line(meal).getSnapshotSaturatedFatG()).isNull(); // the state the bug left behind

        int healed = runner.backfill();
        entityManager.clear();

        assertThat(healed).isGreaterThanOrEqualTo(1);
        assertThat(reload(meal).getSnapshotSaturatedFatG()).isEqualByComparingTo("2.800");
    }

    /**
     * The IS NULL guard is what makes this safe to ship as a startup runner: it must be idempotent
     * across restarts AND must never overwrite a value a real label already supplied.
     */
    @Test
    void backfill_shouldLeaveAnExistingSnapshotAlone_andBeIdempotent() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "sajt");
        MealEntity meal = mealPopulator.createPantryMeal(owner, item, DAY);
        // a value read off a real label (OFF/scrape/photo import), NOT the catalog's 2.8
        line(meal).setSnapshotSaturatedFatG(new BigDecimal("9.100"));
        mealRepository.saveAndFlush(meal);

        runner.backfill();
        runner.backfill(); // second boot: structurally a no-op on this row
        entityManager.clear();

        assertThat(reload(meal).getSnapshotSaturatedFatG()).isEqualByComparingTo("9.100");
    }

    /**
     * The defect this test exists for (mezo-mxmh): healing the snapshot is not healing the SCORE.
     * The stored envelope was computed from the old null, and only MealRescoreRunner can recompute
     * it — off a work list of "envelopes stamped below FORMULA_VERSION". On the live boot where the
     * catalog finally filled, that stamp was already current, so 37 snapshots healed and not one
     * score moved. Relying on some other change's version bump is coincidence, not a mechanism; the
     * backfill must invalidate what it invalidated.
     */
    @Test
    void backfill_shouldInvalidateTheEnvelopeStamp_soTheRescoreRunnerPicksTheMealUp() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "vaj");
        MealEntity meal = mealPopulator.createCurrentScoredMeal(owner, item, DAY, "friss", NOON);
        // precondition: stamped current, so the rescore runner would NOT look at it
        assertThat(mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION))
            .extracting(MealEntity::getId).doesNotContain(meal.getId());

        runner.backfill();
        entityManager.clear();

        assertThat(mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION))
            .extracting(MealEntity::getId).contains(meal.getId());
    }

    /** Nothing to heal → nothing to invalidate: a second boot must not re-score the world. */
    @Test
    void backfill_shouldNotInvalidateAnything_whenThereIsNothingToHeal() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "sajt2");
        MealEntity meal = mealPopulator.createCurrentScoredMeal(owner, item, DAY, "friss", NOON);
        runner.backfill();          // heals + invalidates
        entityManager.clear();
        mealPopulator.restampCurrent(meal.getId());   // as the rescore would leave it

        runner.backfill();          // second boot: nothing null any more
        entityManager.clear();

        assertThat(mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION))
            .extracting(MealEntity::getId).doesNotContain(meal.getId());
    }

    private MealItemEntity line(MealEntity meal) {
        return meal.getItems().getFirst();
    }

    private MealItemEntity reload(MealEntity meal) {
        return line(mealRepository.findById(meal.getId()).orElseThrow());
    }
}
