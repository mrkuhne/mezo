package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Reflexió S3 (mezo-eq85.3): the "never fails the turn" guarantee of the seeded-conversation reply
 * capture — the failure half of {@link ChatSeedReplyIT}, on BOTH entry points.
 *
 * <p>{@code ChatService.sendMessage} (sync) and {@code prepareTurn} (streamed) are themselves
 * transactional and swallow a recorder failure. That catch is only worth anything because
 * {@code ReflectionReplyRecorder.recordChatReply} runs {@code REQUIRES_NEW}: joining the turn's
 * transaction would mark it rollback-only, and the swallowed failure would come back as an
 * {@code UnexpectedRollbackException} at the outer commit — the user losing the whole turn over
 * reflection bookkeeping. Drop the propagation and both tests below go red.
 *
 * <p>The failure is injected at the repository, INSIDE the recorder's own transaction, on purpose:
 * mocking the recorder bean itself would replace the transactional proxy and make the test pass
 * with or without the boundary.
 *
 * <p>Own IT class — the {@code @MockitoSpyBean} forks the application context, so it stays out of
 * {@code ChatSeedReplyIT}'s cached one.
 */
@ActiveProfiles("companion-fake")
class ChatSeedReplyFailureIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private ConversationService conversationService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @MockitoSpyBean private PatternEventRepository patternEventRepository;

    @Test
    void testSendMessage_shouldStillCommitTheTurn_whenTheReplyCaptureFails() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity pattern = seedPattern(owner);
        ConversationResponse conversation = conversationService.create(owner,
                CreateConversationRequest.builder().seedPatternId(pattern.getId()).build());
        failTheReplyWrite();

        MessageResponse answer = chatService.sendMessage(owner, conversation.getId(),
                SendMessageRequest.builder().content("nem Anna miatt").build());

        assertThat(answer).isNotNull();
        assertThat(answer.getContent()).isNotBlank();
        // the turn committed: both rows survived the swallowed reply failure
        List<AiMessageEntity> messages = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
                        conversation.getId(), owner);
        assertThat(messages).extracting(AiMessageEntity::getRole)
                .containsExactly(AiMessageEntity.ROLE_USER, AiMessageEntity.ROLE_ASSISTANT);
        assertThat(messages.getFirst().getContent()).isEqualTo("nem Anna miatt");
        assertNoReplyEvent(owner, pattern);
    }

    @Test
    void testPrepareTurn_shouldStillCommitTheUserRow_whenTheReplyCaptureFails() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity pattern = seedPattern(owner);
        ConversationResponse conversation = conversationService.create(owner,
                CreateConversationRequest.builder().seedPatternId(pattern.getId()).build());
        failTheReplyWrite();

        ChatService.PreparedTurn[] prepared = new ChatService.PreparedTurn[1];
        assertThatCode(() -> prepared[0] = chatService.prepareTurn(owner, conversation.getId(),
                SendMessageRequest.builder().content("inkább a szabadnap").build()))
                .doesNotThrowAnyException();

        assertThat(prepared[0]).isNotNull();
        assertThat(prepared[0].userMessageId()).isNotNull();
        // the streamed path's first half commits on its own — the user row must be there
        List<AiMessageEntity> messages = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
                        conversation.getId(), owner);
        assertThat(messages).singleElement()
                .satisfies(row -> assertThat(row.getContent()).isEqualTo("inkább a szabadnap"));
        assertNoReplyEvent(owner, pattern);
    }

    /** Blows up inside {@code recordChatReply}'s own transaction, not around it. */
    private void failTheReplyWrite() {
        doThrow(new DataIntegrityViolationException("simulated reply-event write failure"))
                .when(patternEventRepository).saveAndFlush(any(PatternEventEntity.class));
    }

    private void assertNoReplyEvent(UUID owner, PatternEntity pattern) {
        assertThat(patternEventRepository.countByCreatedByAndPatternIdAndKindAndDeletedFalse(
                owner, pattern.getId(), PatternEventEntity.KIND_USER_REPLY)).isZero();
    }

    private PatternEntity seedPattern(UUID owner) {
        PatternEntity pattern = patternPopulator.reflection(owner,
                new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                        TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60),
                PatternEntity.STATUS_MONITORING);
        pattern.setTitle("Anna után jobban alszol");
        return patternRepository.saveAndFlush(pattern);
    }
}
