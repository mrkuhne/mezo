package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
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
            Múltbeli vagy összesítő kérdéshez (edzések, étkezés, súly, alvás, protokoll, gyógyszerciklus) \
            használd a kapott tool-okat — a pillanatkép csak a mai napot mutatja; tool nélkül ne találgass.
            Válaszolj magyarul, tömören.""";

    static final String HISTORY_HEADER = "\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n";

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final ConversationService conversationService;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final CompanionToolRegistry toolRegistry;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;

    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction. */
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt, String userContent) {}

    /**
     * First half of a STREAMED turn (own transaction when called through the proxy):
     * ownership check, prompt assembly (window BEFORE persisting the new message), persist
     * the USER row, set title-once + lastMessageAt. Splitting the turn means a later LLM
     * failure keeps the user message — honest history for the streamed path (the sync
     * {@link #sendMessage} keeps its single-transaction rollback semantics).
     */
    @Transactional
    public PreparedTurn prepareTurn(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + knowledgeFactService.renderPromptBlock(userId)
                + renderHistory(loadWindow(userId, conversationId));
        AiMessageEntity userRow = persistMessage(
                conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null, false);
        touchConversation(conversation, request.getContent());
        return new PreparedTurn(conversationId, userRow.getId(), systemPrompt, request.getContent());
    }

    /**
     * Second half of a STREAMED turn (own transaction): persist the ASSISTANT row with the turn's
     * tool audit (V0.5) + bump lastMessageAt. Publishes {@link ChatTurnCompleted} for the V1.2
     * post-turn extraction (fires AFTER this transaction commits).
     */
    @Transactional
    public MessageResponse completeTurn(
            UUID userId, UUID conversationId, UUID userMessageId, String userContent,
            String answer, ToolCallAudit audit, boolean degraded) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope(), degraded);
        conversation.setLastMessageAt(Instant.now());
        conversationRepository.save(conversation);
        eventPublisher.publishEvent(new ChatTurnCompleted(userId, userMessageId, userContent, answer));
        return mapper.toMessageResponse(assistant);
    }

    @Transactional
    public MessageResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
        AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);

        // Window BEFORE persisting the new message — the current content travels as the user param.
        // Prompt order: voice -> context snapshot (V0.3) -> top-N knowledge facts (V1.1) -> history.
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + knowledgeFactService.renderPromptBlock(userId)
                + renderHistory(loadWindow(userId, conversationId));

        AiMessageEntity userRow = persistMessage(
                conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null, false);
        // V0.5: tools registered on the turn; the audit lands in the assistant row's envelopes
        ToolCallAudit audit = toolRegistry.newTurnAudit();
        String answer = companionLlm.complete(systemPrompt, request.getContent(),
                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit));
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope(), false);

        touchConversation(conversation, request.getContent());
        // V1.2: post-turn extraction trigger — the async listener runs AFTER this turn commits
        eventPublisher.publishEvent(new ChatTurnCompleted(userId, userRow.getId(), request.getContent(), answer));
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

    private AiMessageEntity persistMessage(AiConversationEntity conversation, UUID userId, String role,
            String content, ToolCallsEnvelope toolCalls, RefsEnvelope refs, boolean degraded) {
        AiMessageEntity message = new AiMessageEntity();
        message.setConversation(conversation);
        message.setCreatedBy(userId);
        message.setRole(role);
        message.setContent(content);
        message.setToolCalls(toolCalls);
        message.setRefs(refs);
        message.setDegraded(degraded);
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
