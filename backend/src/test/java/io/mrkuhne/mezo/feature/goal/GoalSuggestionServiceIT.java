package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

/** Slice-4 suggestion lifecycle: one open per kind, supersede on re-propose, dedup after a decision. */
@Transactional
class GoalSuggestionServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private GoalSuggestionPayloadJson payload(String suggested, String snapshot) {
        return new GoalSuggestionPayloadJson(
            "A cut-prep mezo deficitet javasol.", suggested, null, null, null, null, "Pre-cut prep", snapshot);
    }

    @Test
    void testPropose_shouldCreateProposed_whenNoOpenSuggestion() {
        UUID user = databasePopulator.populateUser("sug1@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");

        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(s).isNotNull();
        assertThat(s.getStatus()).isEqualTo("proposed");
        assertThat(s.getPayload().suggestedTrajectory()).isEqualTo("cut");
    }

    @Test
    void testPropose_shouldSupersedeOpenRow_whenNewerProposalArrives() {
        UUID user = databasePopulator.populateUser("sug2@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity second = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m2", payload("cut", "bulk"));

        assertThat(second).isNotNull();
        assertThat(suggestionRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
        assertThat(second.getStatus()).isEqualTo("proposed");
    }

    @Test
    void testPropose_shouldReturnNull_whenSameDedupKeyAlreadyDecided() {
        UUID user = databasePopulator.populateUser("sug3@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        suggestionService.dismiss(user, goal.getId(), s.getId());

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).as("dismissed dedup key must not re-propose").isNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getDecidedAt()).isNotNull();
    }

    @Test
    void testPropose_shouldBeIdempotent_whenOpenRowHasSameDedupKey() {
        UUID user = databasePopulator.populateUser("sug4@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity first = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        GoalSuggestionEntity again = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        assertThat(again).isNotNull();
        assertThat(again.getId()).as("same open input → same row, no supersede churn").isEqualTo(first.getId());
    }

    @Test
    void testAccept_shouldApplyTrajectoryAndReevaluate_whenSnapshotMatches() {
        UUID user = databasePopulator.populateUser("sug5@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));

        var response = suggestionService.accept(user, goal.getId(), s.getId());

        assertThat(response.getTrajectory().getValue()).isEqualTo("cut");
        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).as("accept re-evaluates").isNotNull();
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("accepted");
    }

    @Test
    void testAccept_shouldApplyDeloadOverride_whenPayloadCarriesBalanceOverride() {
        UUID user = databasePopulator.populateUser("sug6@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "deload:m1:w3",
            new GoalSuggestionPayloadJson("Deload hét — tartás.", null, 0, 3, 3, null, "Hyp blokk", "cut"));

        suggestionService.accept(user, goal.getId(), s.getId());

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getSegmentOverrides()).hasSize(1);
        assertThat(reloaded.getSegmentOverrides().get(0).balanceKcal()).isZero();
        assertThat(reloaded.getTrajectory()).as("no trajectory change on a deload accept").isEqualTo("cut");
    }

    @Test
    void testAccept_shouldSupersedeAnd409_whenGoalTrajectoryChangedSinceProposal() {
        UUID user = databasePopulator.populateUser("sug7@test.local");
        profilePopulator.create(user);
        GoalEntity goal = goalPopulator.createGoal(user, "bulk", "active");
        GoalSuggestionEntity s = suggestionService.propose(
            user, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, "preset:cut-prep:m1", payload("cut", "bulk"));
        goal.setTrajectory("maintain"); // the owner edited the goal underneath

        assertThatThrownBy(() -> suggestionService.accept(user, goal.getId(), s.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT);
        assertThat(suggestionRepository.findById(s.getId()).orElseThrow().getStatus()).isEqualTo("superseded");
    }
}
