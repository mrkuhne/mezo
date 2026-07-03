package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ConversationService {

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final CompanionMapper mapper;

    public List<ConversationResponse> list(UUID userId) {
        return conversationRepository.findAllOwned(userId).stream()
                .map(mapper::toConversationResponse)
                .toList();
    }

    @Transactional
    public ConversationResponse create(UUID userId) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(userId);
        // saveAndFlush so @CreationTimestamp (createdAt -> startedAt) is populated before mapping.
        return mapper.toConversationResponse(conversationRepository.saveAndFlush(conversation));
    }

    public List<MessageResponse> listMessages(UUID userId, UUID conversationId) {
        getOwned(userId, conversationId);
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId)
                .stream()
                .map(mapper::toMessageResponse)
                .toList();
    }

    /** Loads an owned conversation or throws 404 — shared with ChatService. */
    public AiConversationEntity getOwned(UUID userId, UUID conversationId) {
        return conversationRepository.findByIdAndCreatedByAndDeletedFalse(conversationId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
