package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.character.repository.TeamChatThreadRepository;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/**
 * Schema IT for {@code team_chat_thread} / {@code team_chat_line} and the
 * {@code message_feedback.artifact_kind += team_chat_line} extension (mezo-a9bo7.21, Csapatfal
 * Act III Task 3): one open ügy per {@code (user, flag_key)}, a resolved ügy coexisting with a
 * fresh open one, at most one RESOLVE line per thread, and a feedback row on a chat line.
 */
@ActiveProfiles("companion-fake")
class TeamChatRepositoryIT extends AbstractIntegrationTest {

    private static final String FLAG_KEY = "sleep_debt";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TeamChatThreadRepository threadRepository;
    @Autowired private TeamChatLineRepository lineRepository;
    @Autowired private MessageFeedbackRepository feedbackRepository;
    @Autowired private FeedbackPopulator feedbackPopulator;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private TeamChatThreadEntity newThread(UUID owner, String flagKey, String status, Instant openedAt) {
        TeamChatThreadEntity thread = new TeamChatThreadEntity();
        thread.setCreatedBy(owner);
        thread.setFlagKey(flagKey);
        thread.setOwnerCharacter("szunya");
        thread.setStatus(status);
        thread.setOpenedAt(openedAt);
        if ("RESOLVED".equals(status)) {
            thread.setClosedAt(openedAt.plusSeconds(3600));
        }
        return thread;
    }

    private TeamChatLineEntity newLine(UUID owner, UUID threadId, String kind, String character, Instant at) {
        TeamChatLineEntity line = new TeamChatLineEntity();
        line.setCreatedBy(owner);
        line.setThreadId(threadId);
        line.setKind(kind);
        line.setCharacter(character);
        line.setBody("Szia, ez egy teszt üzenet.");
        line.setOccurredAt(at);
        return line;
    }

    @Test
    void savesOpenThread_andReadsItBackByFlagKey() {
        UUID owner = owner();
        TeamChatThreadEntity thread = threadRepository.saveAndFlush(newThread(owner, FLAG_KEY, "OPEN", Instant.now()));

        assertThat(thread.getId()).isNotNull();
        assertThat(threadRepository.findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(owner, FLAG_KEY, "OPEN"))
                .isPresent();
        assertThat(threadRepository.findByIdAndCreatedByAndDeletedFalse(thread.getId(), owner)).isPresent();
        assertThat(threadRepository.findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(owner, "OPEN"))
                .hasSize(1);
    }

    @Test
    void secondOpenThreadForSameFlagKey_rejectedByUniqueIndex() {
        UUID owner = owner();
        threadRepository.saveAndFlush(newThread(owner, FLAG_KEY, "OPEN", Instant.now()));

        TeamChatThreadEntity duplicate = newThread(owner, FLAG_KEY, "OPEN", Instant.now());
        assertThatThrownBy(() -> threadRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void resolvedThread_coexistsWithNewOpenThread_sameFlagKey() {
        UUID owner = owner();
        Instant openedAt = Instant.now().minusSeconds(7200);
        TeamChatThreadEntity resolved = newThread(owner, FLAG_KEY, "RESOLVED", openedAt);
        threadRepository.saveAndFlush(resolved);

        TeamChatThreadEntity fresh = newThread(owner, FLAG_KEY, "OPEN", Instant.now());
        TeamChatThreadEntity saved = threadRepository.saveAndFlush(fresh);

        assertThat(saved.getId()).isNotNull();
        assertThat(threadRepository.findByCreatedByAndOpenedAtBetweenAndDeletedFalse(
                owner, openedAt.minusSeconds(1), Instant.now().plusSeconds(1)))
                .hasSize(2);
    }

    @Test
    void secondResolveLineForOneThread_rejectedByUniqueIndex() {
        UUID owner = owner();
        TeamChatThreadEntity thread = threadRepository.saveAndFlush(newThread(owner, FLAG_KEY, "OPEN", Instant.now()));
        lineRepository.saveAndFlush(newLine(owner, thread.getId(), "OPEN", "szunya", Instant.now()));
        lineRepository.saveAndFlush(newLine(owner, thread.getId(), "RESOLVE", "szunya", Instant.now()));

        assertThat(lineRepository.existsByThreadIdAndKind(thread.getId(), "RESOLVE")).isTrue();

        TeamChatLineEntity secondResolve = newLine(owner, thread.getId(), "RESOLVE", "mocor", Instant.now());
        assertThatThrownBy(() -> lineRepository.saveAndFlush(secondResolve))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void readsLinesBackByOccurredAtWindow_andCountsCharacterLines() {
        UUID owner = owner();
        TeamChatThreadEntity thread = threadRepository.saveAndFlush(newThread(owner, FLAG_KEY, "OPEN", Instant.now()));
        Instant now = Instant.now();
        lineRepository.saveAndFlush(newLine(owner, thread.getId(), "OPEN", "szunya", now));
        lineRepository.saveAndFlush(newLine(owner, thread.getId(), "USER", null, now.plusSeconds(60)));

        assertThat(lineRepository.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
                owner, now.minusSeconds(1), now.plusSeconds(120)))
                .hasSize(2);
        assertThat(lineRepository.countByCreatedByAndCharacterIsNotNullAndOccurredAtBetweenAndDeletedFalse(
                owner, now.minusSeconds(1), now.plusSeconds(120)))
                .isEqualTo(1);
    }

    @Test
    void teamChatLineFeedback_saves() {
        UUID owner = owner();
        TeamChatThreadEntity thread = threadRepository.saveAndFlush(newThread(owner, FLAG_KEY, "OPEN", Instant.now()));
        TeamChatLineEntity line =
                lineRepository.saveAndFlush(newLine(owner, thread.getId(), "OPEN", "szunya", Instant.now()));

        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, line.getId(),
                MessageFeedbackEntity.VERDICT_UP, null);

        assertThat(feedbackRepository.findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                owner, MessageFeedbackEntity.KIND_TEAM_CHAT_LINE, line.getId()))
                .isPresent();
    }
}
