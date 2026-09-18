package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.companion.embedding.TurnEmbeddingListener;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Invokes the proxied async listeners, real services and DB, capturing actor at the provider port. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.extraction.enabled=true",
        "mezo.companion.embedding.embed-chat-turns=true"
})
@Import(PostTurnActorIT.Configuration.class)
class PostTurnActorIT extends AbstractIntegrationTest {
    @Autowired private FactExtractionListener extraction;
    @Autowired private TurnEmbeddingListener embedding;
    @Autowired private CapturingLlm llm;
    @Autowired private CapturingEmbedding embedder;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;

    @Test
    void testListeners_shouldUseEventOwner_whenInvokedWithoutRequestPrincipal() {
        llm.actors.clear();
        embedder.actors.clear();
        var owner = users.populateUser("postturn-actor@test.local");
        var conversation = conversations.conversation(owner);
        var userMessage = messages.message(conversation, "user", "Szeretek sétálni");
        var assistant = messages.message(conversation, "assistant", "Mesélj róla");
        var event = new ChatTurnCompleted(owner, userMessage.getId(), userMessage.getContent(),
                assistant.getId(), assistant.getContent());
        assertThat(LlmActorContext.capture()).isNull();
        extraction.onChatTurnCompleted(event);
        embedding.onChatTurnCompleted(event);
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(llm.actors).isNotEmpty().containsOnly(owner);
            assertThat(embedder.actors).isNotEmpty().containsOnly(owner);
        });
        assertThat(LlmActorContext.capture()).isNull();
    }

    static class CapturingLlm extends FakeCompanionLlm {
        final List<UUID> actors = new CopyOnWriteArrayList<>();
        @Override public String complete(String system, String message) {
            actors.add(LlmActorContext.capture());
            return "[]";
        }
    }
    static class CapturingEmbedding extends FakeEmbeddingAdapter {
        final List<UUID> actors = new CopyOnWriteArrayList<>();
        @Override public List<float[]> embedDocuments(List<String> texts) {
            actors.add(LlmActorContext.capture());
            return super.embedDocuments(texts);
        }
    }
    @TestConfiguration
    static class Configuration {
        @Bean @Primary CapturingLlm capturingLlm() { return new CapturingLlm(); }
        @Bean @Primary CapturingEmbedding capturingEmbedding() { return new CapturingEmbedding(); }
    }
}
