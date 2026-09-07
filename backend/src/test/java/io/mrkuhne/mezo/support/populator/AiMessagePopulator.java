package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class AiMessagePopulator {

    private final AiMessageRepository repository;

    /** A message in the given conversation, owner inherited from the conversation. Envelopes stay null (V0.2 shape). */
    public AiMessageEntity message(AiConversationEntity conversation, String role, String content) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(conversation.getCreatedBy());
        message.setRole(role);
        message.setContent(content);
        return repository.saveAndFlush(message);
    }

    /**
     * A NEW-mode assistant turn carrying its {@code recalled_memories} imprint (W3.1b shape) — the
     * only bridge from a retrieval run to what the model actually saw, and therefore the fixture
     * the admin explorer's prompt-trace read needs (mezo-4qyt).
     */
    public AiMessageEntity messageWithRecalledMemories(AiConversationEntity conversation, String role,
                                                       String content,
                                                       RecalledMemoriesEnvelope recalledMemories) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(conversation.getCreatedBy());
        message.setRole(role);
        message.setContent(content);
        message.setRecalledMemories(recalledMemories);
        return repository.saveAndFlush(message);
    }
}
