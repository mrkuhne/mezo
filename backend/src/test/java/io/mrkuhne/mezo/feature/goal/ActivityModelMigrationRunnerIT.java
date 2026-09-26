package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The mezo-32m82 one-shot rollout runner: re-estimates null-kcal sport/run sessions (Task 2's
 * {@code reestimateMissing}, uncovered until this IT) and re-evaluates every goal whose
 * {@code tdeeBootstrap.activityModel} predates {@link
 * io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel#VERSION}. Idempotent: a second
 * {@code run()} touches nothing already migrated.
 */
@Transactional
class ActivityModelMigrationRunnerIT extends AbstractIntegrationTest {

    @Autowired private ActivityModelMigrationRunner runner;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;

    @Test
    void testRun_shouldReestimateSessionsAndRecomputeStaleGoals() {
        UUID owner = databasePopulator.populateUser("activity-model-rollout@test.local");
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));

        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active");
        assertThat(goal.getTdeeBootstrap()).as("bootstrap null before evaluate").isNull();

        SportSessionEntity nullKcal = trainPopulator.createSportSession(owner, LocalDate.of(2026, 6, 2), 60);
        assertThat(nullKcal.getKcal()).isNull();

        SportSessionEntity typed = trainPopulator.createSportSession(owner, LocalDate.of(2026, 6, 3), 45);
        typed = trainPopulator.withKcal(typed, 350);

        runner.run();

        entityManager.flush();
        entityManager.clear();

        GoalEntity reloadedGoal = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloadedGoal.getTdeeBootstrap()).isNotNull();
        assertThat(reloadedGoal.getTdeeBootstrap().activityModel()).isEqualTo(2);
        assertThat(reloadedGoal.getPrescription()).as("prescription rewritten").isNotNull();
        assertThat(reloadedGoal.getPrescription().segments()).isNotEmpty();

        SportSessionEntity reloadedNullKcal = sportSessionRepository.findById(nullKcal.getId()).orElseThrow();
        assertThat(reloadedNullKcal.getKcal()).isNotNull();
        assertThat(reloadedNullKcal.getKcalIsEstimate()).isTrue();

        SportSessionEntity reloadedTyped = sportSessionRepository.findById(typed.getId()).orElseThrow();
        assertThat(reloadedTyped.getKcal()).isEqualTo(350);
        assertThat(reloadedTyped.getKcalIsEstimate()).isFalse();

        var computedAtAfterFirstRun = reloadedGoal.getTdeeBootstrap().computedAt();

        runner.run();

        entityManager.flush();
        entityManager.clear();
        GoalEntity reloadedAgain = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloadedAgain.getTdeeBootstrap().computedAt())
            .as("second run is a no-op — the goal is no longer stale")
            .isEqualTo(computedAtAfterFirstRun);
    }
}
