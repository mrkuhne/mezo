package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * The V2.2 embed pipeline's single write path: narrative unit → {@link EmbeddingPort} →
 * {@code memory_embedding} row. Idempotent per source unit (exists-probe +
 * {@code uq_memory_embedding_kind_ref_id} as the hard floor — a concurrent duplicate degrades
 * to a logged skip, never an error). Content is capped at {@code embedding.embed-max-chars}
 * BEFORE embedding, and the capped text is what gets stored (the vector must describe the
 * stored content, not a longer original).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryEmbeddingWriter {

    private final EmbeddingPort embeddingPort;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final AiMessageRepository aiMessageRepository;
    private final CompanionProperties properties;

    /** Embeds a generated daily summary (kind={@code daily_summary}, ref = the summary row). */
    @Transactional
    public void writeSummary(DailySummaryEntity summary) {
        write(summary.getCreatedBy(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getId(),
                summary.getNarrative(), summary.getSummaryDate());
    }

    /** Embeds one chat turn as ONE unit (question gives the topic, answer the content — V2.2 decision #5). */
    @Transactional
    public void writeTurn(UUID userId, UUID assistantMessageId, String userContent,
                          String assistantContent, LocalDate occurredOn) {
        write(userId, MemoryEmbeddingEntity.KIND_CHAT_TURN, assistantMessageId,
                "Daniel: " + userContent + "\nMezo: " + assistantContent, occurredOn);
    }

    /**
     * Embeds every assistant row since {@code since} that still misses its turn vector — the
     * nightly job's self-heal pass (listener-off periods, crashes, pre-V2.2 history). The user
     * half of each turn is the closest earlier user row of the same conversation.
     */
    @Transactional
    public void catchUpTurns(UUID userId, Instant since) {
        List<AiMessageEntity> assistants = aiMessageRepository
                .findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
                        userId, AiMessageEntity.ROLE_ASSISTANT, since);
        for (AiMessageEntity assistant : assistants) {
            if (memoryEmbeddingRepository.existsByKindAndRefId(
                    MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId())) {
                continue;
            }
            String userContent = aiMessageRepository
                    .findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                            assistant.getConversation().getId(), AiMessageEntity.ROLE_USER,
                            assistant.getCreatedAt())
                    .map(AiMessageEntity::getContent).orElse("");
            writeTurn(userId, assistant.getId(), userContent, assistant.getContent(),
                    LocalDate.ofInstant(assistant.getCreatedAt(), ZoneId.systemDefault()));
        }
    }

    private void write(UUID createdBy, String kind, UUID refId, String content, LocalDate occurredOn) {
        if (memoryEmbeddingRepository.existsByKindAndRefId(kind, refId)) {
            return;
        }
        String capped = cap(content);
        float[] vector = embeddingPort.embedDocuments(List.of(capped)).getFirst();
        MemoryEmbeddingEntity entity = new MemoryEmbeddingEntity();
        entity.setCreatedBy(createdBy);
        entity.setKind(kind);
        entity.setRefId(refId);
        entity.setContent(capped);
        entity.setEmbedding(vector);
        entity.setOccurredOn(occurredOn);
        try {
            memoryEmbeddingRepository.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            // Lost a race, or a soft-deleted row still holds the uq slot — idempotent skip.
            log.debug("memory_embedding {}/{} already present, skipping", kind, refId);
        }
    }

    private String cap(String content) {
        int max = properties.embedding().embedMaxChars();
        return content.length() <= max ? content : content.substring(0, max);
    }
}
