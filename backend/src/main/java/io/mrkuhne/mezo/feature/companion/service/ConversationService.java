package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.ConversationRenameRequest;
import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
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
    /**
     * mezo-p2tr: {@link ChatService} already depends on {@code ConversationService} (its own
     * ownership check), so a direct field here would be a constructor-injection cycle — the
     * {@code ObjectProvider} lazy-lookup breaks it (resolved only when {@link #create} actually
     * needs it, well after both beans exist).
     */
    private final ObjectProvider<ChatService> chatService;

    public List<ConversationResponse> list(UUID userId) {
        return conversationRepository.findAllOwned(userId).stream()
                .map(mapper::toConversationResponse)
                .toList();
    }

    /**
     * mezo-p2tr: an optional {@code context} anchors the conversation to one ISO-Monday week or
     * one day inside it — persisted on the row, then (only when present) the server generates the
     * opening turn ({@link ChatService#openingTurn}) so Mezo speaks first about that week/day. A
     * plain {@code request == null} (or {@code context == null}) call is unchanged.
     */
    @Transactional
    public ConversationResponse create(UUID userId, CreateConversationRequest request) {
        AiConversationEntity conversation = new AiConversationEntity();
        conversation.setCreatedBy(userId);
        var context = request == null ? null : request.getContext();
        if (context != null) {
            conversation.setContextKind(context.getKind());
            conversation.setContextDate(context.getDate());
        }
        // saveAndFlush so @CreationTimestamp (createdAt -> startedAt) is populated before mapping.
        AiConversationEntity saved = conversationRepository.saveAndFlush(conversation);
        if (context != null) {
            chatService.getObject().openingTurn(userId, saved.getId());
        }
        return mapper.toConversationResponse(saved);
    }

    /**
     * F7.5 (mezo-d20.8.5): the list label is user-editable — reversible, no history impact.
     * The 120 cap is the contract's (and the column's); validation runs at the boundary.
     */
    @Transactional
    public ConversationResponse rename(UUID userId, UUID conversationId, ConversationRenameRequest request) {
        AiConversationEntity conversation = getOwned(userId, conversationId);
        conversation.setTitle(request.getTitle());
        return mapper.toConversationResponse(conversationRepository.saveAndFlush(conversation));
    }

    /**
     * F7.5: soft delete via the entity's {@code @SQLDelete} — the thread (and through
     * {@link #getOwned}'s filter, its messages) becomes unreachable; nothing is purged.
     */
    @Transactional
    public void delete(UUID userId, UUID conversationId) {
        conversationRepository.delete(getOwned(userId, conversationId));
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
