package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatService {

    /**
     * Static Hungarian companion voice — IDENT-1 (companion, not coach), the clinical guard and
     * grounding-lite from the design spec §6. V0.3 appends the context snapshot below; V1.1 adds
     * the knowledge facts.
     */
    static final String SYSTEM_PROMPT = """
            Te vagy a mezo, Daniel személyes egészség- és teljesítmény-társa.
            Hangnem: közvetlen, többes szám első személyű („nézzük meg", „ezt visszük ma") — társ vagy, nem edző.
            Megfigyelsz és javasolsz, sosem osztályozol és sosem moralizálsz.
            Csak Daniel saját, naplózott adataira és a beszélgetésben elhangzottakra támaszkodj.
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod — számot vagy adatot kitalálni tilos.
            Gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.
            Válaszolj magyarul, tömören.""";

    static final String HISTORY_HEADER = "\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n";

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final ConversationService conversationService;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;

    @Transactional
    public MessageResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);

        // Window BEFORE persisting the new message — the current content travels as the user param.
        // V0.3: snapshot between the static voice and the history transcript (V1.1 adds facts here).
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + renderHistory(loadWindow(userId, conversationId));

        persistMessage(conversation, userId, AiMessageEntity.ROLE_USER, request.getContent());
        String answer = companionLlm.complete(systemPrompt, request.getContent());
        AiMessageEntity assistant =
                persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT, answer);

        touchConversation(conversation, request.getContent());
        return mapper.toMessageResponse(assistant);
    }

    private List<AiMessageEntity> loadWindow(UUID userId, UUID conversationId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
                        conversationId, userId, PageRequest.of(0, properties.chat().historyWindow()))
                .reversed();
    }

    private String renderHistory(List<AiMessageEntity> window) {
        if (window.isEmpty()) {
            return "";
        }
        StringBuilder history = new StringBuilder(HISTORY_HEADER);
        for (AiMessageEntity message : window) {
            history.append(AiMessageEntity.ROLE_USER.equals(message.getRole()) ? "Daniel: " : "Mezo: ")
                    .append(message.getContent())
                    .append('\n');
        }
        return history.toString();
    }

    private AiMessageEntity persistMessage(
            AiConversationEntity conversation, UUID userId, String role, String content) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(role);
        message.setContent(content);
        // saveAndFlush so the two rows of a turn get distinct created_at (history ordering key)
        return messageRepository.saveAndFlush(message);
    }

    private void touchConversation(AiConversationEntity conversation, String userContent) {
        conversation.setLastMessageAt(Instant.now());
        if (conversation.getTitle() == null) {
            int max = properties.chat().titleMaxChars();
            conversation.setTitle(
                    userContent.length() <= max ? userContent : userContent.substring(0, max));
        }
        conversationRepository.save(conversation);
    }
}
