package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.TurnMemoryResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): the turn is the unit of visible memory. Composes what one chat turn did —
 * person facts through the people-owned {@link PersonFactService} port (ArchUnit companion →
 * people), owner-fact candidates by {@code derived_from_message_id}, and (Task 5) the forget
 * envelope on the message itself ({@code forgotten_memories}). Read-only; PEOPLE_SWITCH off ⇒ no person facts, never an error.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TurnMemoryService {

    private final ConversationService conversationService;
    private final AiMessageRepository messageRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;
    private final ObjectProvider<PersonFactService> personFactService;

    @Transactional(readOnly = true)
    public TurnMemoryResponse turnMemory(UUID userId, UUID conversationId, UUID messageId) {
        conversationService.getOwned(userId, conversationId);
        AiMessageEntity message = ownedUserMessage(userId, conversationId, messageId);
        PersonFactService facts = personFactService.getIfAvailable();
        List<PersonFactEntity> personFacts = facts == null ? List.of()
                : facts.bySourceRefs(userId, PersonFactEntity.SOURCE_CHAT_TURN, List.of(message.getId().toString()));
        Map<UUID, String> names = facts == null ? Map.of()
                : facts.personNames(userId, personFacts.stream().map(PersonFactEntity::getPersonId).toList());
        return TurnMemoryResponse.builder()
                .learned(personFacts.stream()
                        .map(f -> mapper.toTurnPersonFactResponse(f, names.getOrDefault(f.getPersonId(), "")))
                        .toList())
                .proposed(liveCandidates(userId, List.of(message.getId())).stream()
                        .map(mapper::toFactCandidateResponse).toList())
                .forgotten(message.getForgottenMemories() == null ? List.of()
                        : message.getForgottenMemories().items().stream().map(mapper::toMemoryItemResponse).toList())
                .build();
    }

    /** The conversation's USER message ids, oldest first. */
    @Transactional(readOnly = true)
    public List<UUID> userMessageIds(UUID userId, UUID conversationId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId).stream()
                .filter(m -> AiMessageEntity.ROLE_USER.equals(m.getRole()))
                .map(AiMessageEntity::getId)
                .toList();
    }

    /** Every still-live memory item of the conversation — forget-all preview + [Ebben a beszélgetésben]. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> liveItems(UUID userId, UUID conversationId) {
        return liveItemsOf(userId, userMessageIds(userId, conversationId));
    }

    /** Live items of the given user messages, newest first: active chat person facts, undecided
     *  candidates (pending), accepted/refined candidates as their live knowledge fact. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> liveItemsOf(UUID userId, Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return List.of();
        }
        List<ChatMemoryItem> items = new ArrayList<>();
        PersonFactService facts = personFactService.getIfAvailable();
        if (facts != null) {
            List<PersonFactEntity> rows = facts.bySourceRefs(userId, PersonFactEntity.SOURCE_CHAT_TURN,
                    messageIds.stream().map(UUID::toString).toList());
            Map<UUID, String> names = facts.personNames(userId, rows.stream().map(PersonFactEntity::getPersonId).toList());
            rows.forEach(f -> items.add(new ChatMemoryItem(ChatMemoryItem.KIND_PERSON_FACT, f.getId(), f.getPersonId(),
                    names.getOrDefault(f.getPersonId(), ""), f.getFactText(), f.getCreatedAt(), false,
                    UUID.fromString(f.getSourceRefId()))));
        }
        for (LearnedFactEntity c : liveCandidates(userId, messageIds)) {
            boolean pending = c.getUserDecision() == null;
            items.add(new ChatMemoryItem(
                    pending ? ChatMemoryItem.KIND_FACT_CANDIDATE : ChatMemoryItem.KIND_KNOWLEDGE_FACT,
                    pending ? c.getId() : c.getPromotedFactId(), null, null,
                    c.getRefinedText() != null ? c.getRefinedText() : c.getCandidateText(),
                    c.getCreatedAt(), pending, c.getDerivedFromMessageId()));
        }
        items.sort(Comparator.comparing(ChatMemoryItem::createdAt).reversed());
        return items;
    }

    /** Undecided candidates, plus accepted/refined ones whose promoted fact is still live. A
     *  rejected candidate (promotedFactId null) never shows again. */
    List<LearnedFactEntity> liveCandidates(UUID userId, Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return List.of();
        }
        return learnedFactRepository
                .findByCreatedByAndDerivedFromMessageIdInAndDeletedFalseOrderByCreatedAtAsc(userId, messageIds)
                .stream()
                .filter(c -> c.getUserDecision() == null
                        || (c.getPromotedFactId() != null && knowledgeFactRepository
                                .findByIdAndCreatedByAndDeletedFalse(c.getPromotedFactId(), userId).isPresent()))
                .toList();
    }

    AiMessageEntity ownedUserMessage(UUID userId, UUID conversationId, UUID messageId) {
        return messageRepository.findByIdAndConversationIdAndCreatedByAndDeletedFalse(messageId, conversationId, userId)
                .filter(m -> AiMessageEntity.ROLE_USER.equals(m.getRole()))
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
