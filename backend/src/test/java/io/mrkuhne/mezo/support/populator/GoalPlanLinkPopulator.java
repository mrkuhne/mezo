package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the GoalPlanLink aggregate — see
 * docs/references/integration_test_framework.md (one populator per aggregate). Persists via
 * repository {@code saveAndFlush} so DB CHECKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class GoalPlanLinkPopulator {

    private final GoalPlanLinkRepository repository;

    /** Full-control factory: persists a link for {@code owner} and flushes so DB CHECKs fire. */
    public GoalPlanLinkEntity createLink(
        UUID owner, UUID goalId, String planType, UUID planId, int startWeek, int endWeek) {
        GoalPlanLinkEntity e = new GoalPlanLinkEntity();
        e.setCreatedBy(owner);
        e.setGoalId(goalId);
        e.setPlanType(planType);
        e.setPlanId(planId);
        e.setStartWeek(startWeek);
        e.setEndWeek(endWeek);
        return repository.saveAndFlush(e);
    }
}
