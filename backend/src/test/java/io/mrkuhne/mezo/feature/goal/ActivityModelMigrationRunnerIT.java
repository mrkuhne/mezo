package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
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
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private SportSessionRepository sportSessionRepository;
    @Autowired private RunSessionLogRepository runSessionLogRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;

    /** The prototype-default profile (M, born 1991-03-01, 15% body fat) — mirrors
     *  {@code SportServiceIT#seedBody}/{@code bmrFor} (Katch-McArdle, matching {@code TdeeBootstrapService#bmr}). */
    private static BigDecimal bmrFor(String weightKg) {
        BigDecimal leanFraction = BigDecimal.ONE.subtract(
            new BigDecimal("15.0").divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return new BigDecimal("370")
            .add(new BigDecimal("21.6").multiply(new BigDecimal(weightKg).multiply(leanFraction)));
    }

    /** {@code ActivityEnergyModel#netKcal} — {@code (met − 1) × bmr/24 × minutes/60}, HALF_UP. */
    private static int netKcal(BigDecimal bmrKcal, double met, int minutes) {
        BigDecimal rest = bmrKcal.divide(BigDecimal.valueOf(24), MathContext.DECIMAL64);
        BigDecimal kcal = BigDecimal.valueOf(met - 1).multiply(rest)
            .multiply(BigDecimal.valueOf(minutes)).divide(BigDecimal.valueOf(60), MathContext.DECIMAL64);
        return kcal.setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

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

        RunningBlockEntity block = runningPopulator.createBlock(owner, "Alapozás blokk", "active");
        RunSessionLogEntity nullKcalRun = runningPopulator.createRunLog(
            owner, block.getId(), 3, "tue-sprint", LocalDate.of(2026, 6, 4), null, null, null, null, 40);
        assertThat(nullKcalRun.getKcal()).isNull();

        RunSessionLogEntity typedRun = runningPopulator.createRunLog(
            owner, block.getId(), 3, "thu-easy", LocalDate.of(2026, 6, 5), null, null, null, null, 30);
        typedRun.setKcal(280);
        typedRun.setKcalIsEstimate(false);
        typedRun = runSessionLogRepository.saveAndFlush(typedRun);

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

        // rpeActual null -> moderate band -> run MET 9.3; net = (9.3 − 1) × bmr/24 × 40/60.
        int expectedRunKcal = netKcal(bmrFor("84.00"), 9.3, 40);
        RunSessionLogEntity reloadedNullKcalRun = runSessionLogRepository.findById(nullKcalRun.getId()).orElseThrow();
        assertThat(reloadedNullKcalRun.getKcal()).isEqualTo(expectedRunKcal);
        assertThat(reloadedNullKcalRun.getKcalIsEstimate()).isTrue();

        RunSessionLogEntity reloadedTypedRun = runSessionLogRepository.findById(typedRun.getId()).orElseThrow();
        assertThat(reloadedTypedRun.getKcal()).isEqualTo(280);
        assertThat(reloadedTypedRun.getKcalIsEstimate()).isFalse();

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
