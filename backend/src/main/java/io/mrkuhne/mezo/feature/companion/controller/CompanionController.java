package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionApi;
import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionController implements CompanionApi {

    private final ConversationService conversationService;
    private final ChatService chatService;
    private final KnowledgeFactService knowledgeFactService;
    private final CurrentUserId currentUserId;

    @Override
    public List<ConversationResponse> listConversations() {
        return conversationService.list(currentUserId.get());
    }

    @Override
    public ConversationResponse createConversation() {
        return conversationService.create(currentUserId.get());
    }

    @Override
    public List<MessageResponse> listMessages(UUID conversationId) {
        return conversationService.listMessages(currentUserId.get(), conversationId);
    }

    @Override
    public MessageResponse sendMessage(UUID conversationId, SendMessageRequest request) {
        return chatService.sendMessage(currentUserId.get(), conversationId, request);
    }

    @Override
    public List<KnowledgeFactResponse> listFacts() {
        return knowledgeFactService.list(currentUserId.get());
    }

    @Override
    public KnowledgeFactResponse createFact(CreateFactRequest request) {
        return knowledgeFactService.create(currentUserId.get(), request);
    }

    @Override
    public KnowledgeFactResponse updateFact(UUID factId, UpdateFactRequest request) {
        return knowledgeFactService.update(currentUserId.get(), factId, request);
    }
}
