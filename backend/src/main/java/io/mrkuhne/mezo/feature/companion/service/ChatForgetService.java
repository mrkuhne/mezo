package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.feature.companion.entity.ForgottenMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12, folds S6b mezo-d6ivw.9): "ezt ne jegyezd meg" in the chat. The chat and the
 * Tudástár speak the same verbs through the same writers: a person fact → {@link
 * PersonFactService#undo} (the inactive row is its own veto; its „Rólam is" copy goes too,
 * mezo-d6ivw.13); an undecided owner proposal → a
 * reject, which since S8 vetoes its text ({@link FactCandidateService#decide}); a proposal the
 * user already accepted in this conversation → {@link ForgetService#forgetFact}. Permanent — there
 * is no restore. The extraction race is closed by {@code extraction_blocked} (see {@link
 * MessageExtractionGate}): every row this service targets is marked BEFORE its items are read.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatForgetService {

    private final ConversationService conversationService;
    private final AiMessageRepository messageRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final TurnMemoryService turnMemoryService;
    private final FactCandidateService factCandidateService;
    private final ForgetService forgetService;
    private final AboutMeService aboutMeService;
    private final ObjectProvider<PersonFactService> personFactService;
    private final ObjectProvider<MentionDetectionService> mentionDetectionService;

    /** Forgets what the IMMEDIATELY PRECEDING user message of the conversation learned (owner
     *  ruling 2026-09-28: never walks back to an older turn — "ezt" means the last thing said).
     *  Called by the chat turn BEFORE its own user row is persisted, so the newest user row read
     *  here is the one before the forget request. That row is marked no-extract first (its
     *  extraction may still be in flight), then its live items are read and forgotten. Empty list
     *  = that message learned nothing (the widen-to-conversation offer is handled by the caller). */
    @Transactional
    public List<ChatMemoryItem> forgetLatest(UUID userId, UUID conversationId) {
        List<UUID> rows = turnMemoryService.userMessageIds(userId, conversationId);
        if (rows.isEmpty()) {
            return List.of();
        }
        UUID preceding = rows.getLast();
        block(preceding);
        forgetMentions(userId, List.of(preceding));
        // read AFTER the row lock: an extraction that committed meanwhile is included
        return forgetItems(userId, turnMemoryService.liveItemsOf(userId, List.of(preceding)));
    }

    /** What "Mindent ebből a beszélgetésből?" would forget — every still-live item. */
    @Transactional(readOnly = true)
    public List<ChatMemoryItem> preview(UUID userId, UUID conversationId) {
        conversationService.getOwned(userId, conversationId);
        return turnMemoryService.liveItems(userId, conversationId);
    }

    /** The widen step: forget every live item of every user message of the conversation, and
     *  append them to the triggering message's forget envelope (turn-memory shows them there). */
    @Transactional
    public List<ChatMemoryItem> forgetAll(UUID userId, UUID conversationId, UUID triggerMessageId) {
        conversationService.getOwned(userId, conversationId);
        AiMessageEntity trigger = turnMemoryService.ownedUserMessage(userId, conversationId, triggerMessageId);
        List<UUID> rows = turnMemoryService.userMessageIds(userId, conversationId);
        rows.forEach(this::block);
        forgetMentions(userId, rows);
        List<ChatMemoryItem> forgotten = forgetItems(userId, turnMemoryService.liveItemsOf(userId, rows));
        AiMessageEntity fresh = messageRepository.findById(trigger.getId()).orElseThrow();
        fresh.setForgottenMemories(ForgottenMemoriesEnvelope.append(fresh.getForgottenMemories(), forgotten));
        fresh.setExtractionBlocked(true);
        messageRepository.saveAndFlush(fresh);
        return forgotten;
    }

    private void block(UUID messageId) {
        messageRepository.findById(messageId).filter(m -> !m.isExtractionBlocked()).ifPresent(m -> {
            m.setExtractionBlocked(true);
            messageRepository.saveAndFlush(m); // the UPDATE takes the row lock the gate waits on
        });
    }

    /** mezo-tdabt: the people mentions written from the forgotten user messages go too (the daily
     *  summary and the person page quote their excerpts). Runs AFTER {@link #block}: a mention the
     *  async listener committed meanwhile is read here; one still in flight sees the block through
     *  the gate and is never written. Skipped when the people bean is absent. */
    private void forgetMentions(UUID userId, List<UUID> userMessageIds) {
        MentionDetectionService mentions = mentionDetectionService.getIfAvailable();
        if (mentions != null) {
            mentions.forgetBySourceRefs(userId, ChatMentionListener.SOURCE_REF_KIND, userMessageIds);
        }
    }

    private List<ChatMemoryItem> forgetItems(UUID userId, List<ChatMemoryItem> items) {
        PersonFactService facts = personFactService.getIfAvailable();
        List<ChatMemoryItem> done = new ArrayList<>();
        for (ChatMemoryItem item : items) {
            boolean forgotten = switch (item.kind()) {
                case ChatMemoryItem.KIND_PERSON_FACT -> {
                    if (facts == null) yield false;
                    facts.undo(userId, item.personId(), item.refId());
                    // mezo-d6ivw.13: its „Rólam is" copy goes in the same transaction (the undo
                    // event's async listener would find nothing left — idempotent)
                    aboutMeService.remove(userId, item.refId());
                    yield true;
                }
                case ChatMemoryItem.KIND_FACT_CANDIDATE -> {
                    factCandidateService.decide(userId, item.refId(), FactDecisionRequest.builder()
                            .decision(FactDecisionRequest.DecisionEnum.REJECT).build());
                    yield true;
                }
                case ChatMemoryItem.KIND_KNOWLEDGE_FACT -> {
                    if (knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(item.refId(), userId).isEmpty()) {
                        yield false;
                    }
                    forgetService.forgetFact(userId, item.refId());
                    yield true;
                }
                default -> false;
            };
            if (forgotten) {
                done.add(item);
            }
        }
        return done;
    }
}
