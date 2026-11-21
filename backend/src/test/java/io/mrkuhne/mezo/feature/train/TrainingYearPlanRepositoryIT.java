package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearPlanRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.TrainingYearPlanPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

class TrainingYearPlanRepositoryIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 16);

    @Autowired TrainingYearPlanRepository plans;
    @Autowired TrainingYearBlockRepository blocks;
    @Autowired TrainingYearPlanPopulator populator;
    @Autowired OwnerProperties ownerProperties;
    @Autowired TransactionTemplate tx;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired TrainPopulator trainPopulator;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testSave_shouldRoundTripFocusArray_whenTwoGroups() {
        UUID owner = owner();
        var plan = populator.plan(owner, MONDAY, "back+biceps", "consolidation");

        var loaded = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());

        assertThat(loaded).hasSize(2);
        assertThat(loaded.get(0).getFocus()).containsExactly("back", "biceps");
        assertThat(loaded.get(0).getKind()).isEqualTo("upper");
        assertThat(loaded.get(1).getFocus()).isEmpty();
        assertThat(plans.findByCreatedByAndStatusAndDeletedFalse(owner, "active")).isPresent();
    }

    @Test
    void testSave_shouldFail_whenSecondActivePlan() {
        UUID owner = owner();
        populator.plan(owner, MONDAY, "back+biceps");

        assertThatThrownBy(() -> populator.plan(owner, MONDAY.plusWeeks(1), "chest+triceps"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSave_shouldFail_whenStartIsNotMonday() {
        UUID owner = owner();

        assertThatThrownBy(() -> populator.plan(owner, MONDAY.plusDays(1), "back+biceps"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSwapOrdinals_shouldSucceed_inOneTransaction() {
        UUID owner = owner();
        var plan = populator.plan(owner, MONDAY, "back+biceps", "chest+triceps");

        tx.executeWithoutResult(s -> {
            List<TrainingYearBlockEntity> list = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
            list.get(0).setOrdinal(2);
            list.get(1).setOrdinal(1);
            blocks.saveAll(list);
        });

        var after = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        assertThat(after.get(0).getFocus()).containsExactly("chest", "triceps");
        assertThat(after.get(1).getFocus()).containsExactly("back", "biceps");
    }

    @Test
    void testSave_shouldFail_whenSecondBlockLinksTheSameMesocycle() {
        UUID owner = owner();
        var plan = populator.plan(owner, MONDAY, "back+biceps", "chest+triceps");
        UUID meso = trainPopulator.createMesocycle(owner, "Közös blokk", "active").getId();
        List<TrainingYearBlockEntity> list = blocks.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        list.get(0).setMesocycleId(meso);
        blocks.saveAndFlush(list.get(0));

        list.get(1).setMesocycleId(meso);
        assertThatThrownBy(() -> blocks.saveAndFlush(list.get(1)))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
