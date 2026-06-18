package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateGoal_shouldRoundTripTrajectoryAndGuards_whenPersisted() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity saved = goalPopulator.createGoal(user, "cut", "planned");
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getTrajectory()).isEqualTo("cut");
        assertThat(reloaded.getGuards()).containsExactlyInAnyOrder("strength", "muscle");
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateGoal_shouldRejectRow_whenTrajectoryNotInCheck() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        assertThatThrownBy(() -> goalPopulator.createGoal(user, "recomp", "planned"))
            .hasMessageContaining("ck_goal_trajectory");
    }

    @Test
    void testFindByOwner_shouldExcludeOtherOwners_whenQueried() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        goalPopulator.createGoal(me, "cut", "active");
        goalPopulator.createGoal(other, "bulk", "active");
        List<GoalEntity> mine = goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(me);
        assertThat(mine).hasSize(1).allMatch(g -> g.getCreatedBy().equals(me));
    }
}
