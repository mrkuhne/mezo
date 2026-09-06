package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealCoachStore.LoadedMeal;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * {@link MealCoachStore#loadDay} against a real DB (mezo-jcpt.19 S2b): the day's per-meal totals
 * must come from the KANONIKUS item contribution ({@code factor = amount / snapshotPer}), not the
 * raw {@code snapshot*} columns. Package-private {@link MealCoachStore} pins this test to the same
 * package; the fixture is hand-built (no {@code MealPopulator} method sets {@code snapshotPer} and
 * {@code amount} independently) mirroring {@code MealCoachServiceIT.scriptedMeal}'s populator use.
 */
class MealCoachStoreIT extends AbstractIntegrationTest {

    @Autowired private MealCoachStore store;
    @Autowired private MealRepository mealRepository;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /**
     * mezo-jcpt.19 S2b: a nap addigi makrói a KANONIKUS tétel-hozzájárulásból jönnek
     * (factor = amount / snapshotPer), nem a nyers snapshot-összegből. Egy per-100 g kamra-soron
     * logolt 250 g korábban a 100 g-os értékkel számolt.
     */
    @Test
    void loadDay_scalesItemsByAmountOverSnapshotPer() {
        UUID owner = owner();
        LocalDate date = LocalDate.of(2026, 6, 24);
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Zabpehely",
            LocalDate.now().plusMonths(6));

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        Instant loggedAt = date.atTime(6, 15).toInstant(ZoneOffset.UTC);
        meal.setLoggedAt(loggedAt);
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Ebéd");

        MealItemEntity item = new MealItemEntity();
        item.setMeal(meal);
        item.setCreatedBy(owner);
        item.setLineOrder(0);
        item.setSource("pantry");
        item.setPantryItemId(pantryItem.getId());
        item.setAmount(new BigDecimal("250"));
        item.setUnit("g");
        item.setSnapshotName(pantryItem.getCatalog().getName());
        // per-100 g sor: 100 kcal / 10 g fehérje per 100 g, ebből 250 g logolva
        item.setSnapshotPer(new BigDecimal("100"));
        item.setSnapshotBasisUnit("g");
        item.setSnapshotKcal(new BigDecimal("100"));
        item.setSnapshotProteinG(new BigDecimal("10"));
        item.setSnapshotCarbsG(BigDecimal.ZERO);
        item.setSnapshotFatG(BigDecimal.ZERO);
        meal.getItems().add(item);
        mealRepository.saveAndFlush(meal);

        List<LoadedMeal> loaded = store.loadDay(owner, date);

        assertThat(loaded).hasSize(1);
        assertThat(loaded.get(0).kcal()).isEqualByComparingTo("250");
        assertThat(loaded.get(0).p()).isEqualByComparingTo("25");
    }
}
