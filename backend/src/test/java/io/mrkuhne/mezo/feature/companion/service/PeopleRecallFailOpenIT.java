package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrendCalculator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * S8 (mezo-d6ivw.12) fix round 1: people recall is fail-open THROUGH the real proxied beans. A
 * RuntimeException inside a participating {@code @Transactional} callee would mark the turn's
 * transaction rollback-only, and sendMessage's commit would then throw UnexpectedRollbackException
 * despite PeopleRecall's catch. Deliberately NOT {@code @Transactional}: the turn must really
 * commit, or the rollback-only mark stays invisible.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class PeopleRecallFailOpenIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;
    @MockitoSpyBean private MentionDetectionService mentionDetectionService;
    @MockitoSpyBean private PersonAffectTrendCalculator affectTrendCalculator;

    @Test
    void testSendMessage_shouldCompleteAndPersistTheTurn_whenTheMatcherThrows() {
        doThrow(new IllegalStateException("matcher boom"))
                .when(mentionDetectionService).matchActivePersons(any(), anyString(), anyInt());

        assertTurnCompletes("s8-failopen-match@test.local");
    }

    @Test
    void testSendMessage_shouldCompleteAndPersistTheTurn_whenTheMentionedRowsThrow() {
        doThrow(new IllegalStateException("rows boom"))
                .when(affectTrendCalculator).calculate(any(), any(LocalDate.class));

        assertTurnCompletes("s8-failopen-rows@test.local");
    }

    private void assertTurnCompletes(String email) {
        UUID userId = databasePopulator.populateUser(email);
        AiConversationEntity conversation = conversations.conversation(userId);
        persons.createPerson(userId, "Dóri");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Dórival nyertünk ma!").build());

        assertThat(answer.getContent()).doesNotContain("(az üzenetben említettek)");
        assertThat(answer.getRecalled()).noneMatch(r -> "person".equals(r.getKind()));
        List<AiMessageEntity> rows = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId);
        assertThat(rows).extracting(AiMessageEntity::getRole)
                .containsExactly(AiMessageEntity.ROLE_USER, AiMessageEntity.ROLE_ASSISTANT);
    }
}
