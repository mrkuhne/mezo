package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalPlanLinkServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalPlanLinkRepository linkRepository;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateLink_shouldRoundTripFields_whenPersisted() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        UUID planId = UUID.randomUUID();
        GoalPlanLinkEntity saved = linkPopulator.createLink(user, goal.getId(), "mesocycle", planId, 1, 4);
        entityManager.clear();
        GoalPlanLinkEntity reloaded = linkRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getGoalId()).isEqualTo(goal.getId());
        assertThat(reloaded.getPlanType()).isEqualTo("mesocycle");
        assertThat(reloaded.getPlanId()).isEqualTo(planId);
        assertThat(reloaded.getStartWeek()).isEqualTo(1);
        assertThat(reloaded.getEndWeek()).isEqualTo(4);
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateLink_shouldRejectRow_whenPlanTypeNotInCheck() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        assertThatThrownBy(
                () -> linkPopulator.createLink(user, goal.getId(), "bogus", UUID.randomUUID(), 1, 4))
            .hasMessageContaining("ck_goal_plan_link_plan_type");
    }

    @Test
    void testFindByGoal_shouldOrderByStartWeekAndExcludeOtherGoals_whenQueried() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalEntity otherGoal = goalPopulator.createGoal(user, "bulk", "planned");
        linkPopulator.createLink(user, goal.getId(), "running_block", UUID.randomUUID(), 5, 8);
        linkPopulator.createLink(user, goal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);
        linkPopulator.createLink(user, otherGoal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);

        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), user);

        assertThat(links).hasSize(2);
        assertThat(links).allMatch(l -> l.getGoalId().equals(goal.getId()));
        assertThat(links).extracting(GoalPlanLinkEntity::getStartWeek).containsExactly(1, 5);
    }

    @Test
    void testFindByGoal_shouldExcludeOtherOwners_whenQueried() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity myGoal = goalPopulator.createGoal(me, "cut", "active");
        GoalEntity otherGoal = goalPopulator.createGoal(other, "cut", "active");
        linkPopulator.createLink(me, myGoal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);
        linkPopulator.createLink(other, otherGoal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);

        List<GoalPlanLinkEntity> mine =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(myGoal.getId(), me);

        assertThat(mine).hasSize(1).allMatch(l -> l.getCreatedBy().equals(me));
        assertThat(linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(
            otherGoal.getId(), me)).isEmpty();
    }

    @Test
    void testFindByIdAndOwner_shouldReturnEmpty_whenForeignOwner() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreignGoal = goalPopulator.createGoal(other, "cut", "active");
        GoalPlanLinkEntity foreign =
            linkPopulator.createLink(other, foreignGoal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);

        assertThat(linkRepository.findByIdAndCreatedByAndDeletedFalse(foreign.getId(), me)).isEmpty();
        assertThat(linkRepository.findByIdAndCreatedByAndDeletedFalse(foreign.getId(), other)).isPresent();
    }
}
