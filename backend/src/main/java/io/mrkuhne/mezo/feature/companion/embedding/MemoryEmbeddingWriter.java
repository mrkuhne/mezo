package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionEvent;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionWriter.ProjectionCommand;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
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
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Embeds a generated daily summary (kind={@code daily_summary}, ref = the summary row).
     * Replace-by-day: a REGENERATED summary (new row, same date — the soft-delete path) first
     * soft-deletes any live embedding of another summary row for the same day, so a day never
     * carries two live summary vectors.
     */
    @Transactional
    public void writeSummary(DailySummaryEntity summary) {
        Optional<MemoryEmbeddingEntity> existing = memoryEmbeddingRepository.findByKindAndRefId(
                MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getId());
        if (existing.isPresent()) {
            publishProjection(existing.get());
            return;
        }
        memoryEmbeddingRepository
                .findByCreatedByAndKindAndOccurredOn(summary.getCreatedBy(),
                        MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, summary.getSummaryDate())
                .forEach(stale -> {
                    log.info("Replacing stale daily_summary embedding {} for {}", stale.getId(),
                            summary.getSummaryDate());
                    memoryEmbeddingRepository.delete(stale); // @SQLDelete → soft delete
                    publishSuppression(stale);
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
        Optional<MemoryEmbeddingEntity> existing = memoryEmbeddingRepository.findByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId());
        if (existing.isPresent()) {
            publishProjection(existing.get());
            return;
        }
        String userContent = aiMessageRepository
                .findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                        assistant.getConversation().getId(), AiMessageEntity.ROLE_USER,
                        assistant.getCreatedAt())
                .map(AiMessageEntity::getContent).orElse("");
        write(assistant.getCreatedBy(), MemoryEmbeddingEntity.KIND_CHAT_TURN, assistant.getId(),
                PromptPersona.USER_TURN_LABEL + userContent + "\nMezo: " + assistant.getContent(),
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

    /** Deleted entries must not be recallable — soft-deletes the entry's vector row (IDENT-1 honesty). */
    @Transactional
    public void deleteJournalEmbedding(UUID entryId) {
        memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entryId)
                .ifPresent(row -> deleteAndSuppress(row));
    }

    /** W1.3 gratitude unit (spec §4.1 / §5.3): short lines, same upsert-in-place seam as journal. */
    @Transactional
    public void writeGratitude(GratitudeEntryEntity entry) {
        upsert(entry.getCreatedBy(), MemoryEmbeddingEntity.KIND_GRATITUDE, entry.getId(),
                entry.getText(), entry.getOccurredOn());
    }

    /** Deleted gratitude entries must not be recallable — soft-deletes the entry's vector row. */
    @Transactional
    public void deleteGratitudeEmbedding(UUID entryId) {
        memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_GRATITUDE, entryId)
                .ifPresent(row -> deleteAndSuppress(row));
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
                    .ifPresent(row -> deleteAndSuppress(row));
            return;
        }
        upsert(day.getCreatedBy(), MemoryEmbeddingEntity.KIND_REFLECTION, day.getId(), text,
                day.getRitualDate());
    }

    /**
     * W3.2 consolidation ladder (spec §7.2): a {@code period_summary} row becomes a
     * {@code weekly_summary} / {@code monthly_summary} vector. {@code occurred_on} is the period's
     * START (its identity — the ISO Monday / first of the month), so the block renders the period
     * a reader can name and the recency decay treats the whole period as that one date. The write
     * goes through {@link #upsert}: a regenerated period text refreshes the vector IN PLACE
     * instead of leaving a stale one behind on the same {@code (kind, ref_id)} key — but an
     * UNCHANGED text short-circuits before the provider call, because the nightly job re-offers
     * every period in its backfill window on every run.
     */
    @Transactional
    public void writePeriodSummary(PeriodSummaryEntity summary) {
        String kind = PeriodSummaryEntity.GRANULARITY_MONTH.equals(summary.getGranularity())
                ? MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY
                : MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY;
        String capped = cap(summary.getSummaryText());
        Optional<MemoryEmbeddingEntity> existing = memoryEmbeddingRepository.findByKindAndRefId(
                kind, summary.getId());
        if (existing.filter(row -> capped.equals(row.getContent())).isPresent()) {
            // the nightly job re-offers every period in its backfill window; re-embedding an
            // unchanged text would burn a provider call per period per night for nothing
            publishProjection(existing.get());
            return;
        }
        upsert(summary.getCreatedBy(), kind, summary.getId(), capped, summary.getPeriodStart());
    }

    /**
     * W1.5 note unit (spec §5.5), lifecycle-aware since mezo-b3pp.26. There is no listener behind
     * these kinds — the nightly {@code NoteEmbeddingCatchUp} is their only writer — so "has this
     * note changed?" cannot be answered by an event and is answered here instead, against the
     * stored content.
     *
     * <p>The comparison is against the CAPPED text, not the raw source text, and that is
     * load-bearing: {@link #cap} is what actually gets stored, so a note longer than
     * {@code embedding.embed-max-chars} whose tail changes has NOT changed as far as its vector is
     * concerned. Comparing the raw text would re-embed such a note on every single nightly run,
     * forever, for no change in the stored content.
     *
     * <p>Routed through {@link #upsert}, never {@link #write}: a previously reaped vector keeps
     * its {@code (kind, ref_id)} slot under the plain (non-partial)
     * {@code uq_memory_embedding_kind_ref_id}, and only the upsert path looks past
     * {@code @SQLRestriction} to revive it (the mezo-b3pp.2 trap).
     *
     * @return true iff an embedding call was spent — a first write or a drift re-embed. The sweep
     *         uses this to charge its per-run budget, so an unchanged note costs nothing.
     */
    @Transactional
    public boolean syncNote(String kind, NarrativeNoteSource.Note note) {
        String capped = cap(note.text());
        Optional<MemoryEmbeddingEntity> live = memoryEmbeddingRepository.findByKindAndRefId(kind, note.id());
        if (live.isPresent() && capped.equals(live.get().getContent())) {
            publishProjection(live.get());
            return false;
        }
        upsert(note.createdBy(), kind, note.id(), note.text(), note.occurredOn());
        return true;
    }

    /** The reap half (mezo-b3pp.26): a note whose source row is no longer live must stop being
     *  recallable — the {@link #deleteJournalEmbedding} idiom, IDENT-3 honesty. Soft-deletes the
     *  VECTOR only; the source row is never touched here. */
    @Transactional
    public void deleteNoteEmbedding(String kind, UUID refId) {
        memoryEmbeddingRepository.findByKindAndRefId(kind, refId)
                .ifPresent(row -> deleteAndSuppress(row));
    }

    /**
     * The re-embeddable unit's write path: first write inserts; a later edit re-embeds IN PLACE on
     * the {@code (kind, ref_id)} row. {@code uq_memory_embedding_kind_ref_id} spans soft-deleted
     * rows, so the spec's "delete + insert" is realized as an update (same key, fresh vector +
     * content). Only kinds whose source text can change go through here — {@code chat_turn}/{@code
     * daily_summary} are write-once and use {@link #write} directly.
     *
     * <p>The lookup deliberately INCLUDES soft-deleted rows and revives what it finds. A cleared
     * unit ({@link #writeReflection}'s blank branch, {@link #deleteJournalEmbedding}) soft-deletes
     * its vector, but the plain unique constraint keeps that dead row parked on the key — so
     * without the revive a later re-write would take the insert branch, hit the constraint, and
     * (both listeners swallow their failures) leave the unit silently un-embeddable FOREVER.
     * Reviving is safe for every kind routed here: {@code writeJournal} is only ever reached for
     * an entry that is still live (its listener re-reads through the {@code @SQLRestriction}
     * filter first, and re-checks liveness AFTER the write, deleting again if a racing delete won),
     * and decisions cannot be deleted at all.
     */
    private void upsert(UUID createdBy, String kind, UUID refId, String content, LocalDate occurredOn) {
        memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(kind, refId)
                .ifPresentOrElse(existing -> {
                    String capped = cap(content);
                    float[] vector = llmCallContextHolder.runWith(
                            new LlmCallContext("embed_memory", "document", kind, refId),
                            () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
                    existing.setContent(capped);
                    existing.setEmbedding(vector);
                    existing.setOccurredOn(occurredOn);
                    existing.setDeleted(false); // revive: the key is still ours, take it back
                    memoryEmbeddingRepository.saveAndFlush(existing);
                    publishProjection(existing);
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
        publishProjection(entity);
    }

    private void deleteAndSuppress(MemoryEmbeddingEntity row) {
        memoryEmbeddingRepository.delete(row); // @SQLDelete → soft delete
        memoryEmbeddingRepository.flush();
        publishSuppression(row);
    }

    private void publishProjection(MemoryEmbeddingEntity row) {
        eventPublisher.publishEvent(new MemoryProjectionEvent.Upsert(
                new ProjectionCommand(
                    row.getCreatedBy(), row.getKind(), row.getRefId(), null, row.getContent(),
                    row.getOccurredOn(), List.of(), List.of(), 0.5,
                    MemoryProvenanceEnvelope.empty()),
                row.getEmbedding()));
    }

    private void publishSuppression(MemoryEmbeddingEntity row) {
        eventPublisher.publishEvent(new MemoryProjectionEvent.Suppress(
                row.getCreatedBy(), row.getKind(), row.getRefId()));
    }

    /**
     * Package-visible so {@link NoteEmbeddingCatchUp} can compare a candidate's capped text
     * against {@code storedByRef} WITHOUT a per-row {@link #syncNote} transaction+query
     * (mezo-b3pp.26 fix) — this is the SAME capping {@link #syncNote} itself compares against,
     * kept as one definition instead of two rules that could drift apart.
     */
    String cap(String content) {
        int max = properties.embedding().embedMaxChars();
        return content.length() <= max ? content : content.substring(0, max);
    }
}
