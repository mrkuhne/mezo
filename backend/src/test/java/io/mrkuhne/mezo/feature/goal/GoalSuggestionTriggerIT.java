package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionTriggerService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice-4 triggers: preset↔trajectory mismatch and deload-week entry propose; neutral inputs stay quiet. */
@Transactional
class GoalSuggestionTriggerIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionTriggerService triggerService;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCheck_shouldProposeCut_whenCutPrepMesoLinkedToBulkGoal() {
        UUID user = databasePopulator.populateUser("trig1@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        meso.setGoalPreset("cut-prep");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed");
        assertThat(open).isPresent();
        assertThat(open.get().getPayload().suggestedTrajectory()).isEqualTo("cut");
        assertThat(open.get().getPayload().snapshotTrajectory()).isEqualTo("bulk");
    }

    @Test
    void testCheck_shouldStayQuiet_whenPresetAgreesOrNeutral() {
        UUID user = databasePopulator.populateUser("trig2@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity agree = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        agree.setGoalPreset("cut-prep"); // agrees with cut
        MesocycleEntity neutral = trainPopulator.createMesocycle(user, "Strength", "planned");
        neutral.setGoalPreset("strength"); // not in the config map
        linkPopulator.createLink(user, goal.getId(), "mesocycle", agree.getId(), 1, agree.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        assertThat(suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed")).isEmpty();
    }

    @Test
    void testCheck_shouldProposeDeloadOverride_whenCurrentGoalWeekIsDeload() {
        UUID user = databasePopulator.populateUser("trig3@test.local");
        // Goal window starting 2 weeks ago so "today" falls in goal-week 3 — dates set directly on
        // the entity before flush (GoalPopulator.createGoal + explicit overrides, no dedicated
        // floating-date populator exists).
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        goal.setStartDate(java.time.LocalDate.now().minusWeeks(2));
        goal.setTargetDate(java.time.LocalDate.now().plusWeeks(6));
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp blokk", "active");
        // phaseCurve from the populator is [MEV, MAV, Deload] → weekInMeso 2 (goal-week 3) = Deload.
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.checkPhaseSuggestions(user, goal.getId());

        var open = suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed");
        assertThat(open).isPresent();
        assertThat(open.get().getPayload().balanceOverrideKcal()).isZero();
        assertThat(open.get().getPayload().fromWeek()).isEqualTo(3);
        assertThat(open.get().getPayload().toWeek()).isEqualTo(3);
    }

    @Test
    void testOnMesoLifecycle_shouldResolveActiveGoalAndPropose() {
        UUID user = databasePopulator.populateUser("trig4@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Pre-cut prep", "active");
        meso.setGoalPreset("cut-prep");
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, meso.getWeeks());

        triggerService.onMesoLifecycle(user);

        assertThat(suggestionRepository.findByGoalIdAndKindAndStatusAndDeletedFalse(
            goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "proposed")).isPresent();
    }
}
