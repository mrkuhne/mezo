package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.ActivityEnergyModel;
import io.mrkuhne.mezo.feature.train.service.RunningService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Rollout of the net activity-energy model (mezo-32m82), ALL profiles incl. prod. Idempotent:
 * (1) estimates every sport/run row whose kcal is NULL (the Liquibase changeset nulled the old
 * gross estimates once; rows without a known body simply stay NULL); (2) re-evaluates every
 * non-archived goal whose tdee_bootstrap predates {@link ActivityEnergyModel#VERSION} — a fresh
 * evaluate writes the marker, so the next boot skips it. {@code @Order(210)}: after the seed runners
 * and {@link GoalReevaluateRunner} (200) where that one is active.
 */
@Slf4j
@Component
@Order(210)
@RequiredArgsConstructor
public class ActivityModelMigrationRunner implements CommandLineRunner {

    private final SportService sportService;
    private final RunningService runningService;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    @Override
    public void run(String... args) {
        run();
    }

    public void run() {
        int sport = sportService.reestimateMissing();
        int runs = runningService.reestimateMissing();
        List<GoalEntity> stale = goalRepository.findByStatusNotAndDeletedFalse("archived").stream()
            .filter(g -> g.getTdeeBootstrap() == null
                || g.getTdeeBootstrap().activityModel() == null
                || g.getTdeeBootstrap().activityModel() < ActivityEnergyModel.VERSION)
            .toList();
        stale.forEach(g -> {
            try {
                goalEngineService.evaluate(g.getCreatedBy(), g.getId());
            } catch (Exception e) {
                log.warn("Activity model rollout: skipped goal {} (owner {}) — {}",
                    g.getId(), g.getCreatedBy(), e.getMessage());
            }
        });
        if (sport + runs + stale.size() > 0) {
            log.info("Activity model v{}: estimated {} sport + {} run session(s), re-evaluated {} goal(s).",
                ActivityEnergyModel.VERSION, sport, runs, stale.size());
        }
    }
}
