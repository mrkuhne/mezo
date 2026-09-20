package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The five nutrition series (mezo-85x5r): carbs/fat ride the fuel rollup; sugar/salt/fiber
 *  sum the frozen meal-item snapshots with null = unknown (a day whose items all lack the
 *  nutrient yields NO point — never zero). */
class MetricSeriesNutrientIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now().minusDays(2);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealItemRepository mealItemRepository;

    @Test
    void carbsAndFatRideTheFuelRollup() {
        UUID user = seedUserWithOneMeal(DAY, /*carbs*/ 180, /*fat*/ 40, null, null, null);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_CARBS_G, DAY, DAY))
                .containsEntry(DAY, 180.0);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_FAT_G, DAY, DAY))
                .containsEntry(DAY, 40.0);
    }

    @Test
    void nutrientRollupSumsSnapshotsAcrossItems() {
        UUID user = seedUserWithTwoItems(DAY, /*sugarPerItem*/ "12.5", /*saltPerItem*/ "1.2",
                /*fiberPerItem*/ "8.0");
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SUGAR_G, DAY, DAY))
                .containsEntry(DAY, 25.0);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY))
                .containsEntry(DAY, 2.4);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_FIBER_G, DAY, DAY))
                .containsEntry(DAY, 16.0);
    }

    @Test
    void allNullSnapshotsYieldNoPointNeverZero() {
        UUID user = seedUserWithOneMeal(DAY, 180, 40, /*sugar*/ null, /*salt*/ null, /*fiber*/ null);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY)).isEmpty();
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SUGAR_G, DAY, DAY)).isEmpty();
    }

    @Test
    void mixedNullAndValueCountsOnlyTheCarryingItems() {
        UUID user = seedUserWithTwoItemsOneNullSalt(DAY, /*saltOnItem2*/ "1.5");
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY))
                .containsEntry(DAY, 1.5);
    }

    // --- seed helpers, built on the real MealPopulator/PantryItemPopulator factories ---

    /** One pantry-arm meal item on {@code day}, amount pinned to its own snapshotPer (factor=1
     *  in {@code MealMapper.contribution}/{@code scaled}) so carbs/fat land unscaled, plus the
     *  three optional nutrient snapshots (nullable = unknown, per mezo-85x5r). */
    private UUID seedUserWithOneMeal(LocalDate day, int carbs, int fat, String sugar, String salt,
            String fiber) {
        UUID owner = userPopulator.createUser().getId();
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, uniqueName(), null);
        MealEntity meal = mealPopulator.createPantryMeal(owner, pantryItem, day);
        MealItemEntity item = meal.getItems().get(0);
        item.setAmount(item.getSnapshotPer());
        item.setSnapshotCarbsG(new BigDecimal(carbs));
        item.setSnapshotFatG(new BigDecimal(fat));
        item.setSnapshotSugarG(sugar == null ? null : new BigDecimal(sugar));
        item.setSnapshotSaltG(salt == null ? null : new BigDecimal(salt));
        item.setSnapshotFiberG(fiber == null ? null : new BigDecimal(fiber));
        mealItemRepository.saveAndFlush(item);
        return owner;
    }

    /** Two separate pantry-arm meals on {@code day}, each with one item carrying the SAME
     *  sugar/salt/fiber snapshot — the sum-across-items fixture. */
    private UUID seedUserWithTwoItems(LocalDate day, String sugarPerItem, String saltPerItem,
            String fiberPerItem) {
        UUID owner = userPopulator.createUser().getId();
        setNutrientSnapshot(seedItem(owner, day), sugarPerItem, saltPerItem, fiberPerItem);
        setNutrientSnapshot(seedItem(owner, day), sugarPerItem, saltPerItem, fiberPerItem);
        return owner;
    }

    /** Two separate pantry-arm meals on {@code day}: item 1 has no salt snapshot (null), item 2
     *  carries {@code saltOnItem2} — the mixed-null rollup fixture. */
    private UUID seedUserWithTwoItemsOneNullSalt(LocalDate day, String saltOnItem2) {
        UUID owner = userPopulator.createUser().getId();
        MealItemEntity item1 = seedItem(owner, day);
        item1.setSnapshotSaltG(null);
        mealItemRepository.saveAndFlush(item1);

        MealItemEntity item2 = seedItem(owner, day);
        item2.setSnapshotSaltG(new BigDecimal(saltOnItem2));
        mealItemRepository.saveAndFlush(item2);
        return owner;
    }

    private MealItemEntity seedItem(UUID owner, LocalDate day) {
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, uniqueName(), null);
        MealEntity meal = mealPopulator.createPantryMeal(owner, pantryItem, day);
        return meal.getItems().get(0);
    }

    private void setNutrientSnapshot(MealItemEntity item, String sugar, String salt, String fiber) {
        item.setSnapshotSugarG(new BigDecimal(sugar));
        item.setSnapshotSaltG(new BigDecimal(salt));
        item.setSnapshotFiberG(new BigDecimal(fiber));
        mealItemRepository.saveAndFlush(item);
    }

    private String uniqueName() {
        return "nutrient-fixture-" + UUID.randomUUID();
    }
}
