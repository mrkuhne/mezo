package io.mrkuhne.mezo.feature.goal.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * expenditure_estimate DDL proof (mezo-zz91i, spec 2026-09-26-learned-expenditure-design §5.5):
 * one row per user per reviewed week, the "most recent prior week" and "most recent week overall"
 * lookups the weekly orchestrator and the serving resolver depend on, and the excludedDays jsonb
 * list round-trips.
 */
@Transactional
class ExpenditureEstimateRepositoryIT extends AbstractIntegrationTest {

    @Autowired private ExpenditureEstimateRepository expenditureEstimateRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testWeekLookups_shouldReturnThePriorAndTheMostRecentWeek_whenTwoWeeksAreSaved() {
        UUID user = databasePopulator.populateUser("expenditure-estimate-" + UUID.randomUUID() + "@test.local");

        ExpenditureEstimateEntity week1 = newEstimate(user, LocalDate.of(2026, 9, 14));
        week1.setExcludedDays(List.of(new ExcludedIntakeDayJson(LocalDate.of(2026, 9, 13), 604, "suspicious")));
        expenditureEstimateRepository.saveAndFlush(week1);

        ExpenditureEstimateEntity week2 = newEstimate(user, LocalDate.of(2026, 9, 21));
        expenditureEstimateRepository.saveAndFlush(week2);

        ExpenditureEstimateEntity priorToWeek2 = expenditureEstimateRepository
            .findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(user, LocalDate.of(2026, 9, 21))
            .orElseThrow();
        assertThat(priorToWeek2.getWeekStart()).isEqualTo(LocalDate.of(2026, 9, 14));
        assertThat(priorToWeek2.getExcludedDays()).containsExactly(
            new ExcludedIntakeDayJson(LocalDate.of(2026, 9, 13), 604, "suspicious"));

        ExpenditureEstimateEntity mostRecent = expenditureEstimateRepository
            .findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(user)
            .orElseThrow();
        assertThat(mostRecent.getWeekStart()).isEqualTo(LocalDate.of(2026, 9, 21));

        assertThat(expenditureEstimateRepository.existsByCreatedByAndDeletedFalse(user)).isTrue();
        assertThat(expenditureEstimateRepository
            .findByCreatedByAndWeekStartAndDeletedFalse(user, LocalDate.of(2026, 9, 14)))
            .isPresent();
    }

    @Test
    void testExistsByCreatedByAndDeletedFalse_shouldReturnFalse_whenTheUserHasNoRows() {
        assertThat(expenditureEstimateRepository.existsByCreatedByAndDeletedFalse(UUID.randomUUID())).isFalse();
    }

    private ExpenditureEstimateEntity newEstimate(UUID user, LocalDate weekStart) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setCreatedBy(user);
        e.setWeekStart(weekStart);
        e.setStatus("LEARNING");
        e.setFormulaBaseKcal(2200);
        e.setPosteriorBaseKcal(2150);
        e.setPosteriorSdKcal(120);
        e.setAppliedBaseKcal(2180);
        e.setStepKcal(20);
        e.setDirection(-1);
        e.setConfidence("LOW");
        e.setUsableDays(6);
        e.setWeighInDays(5);
        e.setExcludedDays(List.of());
        return e;
    }
}
