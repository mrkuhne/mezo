package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/** message_feedback DDL + upsert-verdict round-trip (bd mezo-b3pp.15, spec §4.4). */
@Transactional
class MessageFeedbackPersistenceIT extends AbstractIntegrationTest {

    @Autowired
    private MessageFeedbackRepository repository;

    @Autowired
    private FeedbackPopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testSave_shouldPersistVerdict_whenUpWithoutReason() {
        UUID owner = userPopulator.createUser("mf-up@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        populator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);

        MessageFeedbackEntity found = repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId)
            .orElseThrow();

        assertThat(found.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_UP);
        assertThat(found.getReason()).isNull();
        assertThat(found.getUpdatedAt()).isNotNull();
        assertThat(found.getCreatedBy()).isEqualTo(owner);
        assertThat(found.isDeleted()).isFalse();
    }

    /** The seventh kind (mezo-jcpt.9): the CHECK-swap migration widened
     *  {@code ck_message_feedback_artifact_kind} to admit {@code day_review} — round-tripped here
     *  exactly like every other kind, proving the DB itself (not only bean validation) accepts it. */
    @Test
    void testSave_shouldPersistVerdict_whenKindIsDayReview() {
        UUID owner = userPopulator.createUser("mf-day-review@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        populator.createVerdict(owner, MessageFeedbackEntity.KIND_DAY_REVIEW, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);

        MessageFeedbackEntity found = repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_DAY_REVIEW, artifactId)
            .orElseThrow();

        assertThat(found.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_UP);
        assertThat(found.getArtifactKind()).isEqualTo(MessageFeedbackEntity.KIND_DAY_REVIEW);
    }

    @Test
    void testSave_shouldPersistReason_whenDownWithReason() {
        UUID owner = userPopulator.createUser("mf-down@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        populator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, artifactId,
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_TOO_MUCH);

        MessageFeedbackEntity found = repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, artifactId)
            .orElseThrow();

        assertThat(found.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_DOWN);
        assertThat(found.getReason()).isEqualTo(MessageFeedbackEntity.REASON_TOO_MUCH);
    }

    @Test
    void testSave_shouldViolateCheck_whenReasonSentWithUpVerdict() {
        UUID owner = userPopulator.createUser("mf-ck@test.local").getId();
        UUID artifactId = UUID.randomUUID();

        // No entity @Pattern spans verdict+reason together — the DB CHECK is the guard.
        assertThatThrownBy(() -> populator.createVerdict(owner, MessageFeedbackEntity.KIND_MEMOIR,
                artifactId, MessageFeedbackEntity.VERDICT_UP, MessageFeedbackEntity.REASON_INACCURATE))
            .isInstanceOf(DataIntegrityViolationException.class)
            .rootCause().hasMessageContaining("ck_message_feedback_reason");
    }

    @Test
    void testSave_shouldViolateUnique_whenSameArtifactVotedTwice() {
        UUID owner = userPopulator.createUser("mf-uq@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        populator.createVerdict(owner, MessageFeedbackEntity.KIND_WEEKLY_SUGGESTION, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);

        assertThatThrownBy(() -> populator.createVerdict(owner, MessageFeedbackEntity.KIND_WEEKLY_SUGGESTION,
                artifactId, MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_BAD_TIMING))
            .isInstanceOf(DataIntegrityViolationException.class)
            .rootCause().hasMessageContaining("uq_message_feedback_artifact");
    }

    @Test
    void testUpsertVerdict_shouldFlipVerdictAndClearReason_whenCalledOnExistingRow() {
        UUID owner = userPopulator.createUser("mf-flip@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        populator.createVerdict(owner, MessageFeedbackEntity.KIND_PREDICTION, artifactId,
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_BAD_TIMING);

        repository.upsertVerdict(owner, MessageFeedbackEntity.KIND_PREDICTION, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);

        MessageFeedbackEntity found = repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_PREDICTION, artifactId)
            .orElseThrow();
        assertThat(found.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_UP);
        assertThat(found.getReason()).isNull();
    }

    @Test
    void testUpsertVerdict_shouldResurrect_whenRowWasSoftDeleted() {
        UUID owner = userPopulator.createUser("mf-resurrect@test.local").getId();
        UUID artifactId = UUID.randomUUID();
        MessageFeedbackEntity created = populator.createVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE,
            artifactId, MessageFeedbackEntity.VERDICT_UP, null);
        repository.delete(created);
        repository.flush();

        repository.upsertVerdict(owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId,
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_NOT_ABOUT_ME);

        MessageFeedbackEntity found = repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_CHAT_MESSAGE, artifactId)
            .orElseThrow();
        assertThat(found.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_DOWN);
        assertThat(found.getReason()).isEqualTo(MessageFeedbackEntity.REASON_NOT_ABOUT_ME);
        assertThat(found.isDeleted()).isFalse();
    }
}
