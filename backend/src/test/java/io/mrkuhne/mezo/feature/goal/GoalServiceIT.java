package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalService goalService;
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

    @Test
    void testCreateGoal_shouldDefaultStatusToPlanned_whenCreated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalResponse res = goalService.createGoal(user, upsertReq());
        assertThat(res.getStatus()).isEqualTo(GoalResponse.StatusEnum.PLANNED);
        assertThat(res.getTrajectory()).isEqualTo(GoalResponse.TrajectoryEnum.CUT);
        assertThat(res.getGuards())
            .containsExactlyInAnyOrder(GoalResponse.GuardsEnum.STRENGTH, GoalResponse.GuardsEnum.MUSCLE);
        assertThat(res.getId()).isNotNull();
    }

    @Test
    void testGetGoal_shouldThrow404_whenForeignOwner() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreign = goalPopulator.createGoal(other, "cut", "planned");
        assertThatThrownBy(() -> goalService.getGoal(me, foreign.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    void testListGoals_shouldHoistActiveFirst_whenMixedStatuses() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        goalPopulator.createGoal(user, "cut", "planned");
        goalPopulator.createGoal(user, "bulk", "active");
        goalPopulator.createGoal(user, "maintain", "archived");
        List<GoalResponse> goals = goalService.listGoals(user);
        assertThat(goals).hasSize(3);
        assertThat(goals.get(0).getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testUpdateGoal_shouldNotTouchStatus_whenLifecycleOwned() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity active = goalPopulator.createGoal(user, "cut", "active");
        GoalResponse res =
            goalService.updateGoal(user, active.getId(), upsertReq().title("Updated"));
        assertThat(res.getTitle()).isEqualTo("Updated");
        assertThat(res.getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testDeleteGoal_shouldSoftDelete_whenOwned() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity g = goalPopulator.createGoal(user, "cut", "planned");
        goalService.deleteGoal(user, g.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(g.getId(), user)).isEmpty();
    }

    @Test
    void testActivateGoal_shouldArchivePreviousActive_whenAnotherIsActivated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        var first = goalPopulator.createGoal(user, "cut", "active");
        var second = goalPopulator.createGoal(user, "bulk", "planned");
        goalService.activateGoal(user, second.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(goalRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("archived");
        assertThat(goalRepository.findById(second.getId()).orElseThrow().getStatus()).isEqualTo("active");
    }

    private static GoalUpsertRequest upsertReq() {
        return GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(List.of("strength", "muscle"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27))
            .startWeightKg(new BigDecimal("84.20")).targetWeightKg(new BigDecimal("80.00"))
            .rateTargetPctPerWeek(new BigDecimal("0.70")).identityFrame("Erő megtartva.").build();
    }
}
