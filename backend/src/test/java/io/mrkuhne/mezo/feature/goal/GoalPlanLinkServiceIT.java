package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalPlanLinkService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalPlanLinkServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalPlanLinkService service;
    @Autowired private GoalPlanLinkRepository linkRepository;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
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

    // ---- service: attach / detach / list / resolve --------------------------------------------

    @Test
    void testAttachPlan_shouldDeriveEndWeekFromMesoWeeks_whenMesocycleAttached() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "RP block", "active"); // weeks = 6

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(2);
        GoalPlanLinkResponse resp = service.attachPlan(user, goal.getId(), req);

        // end_week derived from the plan's own weeks — never trusted from the request.
        assertThat(resp.getEndWeek()).isEqualTo(2 + meso.getWeeks() - 1).isEqualTo(7);
        assertThat(resp.getStartWeek()).isEqualTo(2);
        assertThat(resp.getPlanType()).isEqualTo(GoalPlanLinkResponse.PlanTypeEnum.MESOCYCLE);
        assertThat(resp.getPlanId()).isEqualTo(meso.getId());
        assertThat(resp.getPlan().getTitle()).isEqualTo("RP block");
        assertThat(resp.getPlan().getWeeks()).isEqualTo(6);
        assertThat(resp.getPlan().getStatus().getValue()).isEqualTo("active");
        // persisted with server-side ownership + the derived end_week.
        GoalPlanLinkEntity persisted = linkRepository.findById(resp.getId()).orElseThrow();
        assertThat(persisted.getCreatedBy()).isEqualTo(user);
        assertThat(persisted.getEndWeek()).isEqualTo(7);
    }

    @Test
    void testAttachPlan_shouldResolveBlockRef_whenRunningBlockAttached() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        RunningBlockEntity block = runningPopulator.createBlock(user, "8w base", "planned"); // weeks = 8

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("running_block").planId(block.getId()).startWeek(1);
        GoalPlanLinkResponse resp = service.attachPlan(user, goal.getId(), req);

        assertThat(resp.getPlanType()).isEqualTo(GoalPlanLinkResponse.PlanTypeEnum.RUNNING_BLOCK);
        assertThat(resp.getEndWeek()).isEqualTo(8); // 1 + 8 - 1
        assertThat(resp.getPlan().getTitle()).isEqualTo("8w base");
        assertThat(resp.getPlan().getWeeks()).isEqualTo(8);
        assertThat(resp.getPlan().getStatus().getValue()).isEqualTo("planned");
    }

    @Test
    void testAttachPlan_shouldRejectWithNotFound_whenPlanForeign() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity myGoal = goalPopulator.createGoal(me, "cut", "active");
        MesocycleEntity foreignMeso = trainPopulator.createMesocycle(other, "theirs", "active");

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(foreignMeso.getId()).startWeek(1);
        assertThatThrownBy(() -> service.attachPlan(me, myGoal.getId(), req))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    void testAttachPlan_shouldRejectWithNotFound_whenPlanUnknown() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("running_block").planId(UUID.randomUUID()).startWeek(1);
        assertThatThrownBy(() -> service.attachPlan(user, goal.getId(), req))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    void testAttachPlan_shouldRejectWithNotFound_whenGoalForeign() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreignGoal = goalPopulator.createGoal(other, "cut", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(me, "mine", "active");

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(1);
        assertThatThrownBy(() -> service.attachPlan(me, foreignGoal.getId(), req))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    void testDetachPlan_shouldSoftDeleteLink_whenOwnedByGoal() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalPlanLinkEntity link =
            linkPopulator.createLink(user, goal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);

        service.detachPlan(user, goal.getId(), link.getId());
        entityManager.flush();
        entityManager.clear();

        assertThat(linkRepository.findByIdAndCreatedByAndDeletedFalse(link.getId(), user)).isEmpty();
    }

    @Test
    void testDetachPlan_shouldRejectWithNotFound_whenLinkBelongsToAnotherGoal() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalEntity otherGoal = goalPopulator.createGoal(user, "bulk", "planned");
        GoalPlanLinkEntity link =
            linkPopulator.createLink(user, otherGoal.getId(), "mesocycle", UUID.randomUUID(), 1, 4);

        assertThatThrownBy(() -> service.detachPlan(user, goal.getId(), link.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
        // link survives the rejected detach.
        assertThat(linkRepository.findByIdAndCreatedByAndDeletedFalse(link.getId(), user)).isPresent();
    }

    @Test
    void testListLinks_shouldReturnGoalLinksOrderedByStartWeek_whenQueried() {
        UUID user = databasePopulator.populateUser("link@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        linkPopulator.createLink(user, goal.getId(), "running_block", UUID.randomUUID(), 9, 12);
        linkPopulator.createLink(user, goal.getId(), "mesocycle", UUID.randomUUID(), 1, 6);

        List<GoalPlanLinkEntity> links = service.listLinks(user, goal.getId());

        assertThat(links).extracting(GoalPlanLinkEntity::getStartWeek).containsExactly(1, 9);
    }

    @Test
    void testListLinks_shouldRejectWithNotFound_whenGoalForeign() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreignGoal = goalPopulator.createGoal(other, "cut", "active");

        assertThatThrownBy(() -> service.listLinks(me, foreignGoal.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }
}
