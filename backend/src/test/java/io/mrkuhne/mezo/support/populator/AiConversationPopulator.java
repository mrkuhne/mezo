package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.Instant;
import java.util.UUID;

@TestComponent
@RequiredArgsConstructor
public class AiConversationPopulator {

    private final AiConversationRepository repository;

    /** A fresh, empty conversation (no title, no activity yet). */
    public AiConversationEntity conversation(UUID createdBy) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(createdBy);
        return repository.saveAndFlush(conversation);
    }

    public AiConversationEntity conversation(UUID createdBy, String title, Instant lastMessageAt) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(createdBy);
        conversation.setTitle(title);
        conversation.setLastMessageAt(lastMessageAt);
        return repository.saveAndFlush(conversation);
    }
}
