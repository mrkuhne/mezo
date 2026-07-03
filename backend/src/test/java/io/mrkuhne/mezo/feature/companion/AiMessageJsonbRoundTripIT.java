package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Proves the typed jsonb envelopes on ai_message survive a real DB round-trip (ADR 0006 pattern). */
@Transactional
class AiMessageJsonbRoundTripIT extends AbstractIntegrationTest {

    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testPersist_shouldRoundTripTypedEnvelopes_whenToolCallsAndRefsSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_ASSISTANT);
        message.setContent("válasz");
        message.setToolCalls(new ToolCallsEnvelope(List.of(
                new ToolCallsEnvelope.ToolCall("read", "get_weight_trend"))));
        message.setRefs(new RefsEnvelope(List.of(
                new RefsEnvelope.Ref("weight", "2026-07-01"))));
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls().calls()).hasSize(1);
        assertThat(reloaded.getToolCalls().calls().getFirst().name()).isEqualTo("get_weight_trend");
        assertThat(reloaded.getRefs().refs().getFirst().kind()).isEqualTo("weight");
        assertThat(jdbcTemplate.queryForObject(
                "select jsonb_typeof(tool_calls) from ai_message where id = ?", String.class, id))
                .isEqualTo("object");
    }

    @Test
    void testPersist_shouldKeepEnvelopesNull_whenNotSet() {
        UUID userId = databasePopulator.populateUser("companion-jsonb-null@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(AiMessageEntity.ROLE_USER);
        message.setContent("kérdés");
        UUID id = messageRepository.saveAndFlush(message).getId();
        entityManager.clear();

        AiMessageEntity reloaded = messageRepository.findById(id).orElseThrow();
        assertThat(reloaded.getToolCalls()).isNull();
        assertThat(reloaded.getRefs()).isNull();
    }
}
