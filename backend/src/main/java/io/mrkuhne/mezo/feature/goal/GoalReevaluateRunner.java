package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Startup reconciliation (Fuel Layer C, mezo-eujg): after the NEAT/weekly-EAT migration the owner's
 * existing goal prescription is stale (old BMR×PAL numbers, no {@code dailyEnergyBalanceKcal}). This
 * runner re-evaluates every non-archived owner goal so the fresh prescription carries the new model.
 *
 * <p>Idempotent — {@link GoalEngineService#evaluate} overwrites the {@code prescription} +
 * {@code tdeeBootstrap} jsonb columns each run, so repeated startups (or the graceful no-profile path)
 * are safe. {@code @Profile("demodata")} — the prod-active profile — so the bean only exists in a
 * demodata context; integration tests annotate {@code @ActiveProfiles("demodata")} and call the no-arg
 * {@link #run()} overload. {@code @Order(200)} runs after the seed runners (owner 0, train 100/110,
 * goal fixtures 120) so the owner + any seeded goals exist by the time this reconciles them.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(200)
@RequiredArgsConstructor
public class GoalReevaluateRunner implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    /** CommandLineRunner entry point (startup). */
    @Override
    public void run(String... args) {
        run();
    }

    /** No-arg overload — the integration-test entry point (re-runs against a reset DB). */
    @Transactional
    public void run() {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return;
        }
        UUID ownerId = owner.getId();
        List<GoalEntity> goals = goalRepository.findByCreatedByAndStatusNotAndDeletedFalse(ownerId, "archived");
        for (GoalEntity goal : goals) {
            goalEngineService.evaluate(ownerId, goal.getId());
        }
        if (!goals.isEmpty()) {
            log.info("Re-evaluated {} non-archived owner goal(s) to reconcile stale prescriptions.",
                goals.size());
        }
    }
}
