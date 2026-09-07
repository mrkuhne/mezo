package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S3 (mezo-eq85.3, spec 2026-09-06 §5): a conversation can be SEEDED with a hypothesis —
 * "beszéljünk erről" from the observation feed (Task 4) lands here. Everything the user then types
 * in that thread is evidence about that hypothesis, so the first turn is recorded as a
 * {@code user_reply} event. It stays an EVENT: the reply is an input to belief, never a status.
 */
@ActiveProfiles("companion-fake")
class ChatSeedReplyIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private ConversationService conversationService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternEventRepository eventRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSendMessage_shouldRecordUserReplyEvent_whenConversationIsSeededWithAPattern() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity pattern = seedPattern(owner);
        ConversationResponse conversation = conversationService.create(owner,
                CreateConversationRequest.builder().seedPatternId(pattern.getId()).build());

        assertThat(conversation.getSeedPatternId()).isEqualTo(pattern.getId());
        assertThat(conversation.getTitle()).isEqualTo(pattern.getTitle());

        chatService.sendMessage(owner, conversation.getId(), SendMessageRequest.builder()
                .content("nem Anna miatt, hanem mert szabadnapos voltam").build());

        List<PatternEventEntity> replies = eventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, pattern.getId())
                .stream()
                .filter(event -> PatternEventEntity.KIND_USER_REPLY.equals(event.getKind()))
                .toList();
        assertThat(replies).hasSize(1);
        assertThat(replies.getFirst().getPayload().channel()).isEqualTo("chat");
        assertThat(replies.getFirst().getPayload().choice()).isNull();
        assertThat(replies.getFirst().getPayload().text())
                .isEqualTo("nem Anna miatt, hanem mert szabadnapos voltam");
        // The reply is EVIDENCE, not a verdict — the engine still owns the row.
        assertThat(patternRepository.findById(pattern.getId()).orElseThrow().getStatus())
                .isEqualTo(PatternEntity.STATUS_MONITORING);
    }

    @Test
    void testSendMessage_shouldRecordNothing_whenConversationIsNotSeeded() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity pattern = seedPattern(owner);
        ConversationResponse conversation = conversationService.create(owner, null);

        chatService.sendMessage(owner, conversation.getId(),
                SendMessageRequest.builder().content("szia").build());

        assertThat(conversation.getSeedPatternId()).isNull();
        assertThat(eventRepository.countByCreatedByAndPatternIdAndKindAndDeletedFalse(
                owner, pattern.getId(), PatternEventEntity.KIND_USER_REPLY)).isZero();
    }

    @Test
    void testCreate_shouldReject_whenSeedPatternBelongsToSomeoneElse() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        PatternEntity foreign = seedPattern(stranger);

        assertThatThrownBy(() -> conversationService.create(owner,
                CreateConversationRequest.builder().seedPatternId(foreign.getId()).build()))
                .isInstanceOf(SystemRuntimeErrorException.class);
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
