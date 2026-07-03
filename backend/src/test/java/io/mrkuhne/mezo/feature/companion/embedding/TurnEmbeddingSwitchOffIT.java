package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.UUID;

/**
 * Turn-embedding toggle off ⇒ the listener bean does not exist AND the nightly catch-up pass
 * respects the toggle (heals it, never bypasses it) — no chat turn is ever embedded.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.embedding.embed-chat-turns=false")
class TurnEmbeddingSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private DailySummaryJob dailySummaryJob;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    @Test
    void testContext_shouldHaveNoListenerBean_whenEmbedTurnsOff() {
        assertThat(context.getBeanProvider(TurnEmbeddingListener.class).getIfAvailable()).isNull();
    }

    @Test
    void testJobRun_shouldNotCatchUpTurns_whenEmbedTurnsOff() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "kérdés");
        AiMessageEntity assistant = aiMessagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "válasz");

        dailySummaryJob.run();

        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId())).isFalse();
    }
}
