package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.support.TransactionTemplate;

/** The committed goal-suggestion row is the sole source of its feed notification. */
class GoalSuggestionNotificationIT extends AbstractIntegrationTest {

    @Autowired private GoalSuggestionService suggestionService;
    @Autowired private AppNotificationRepository notificationRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TransactionTemplate transactionTemplate;

    private UUID owner;
    private GoalEntity goal;

    @BeforeEach
    void setUp() {
        owner = userPopulator.createUser().getId();
        goal = goalPopulator.createGoal(owner, "cut", "active");
    }

    @Test
    void testPropose_shouldEmitOneGoalSuggestionNotification_whenNewRowCommits() {
        GoalSuggestionEntity suggestion = propose("phase:1", phasePayload());

        awaitCount(owner, 1);

        AppNotificationEntity notification = notifications(owner).get(0);
        assertThat(notification.getTitle()).isEqualTo("Új javaslat a célodhoz");
        assertThat(notification.getBody()).contains("Szakaszváltás");
        assertThat(notification.getDeeplink())
            .isEqualTo("/me/goals/weight/suggestions/" + suggestion.getId());
        assertThat(notification.getRefId()).isEqualTo(suggestion.getId());
        assertThat(notification.getDedupKey()).isEqualTo("goal_suggestion:" + suggestion.getId());
    }

    @Test
    void testPropose_shouldNotDuplicateNotification_whenSameOpenInputIsEvaluatedAgain() {
        propose("phase:same", phasePayload());
        awaitCount(owner, 1);

        propose("phase:same", phasePayload());

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> assertThat(notifications(owner)).hasSize(1));
    }

    @Test
    void testPropose_shouldEmitAnotherNotification_whenNewSuggestionSupersedesOpenRow() {
        GoalSuggestionEntity first = propose("phase:first", phasePayload());
        awaitCount(owner, 1);

        GoalSuggestionEntity second = propose("phase:second", phasePayload());
        awaitCount(owner, 2);

        assertThat(notifications(owner)).extracting(AppNotificationEntity::getRefId)
            .containsExactlyInAnyOrder(first.getId(), second.getId());
    }

    @Test
    void testPropose_shouldNotEmitNotification_whenOuterTransactionRollsBack() {
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            propose("phase:rollback", phasePayload());
            throw new RollbackProbe();
        })).isInstanceOf(RollbackProbe.class);

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> assertThat(notifications(owner)).isEmpty());
    }

    @Test
    void testPropose_shouldKeepAnotherUsersFeedEmpty_whenOwnerReceivesNotification() {
        UUID otherUser = userPopulator.createUser().getId();

        propose("phase:owner-only", phasePayload());
        awaitCount(owner, 1);

        assertThat(notifications(otherUser)).isEmpty();
    }

    private GoalSuggestionEntity propose(String dedupKey, GoalSuggestionPayloadJson payload) {
        return suggestionService.propose(
            owner, goal.getId(), GoalSuggestionService.KIND_PHASE_CHANGE, dedupKey, payload);
    }

    private GoalSuggestionPayloadJson phasePayload() {
        return new GoalSuggestionPayloadJson(
            "Deload hét — tartás.", null, 0, 3, 3, null, "Hyp blokk", "cut",
            null, null, null, null, null, null, null, null, null, null, null);
    }

    private List<AppNotificationEntity> notifications(UUID userId) {
        return notificationRepository
            .findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(userId, Pageable.unpaged())
            .stream().filter(n -> "goal_suggestion".equals(n.getKind())).toList();
    }

    private void awaitCount(UUID userId, int count) {
        await().atMost(Duration.ofSeconds(5))
            .untilAsserted(() -> assertThat(notifications(userId)).hasSize(count));
    }

    private static final class RollbackProbe extends RuntimeException {
    }
}
