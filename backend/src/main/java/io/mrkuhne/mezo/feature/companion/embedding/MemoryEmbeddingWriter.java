package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * The V2.2 embed pipeline's single write path: narrative unit → {@link EmbeddingPort} →
 * {@code memory_embedding} row. Idempotent per source unit via the exists-probe;
 * {@code uq_memory_embedding_kind_ref_id} is the hard floor under races — a collision rolls
 * back ONLY that unit's transaction (callers run one unit per call through the proxy and
 * log-and-continue; the next nightly run heals whatever a race dropped). Content is capped at
 * {@code embedding.embed-max-chars} BEFORE embedding, and the capped text is what gets stored
 * (the vector must describe the stored content, not a longer original).
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
    private final LlmCallContextHolder llmCallContextHolder;

    /**
     * Embeds a generated daily summary (kind={@code daily_summary}, ref = the summary row).
     * Replace-by-day: a REGENERATED summary (new row, same date — the soft-delete path) first
     * soft-deletes any live embedding of another summary row for the same day, so a day never
     * carries two live summary vectors.
     */
    @Transactional
    public void writeSummary(DailySummaryEntity summary) {
        if (memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getId())) {
            return;
        }
        memoryEmbeddingRepository
                .findByCreatedByAndKindAndOccurredOn(summary.getCreatedBy(),
                        MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getSummaryDate())
                .forEach(stale -> {
                    log.info("Replacing stale daily_summary embedding {} for {}", stale.getId(),
                            summary.getSummaryDate());
                    memoryEmbeddingRepository.delete(stale); // @SQLDelete → soft delete
                });
        write(summary.getCreatedBy(), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getId(),
                summary.getNarrative(), summary.getSummaryDate());
    }

    /**
     * Embeds one committed chat turn as ONE unit (question gives the topic, answer the content —
     * V2.2 decision #5), loading both halves from the message rows: {@code occurred_on} is the
     * assistant row's creation day (the episode's day, never the embed day) on BOTH the live
     * (listener) and the catch-up (nightly job) path. One unit = one transaction.
     */
    @Transactional
    public void embedTurnByMessageId(UUID assistantMessageId) {
        AiMessageEntity assistant = aiMessageRepository.findById(assistantMessageId).orElse(null);
        if (assistant == null || !AiMessageEntity.ROLE_ASSISTANT.equals(assistant.getRole())) {
            return;
        }
        if (memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId())) {
            return;
        }
        String userContent = aiMessageRepository
                .findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                        assistant.getConversation().getId(), AiMessageEntity.ROLE_USER,
                        assistant.getCreatedAt())
                .map(AiMessageEntity::getContent).orElse("");
        write(assistant.getCreatedBy(), MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId(),
                "Daniel: " + userContent + "\nMezo: " + assistant.getContent(),
                LocalDate.ofInstant(assistant.getCreatedAt(), ZoneId.systemDefault()));
    }

    /**
     * The nightly self-heal pass's work list: assistant rows since {@code since} still missing
     * their turn vector. Read-only — the caller embeds each id in its OWN transaction
     * ({@link #embedTurnByMessageId}), so one failing/racing unit cannot abort the rest.
     */
    @Transactional(readOnly = true)
    public List<UUID> findUnembeddedTurnIds(UUID userId, Instant since) {
        return aiMessageRepository
                .findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
                        userId, AiMessageEntity.ROLE_ASSISTANT, since)
                .stream()
                .map(AiMessageEntity::getId)
                .filter(id -> !memoryEmbeddingRepository.existsByKindAndRefId(
                        MemoryEmbeddingEntity.KIND_CHAT_TURN, id))
                .toList();
    }

    /** W1.1 journal unit (spec §5.1): create inserts, an edit re-embeds in place ({@link #upsert}). */
    @Transactional
    public void writeJournal(JournalEntryEntity entry) {
        upsert(entry.getCreatedBy(), MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entry.getId(),
                entry.getText(), entry.getOccurredOn());
    }

    /** Deleted entries must not be recallable — soft-deletes the entry's vector row (IDENT-3 honesty). */
    @Transactional
    public void deleteJournalEmbedding(UUID entryId) {
        memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entryId)
                .ifPresent(memoryEmbeddingRepository::delete); // @SQLDelete → soft delete
    }

    /**
     * W1.4 decision unit (spec §5.4): the decision text on create, and — once reviewed — the same
     * text plus its outcome, re-embedded IN PLACE on the live {@code (kind, ref_id)} row. The
     * outcome is the half worth recalling ("what did I decide, and did it work"), which is why a
     * review re-embeds instead of leaving the create-time vector standing.
     */
    @Transactional
    public void writeDecision(DecisionEntryEntity decision) {
        upsert(decision.getCreatedBy(), MemoryEmbeddingEntity.KIND_DECISION, decision.getId(),
                decisionContent(decision), decision.getDecidedOn());
    }

    /**
     * W1.2 evening reflection (spec §5.2): the day's prose, embedded when the ritual closes and
     * re-embedded when an already-closed day's prose is edited, so the vector never goes stale.
     * A blank or cleared reflection is not embeddable — any existing vector is soft-deleted, so a
     * skipped (or erased) evening is never recallable (IDENT-3 honesty, the {@link
     * #deleteJournalEmbedding} idiom).
     */
    @Transactional
    public void writeReflection(RitualDayEntity day) {
        String text = day.getReflectionText();
        if (text == null || text.isBlank()) {
            memoryEmbeddingRepository
                    .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, day.getId())
                    .ifPresent(memoryEmbeddingRepository::delete); // @SQLDelete → soft delete
            return;
        }
        upsert(day.getCreatedBy(), MemoryEmbeddingEntity.KIND_REFLECTION, day.getId(), text,
                day.getRitualDate());
    }

    /**
     * The re-embeddable unit's write path: first write inserts; a later edit re-embeds IN PLACE on
     * the live {@code (kind, ref_id)} row. {@code uq_memory_embedding_kind_ref_id} spans
     * soft-deleted rows, so the spec's "delete + insert" is realized as an update (same key, fresh
     * vector + content). Only kinds whose source text can change go through here — {@code
     * chat_turn}/{@code daily_summary} are write-once and use {@link #write} directly.
     */
    private void upsert(UUID createdBy, String kind, UUID refId, String content, LocalDate occurredOn) {
        memoryEmbeddingRepository.findByKindAndRefId(kind, refId).ifPresentOrElse(existing -> {
            String capped = cap(content);
            float[] vector = llmCallContextHolder.runWith(
                    new LlmCallContext("embed_memory", "document", kind, refId),
                    () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
            existing.setContent(capped);
            existing.setEmbedding(vector);
            existing.setOccurredOn(occurredOn);
            memoryEmbeddingRepository.saveAndFlush(existing);
        }, () -> write(createdBy, kind, refId, content, occurredOn));
    }

    private static String decisionContent(DecisionEntryEntity decision) {
        if (decision.getOutcomeRating() == null) {
            return decision.getDecisionText();
        }
        String outcome = decision.getOutcomeText() == null ? "" : " " + decision.getOutcomeText();
        return decision.getDecisionText()
                + "\n\nKimenet (" + decision.getOutcomeRating() + "/5):" + outcome;
    }

    private void write(UUID createdBy, String kind, UUID refId, String content, LocalDate occurredOn) {
        if (memoryEmbeddingRepository.existsByKindAndRefId(kind, refId)) {
            return;
        }
        String capped = cap(content);
        float[] vector = llmCallContextHolder.runWith(
                new LlmCallContext("embed_memory", "document", kind, refId),
                () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
        MemoryEmbeddingEntity entity = new MemoryEmbeddingEntity();
        entity.setCreatedBy(createdBy);
        entity.setKind(kind);
        entity.setRefId(refId);
        entity.setContent(capped);
        entity.setEmbedding(vector);
        entity.setOccurredOn(occurredOn);
        // A lost race raises the uq violation and rolls back this unit's tx — deliberate:
        // catching it here cannot recover an aborted PG transaction. Callers log-and-continue.
        memoryEmbeddingRepository.saveAndFlush(entity);
    }

    private String cap(String content) {
        int max = properties.embedding().embedMaxChars();
        return content.length() <= max ? content : content.substring(0, max);
    }
}
