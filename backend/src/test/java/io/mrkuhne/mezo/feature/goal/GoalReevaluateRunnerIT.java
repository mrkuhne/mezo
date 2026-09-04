package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the startup re-evaluate runner (mezo-eujg) recomputes a live owner goal's prescription.
 *
 * <p>The runner is {@code @Profile("demofixtures")} (S2), so the bean only exists with both profiles
 * — hence {@code @ActiveProfiles({"demodata", "demofixtures"})}. Under demodata the OWNER is master data (seeded by
 * {@code OwnerSeedData}, preserved by {@code ResetDatabase}), so we do NOT re-create it; we resolve its
 * id via {@link AppUserRepository#findByEmail}. The goal's prescription is nulled after
 * {@code createGoal} so a non-null result proves the RUNNER (not the populator) recomputed it.
 */
@Transactional
@ActiveProfiles({"demodata", "demofixtures"})
class GoalReevaluateRunnerIT extends AbstractIntegrationTest {

    @Autowired private GoalReevaluateRunner runner;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private EntityManager entityManager;

    @Test
    void testRun_shouldPopulatePrescription_whenActiveGoalHasNone() {
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));
        GoalEntity g = goalPopulator.createGoal(owner, "cut", "active");
        // createGoal may leave a prescription; null it so a non-null result proves the runner recomputed.
        g.setPrescription(null);
        goalRepository.saveAndFlush(g);

        runner.run(); // no-arg overload

        entityManager.flush();
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).isNotNull();
        assertThat(reloaded.getPrescription().segments()).isNotEmpty();
    }
}
